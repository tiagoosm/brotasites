import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AiDirector, SimulatedModelClient } from "@brotasites/ai";
import { SimulatedReviewerAgent } from "@brotasites/reviewer";
import { contrastIssues, type FormDraft, siteConfigSchema } from "@brotasites/schema/v1.2";
import { templatesRoot } from "@brotasites/templates";
import { describe, expect, it } from "vitest";
import {
  JOB_KINDS,
  MemoryStore,
  type PipelineDeps,
  type PreviewHost,
  previewBase,
  runJob,
} from "../src/index.js";

const assetsDir = join(templatesRoot, "e2e/fixture-v12/assets");
const photos = readdirSync(assetsDir).filter((file) => file.endsWith(".jpg"));

function setup(draftChange?: (draft: FormDraft) => void) {
  const store = new MemoryStore();
  const siteId = randomUUID();
  const photoIds = photos.slice(0, 3).map((file) => {
    const id = file.replace(/\.jpg$/, "");
    store.assets.set(id, {
      record: { id, bucket: "site-uploads", storagePath: `owner/${siteId}/${file}`, kind: "image" },
      data: readFileSync(join(assetsDir, file)),
    });
    return id;
  });
  const draft: FormDraft = {
    business: {
      name: "Padaria do Zé",
      category: "padaria",
      city: "Santa Rita do Sapucaí",
      state: "MG",
      description:
        "Padaria de bairro com pães de fermentação natural, bolos e café da manhã desde 1998.",
    },
    brand: { logoAsset: null, brandColors: ["#B45309"], feelings: ["acolhedor"] },
    content: {
      services: [
        { name: "Pães artesanais", description: "Feitos todas as manhãs." },
        { name: "Bolos por encomenda", price: "R$ 60,00" },
      ],
      photos: photoIds.map((assetId, index) => ({
        assetId,
        alt: `Foto ${index + 1}`,
        use: index === 0 ? "hero" : undefined,
      })),
    },
    contact: {
      whatsapp: "5535999990000",
      hasFixedAddress: true,
      street: "Rua das Flores",
      number: "123",
      district: "Centro",
      serviceArea: [],
      openingHours: {
        mode: "schedule",
        rules: [{ days: ["mon", "tue", "wed"], intervals: [{ open: "06:00", close: "19:00" }] }],
      },
    },
  };
  draftChange?.(draft);
  store.sites.set(siteId, {
    id: siteId,
    ownerId: "owner-1",
    status: "generating_directions",
    round: 0,
    subdomain: "padaria-do-ze",
    approvedDirection: null,
    previewToken: null,
    draft,
    config: null,
  });
  const uploads: { siteId: string; token: string; html: string }[] = [];
  const previews: PreviewHost = {
    base: previewBase,
    async upload(id, token, distDir) {
      uploads.push({ siteId: id, token, html: readFileSync(join(distDir, "index.html"), "utf8") });
    },
  };
  const deployed: string[] = [];
  const deps: PipelineDeps = {
    store,
    ai: new AiDirector({
      model: new SimulatedModelClient(),
      registry: store.registry,
      cache: store.cache,
    }),
    agent: new SimulatedReviewerAgent(),
    previews,
    publisher: { deploy: async (subdomain) => void deployed.push(subdomain) },
    screenshot: async () => [
      { width: 390, png: Buffer.from("phone") },
      { width: 1280, png: Buffer.from("desktop") },
    ],
    browserChecks: async () => ({ findings: [], screenshots: [] }),
    // A job that fails shows why in the test output.
    log: (message) => console.error(message),
  };
  return { store, siteId, deps, uploads, deployed };
}

async function runNext(deps: PipelineDeps, store: MemoryStore) {
  const job = await store.claimJob(JOB_KINDS);
  if (!job) throw new Error("no job");
  return runJob(deps, job);
}

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
