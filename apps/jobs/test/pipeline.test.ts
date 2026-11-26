import { contrastIssues, siteConfigSchema } from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import { BUILD_ENV, missingBuildEnv } from "../src/env.js";
import type { MemoryStore, PipelineDeps } from "../src/index.js";
import { runNext, setup } from "./setup.js";

describe("pipeline", { timeout: 240_000 }, () => {
  it("goes from the answers to 3 directions, a reviewed preview and the live site", async () => {
    const { store, siteId, deps, uploads, deployed } = setup();

    store.enqueue(siteId, "directions");
    expect(await runNext(deps, store)).toBe("done");
    let site = await store.loadSite(siteId);
    expect(site.status).toBe("awaiting_direction_choice");
    const directions = store.directions.filter((d) => d.siteId === siteId);
    expect(directions.map((d) => d.direction)).toEqual(["fiel-a-marca", "evolucao", "contraste"]);
    expect(directions[0]?.screenshots).toEqual([
      `${siteId}/0/fiel-a-marca-390.png`,
      `${siteId}/0/fiel-a-marca-1280.png`,
    ]);
    expect(store.renders.size).toBe(6);
    expect(
      (await store.registry.near("food", "santa rita do sapucai")).map((s) => s.siteId),
    ).toEqual([siteId]);

    // The client chooses (choose_direction in the database).
    await store.updateSite(siteId, { status: "building" });
    const record = store.sites.get(siteId);
    if (record) record.approvedDirection = directions[1]?.id ?? null;
    store.enqueue(siteId, "build");
    expect(await runNext(deps, store)).toBe("done");
    site = await store.loadSite(siteId);
    expect(site.status).toBe("in_review");
    expect(site.previewToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(store.registry.approved.has(siteId)).toBe(true);
    const config = siteConfigSchema.parse(site.config);
    expect(config.design.identity?.personality).toBe(directions[1]?.identity.personality);
    expect(config.design.directionStatus).toBe("approved");
    expect(config.ai.modelId).toBe("simulated");
    expect(store.reports[0]?.status).toBe("passed");
    expect(uploads[0]?.html).toContain(`/${siteId}/${site.previewToken}/`);
    expect(uploads[0]?.html).toContain("Padaria do Zé");

    // Paid: the site goes live.
    await store.updateSite(siteId, { status: "publishing" });
    store.paid.add(siteId);
    store.enqueue(siteId, "publish");
    expect(await runNext(deps, store)).toBe("done");
    expect((await store.loadSite(siteId)).status).toBe("live");
    expect(deployed).toEqual(["padaria-do-ze"]);
    expect(store.events.map((e) => e.kind)).toEqual([
      "directions_ready",
      "site_built",
      "published",
    ]);
  });

  it("keeps colors changed after approval, with AA contrast", async () => {
    const { store, siteId, deps } = setup((draft) => {
      // A light primary that would make white button text unreadable.
      draft.colorOverrides = { primary: "#F2E8D5" };
    });
    store.enqueue(siteId, "directions");
    await runNext(deps, store);
    const [chosen] = store.directions.filter((d) => d.siteId === siteId);
    await store.updateSite(siteId, { status: "building" });
    const record = store.sites.get(siteId);
    if (record) record.approvedDirection = chosen?.id ?? null;
    store.enqueue(siteId, "build");
    expect(await runNext(deps, store)).toBe("done");
    const config = siteConfigSchema.parse((await store.loadSite(siteId)).config);
    const identity = config.design.identity;
    expect(identity?.palette).toEqual(chosen?.identity.palette);
    expect(config.design.overrides.colors).toBeDefined();
    if (identity) {
      expect(contrastIssues({ ...identity.palette, ...config.design.overrides.colors })).toEqual(
        [],
      );
    }
  });

  it("keeps each composition's key and carries the admin's change request to the copy step", async () => {
    const { store, siteId, deps } = setup();
    store.enqueue(siteId, "directions");
    await runNext(deps, store);
    const directions = store.directions.filter((d) => d.siteId === siteId);
    expect(directions.every((d) => /^[0-9a-f]{16}$/.test(d.compositionKey ?? ""))).toBe(true);

    const notes: string[][] = [];
    const writeCopy = deps.ai.writeCopy.bind(deps.ai);
    deps.ai.writeCopy = (config, caller, options) => {
      notes.push(options?.notes ?? []);
      return writeCopy(config, caller, options);
    };
    await store.updateSite(siteId, { status: "building" });
    const record = store.sites.get(siteId);
    if (record) record.approvedDirection = directions[0]?.id ?? null;
    store.enqueue(siteId, "build", { rebuild: true, adminNotes: ["O título repete o nome."] });
    expect(await runNext(deps, store)).toBe("done");
    expect(notes[0]).toEqual(["O título repete o nome."]);
  });

  // E46: the production run of 16/11 used every review round and the agent kept finding
  // something; its opinions must not stop the site before the person who reviews it anyway.
  const stubbornAgent = (): PipelineDeps["agent"] => ({
    review: async () => ({
      findings: [
        {
          check: "agent:fit",
          severity: "high",
          where: "hero",
          message: "O tom do título não combina.",
          fix: { type: "rewrite-copy" },
        },
      ],
      costUsd: 0.05,
      source: "model",
    }),
  });

  async function buildChosen(deps: PipelineDeps, store: MemoryStore, siteId: string) {
    store.enqueue(siteId, "directions");
    expect(await runNext(deps, store)).toBe("done");
    const [chosen] = store.directions.filter((d) => d.siteId === siteId);
    await store.updateSite(siteId, { status: "building" });
    const record = store.sites.get(siteId);
    if (record) record.approvedDirection = chosen?.id ?? null;
    store.enqueue(siteId, "build");
    return runNext(deps, store);
  }

  it("an agent that repeats a high note in every round still reaches the person (E46)", async () => {
    const { store, siteId, deps, uploads } = setup();
    deps.agent = stubbornAgent();
    expect(await buildChosen(deps, store, siteId)).toBe("done");
    const site = await store.loadSite(siteId);
    expect(site.status).toBe("in_review");
    expect(uploads).toHaveLength(1);
    expect(store.reports[0]?.status).toBe("changesNeeded");
    expect(store.events.at(-1)?.kind).toBe("site_built");
  });

  it("holds the agent's high note when nobody reviews the site (E46)", async () => {
    const { store, siteId, deps, uploads } = setup();
    deps.agent = stubbornAgent();
    deps.skipHumanReview = true;
    expect(await buildChosen(deps, store, siteId)).toBe("done");
    const site = await store.loadSite(siteId);
    expect(site.status).toBe("needs_attention");
    expect(site.statusMessage).toMatch(/problema técnico/);
    expect(uploads).toHaveLength(0);
    expect(store.reports[0]?.status).toBe("needsAttention");
  });

  it("the team releases a site the review held: the preview, no new copy nor review (E46)", async () => {
    const { store, siteId, deps, uploads } = setup();
    deps.agent = stubbornAgent();
    deps.skipHumanReview = true;
    expect(await buildChosen(deps, store, siteId)).toBe("done");
    expect((await store.loadSite(siteId)).status).toBe("needs_attention");
    const held = (await store.loadSite(siteId)).config;
    expect(store.reports[0]?.report).toMatchObject({ releasable: true });

    let copyCalls = 0;
    const writeCopy = deps.ai.writeCopy.bind(deps.ai);
    deps.ai.writeCopy = (...args) => {
      copyCalls++;
      return writeCopy(...args);
    };
    let reviews = 0;
    deps.agent = {
      review: async () => {
        reviews += 1;
        return { findings: [], costUsd: 0, source: "simulated" };
      },
    };
    await store.updateSite(siteId, { status: "building" });
    store.enqueue(siteId, "build", { release: true, releasedBy: "admin-1" });
    expect(await runNext(deps, store)).toBe("done");
    const site = await store.loadSite(siteId);
    // Padaria has standard review: straight to the client.
    expect(site.status).toBe("awaiting_approval");
    expect(site.config).toEqual(held);
    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.html).toContain(`/${siteId}/${site.previewToken}/`);
    expect(copyCalls).toBe(0);
    expect(reviews).toBe(0);
    expect(store.reports).toHaveLength(1);
  });

  it("stops the build at once when a variable is missing, and names only the names (E46)", async () => {
    const { store, siteId, deps } = setup();
    store.enqueue(siteId, "directions");
    await runNext(deps, store);
    const [chosen] = store.directions.filter((d) => d.siteId === siteId);
    await store.updateSite(siteId, { status: "building" });
    const record = store.sites.get(siteId);
    if (record) record.approvedDirection = chosen?.id ?? null;
    const job = store.enqueue(siteId, "build");
    const missing = missingBuildEnv({
      AI_MODE: "live",
      ANTHROPIC_API_KEY: "value-of-the-key",
      AI_MODEL_ID: "claude-opus-5-5",
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SECRET_KEY: "value",
      CLOUDFLARE_ACCOUNT_ID: "acc",
      R2_ACCESS_KEY_ID: "a",
      R2_SECRET_ACCESS_KEY: "b",
    });
    expect(missing).toEqual(["CLOUDFLARE_KV_NAMESPACE_ID", "CLOUDFLARE_KV_API_TOKEN"]);
    const broken: PipelineDeps = { ...deps, missingEnv: missing };
    expect(await runNext(broken, store)).toBe("retry");
    expect(await runNext(broken, store)).toBe("failed");
    const stored = store.jobs.find((item) => item.id === job.id)?.error ?? "";
    expect(stored).toContain("CLOUDFLARE_KV_NAMESPACE_ID, CLOUDFLARE_KV_API_TOKEN");
    expect(stored).not.toContain("value-of-the-key");
  });

  it("checks the variables only with the real AI (E46)", () => {
    expect(missingBuildEnv({})).toEqual([]);
    expect(missingBuildEnv({ AI_MODE: "live" })).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      ...BUILD_ENV,
    ]);
  });

  it("retries a failed job once, then sends the site to needs attention", async () => {
    const { store, siteId, deps } = setup();
    await store.updateSite(siteId, { status: "publishing" });
    store.enqueue(siteId, "publish");
    expect(await runNext(deps, store)).toBe("retry");
    expect(await runNext(deps, store)).toBe("failed");
    const site = await store.loadSite(siteId);
    expect(site.status).toBe("needs_attention");
    expect(store.events.at(-1)?.kind).toBe("job_failed");
  });

  it("a redo keeps away from the earlier round and follows the client's chips (E41)", async () => {
    const { store, siteId, deps } = setup();
    store.enqueue(siteId, "directions");
    expect(await runNext(deps, store)).toBe("done");
    const first = store.directions.filter((d) => d.siteId === siteId && d.round === 0);

    // request_directions moves to the next round; the platform adds the chips to the payload.
    await store.updateSite(siteId, { status: "generating_directions" });
    const record = store.sites.get(siteId);
    if (record) record.round = 1;
    store.enqueue(siteId, "directions", { round: 1, feedback: { reasons: ["fonts"] } });
    expect(await runNext(deps, store)).toBe("done");
    const second = store.directions.filter((d) => d.siteId === siteId && d.round === 1);
    expect(second).toHaveLength(3);
    const usedFonts = new Set(first.map((d) => d.identity.fontPair));
    expect(second.some((d) => !usedFonts.has(d.identity.fontPair))).toBe(true);
    const before = new Set(first.map((d) => d.identity.personality));
    expect(second.filter((d) => !before.has(d.identity.personality)).length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("stores the error masked: no secret of the environment nor key-shaped text (E39)", async () => {
    const { store, siteId, deps } = setup();
    await store.updateSite(siteId, { status: "generating_directions" });
    const job = store.enqueue(siteId, "directions");
    // The AI fails with a message that carries a secret and a key-shaped value.
    const ai = Object.create(deps.ai) as PipelineDeps["ai"];
    ai.generateDirections = async () => {
      throw new Error("auth with value-of-a-secret-123 and sk-ant-api03-abcdef123456 failed");
    };
    const leaky: PipelineDeps = { ...deps, secrets: ["value-of-a-secret-123"], ai };
    expect(await runNext(leaky, store)).toBe("retry");
    expect(await runNext(leaky, store)).toBe("failed");
    const stored = store.jobs.find((item) => item.id === job.id)?.error ?? "";
    expect(stored).toContain("auth with [oculto] and sk-[oculto] failed");
    expect(stored).not.toContain("value-of-a-secret-123");
    expect(stored).not.toContain("abcdef123456");
  });

  it("records the Trigger.dev run of a job (E39)", async () => {
    const { store, siteId } = setup();
    const job = store.enqueue(siteId, "build", { direction: "d1" });
    await store.recordRun(job.id, "run_abc123def");
    expect(store.jobs.find((item) => item.id === job.id)?.payload).toEqual({
      direction: "d1",
      triggerRunId: "run_abc123def",
    });
  });

  it("refuses a photo that is not an image and goes on without it", async () => {
    const { store, siteId, deps } = setup();
    const [first] = store.assets.values();
    if (first) first.data = new TextEncoder().encode("<svg onload=alert(1)>");
    store.enqueue(siteId, "directions");
    expect(await runNext(deps, store)).toBe("done");
    expect(store.events.find((e) => e.kind === "photo_warning")?.message).toMatch(/não é uma foto/);
  });

  it("skips a job whose site moved on", async () => {
    const { store, siteId, deps } = setup();
    await store.updateSite(siteId, { status: "live" });
    store.enqueue(siteId, "build");
    expect(await runNext(deps, store)).toBe("done");
    expect(store.reports).toHaveLength(0);
  });
});
