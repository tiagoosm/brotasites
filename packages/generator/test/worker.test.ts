import { readFile } from "node:fs/promises";
import {
  applyCategory,
  type SiteDraft,
  setAddress,
  setContact,
  setSectionContent,
  toggleSection,
} from "@brotasites/schema";
import { describe, expect, it } from "vitest";
import { type Job, type JobOutcome, type JobStore, processNextJob } from "../src/index.js";

function readyDraft(): SiteDraft {
  let draft = applyCategory({ business: { name: "Padaria do Zé" } }, "Padaria");
  draft = setAddress(draft, { city: "Santa Rita do Sapucaí" });
  draft = setContact(draft, { whatsapp: "5535999990000" });
  draft = setSectionContent(draft, "sobre", { text: "Desde 1998 na mesma esquina." });
  draft = setSectionContent(draft, "servicos", { items: [{ name: "Pão francês" }] });
  draft = setSectionContent(draft, "faq", { items: [{ question: "Entregam?", answer: "Sim." }] });
  // The browser may send any address; the one reserved in the database must win.
  return { ...toggleSection(draft, "galeria", false), site: { subdomain: "outro" } };
}

function memoryStore(draft: SiteDraft, subdomain: string | null = "padaria-do-ze") {
  const jobs: Job[] = [{ id: "job-1", site_id: "site-1", kind: "generate" }];
  const finished: { job: Job; outcome: JobOutcome }[] = [];
  const store: JobStore = {
    claimNextJob: async () => jobs.shift() ?? null,
    loadSite: async () => ({ subdomain, draft }),
    finishJob: async (job, outcome) => {
      finished.push({ job, outcome });
    },
  };
  return { store, finished };
}

describe("processNextJob", () => {
  it("builds the final config and leaves the site waiting for deployment", async () => {
    const { store, finished } = memoryStore(readyDraft());
    let built: unknown;
    const worked = await processNextJob(store, {
      generate: async ({ configPath, outDir }) => {
        built = JSON.parse(await readFile(configPath, "utf8"));
        return { success: true, outDir, warnings: [] };
      },
    });
    expect(worked).toBe(true);
    expect(built).toMatchObject({ site: { subdomain: "padaria-do-ze" } });
    expect(finished[0]?.outcome).toMatchObject({ ok: true, live: false });
    // Nothing left to do.
    expect(await processNextJob(store)).toBe(false);
  });

  it("marks the site live once a deploy step publishes it", async () => {
    const { store, finished } = memoryStore(readyDraft());
    const deployed: string[] = [];
    await processNextJob(store, {
      generate: async ({ outDir }) => ({ success: true, outDir, warnings: [] }),
      deploy: async (_outDir, config) => {
        deployed.push(config.site.subdomain);
      },
    });
    expect(deployed).toEqual(["padaria-do-ze"]);
    expect(finished[0]?.outcome).toMatchObject({ ok: true, live: true });
  });

  it("fails a draft the schema does not accept, without building", async () => {
    const draft = setSectionContent(readyDraft(), "sobre", { text: "" });
    const { store, finished } = memoryStore(draft);
    let builds = 0;
    await processNextJob(store, {
      generate: async ({ outDir }) => {
        builds += 1;
        return { success: true, outDir, warnings: [] };
      },
    });
    expect(builds).toBe(0);
    expect(finished[0]?.outcome).toMatchObject({ ok: false });
    expect((finished[0]?.outcome as { error?: string } | undefined)?.error).toMatch(/seção Sobre/);
  });

  it("reports build and deploy failures", async () => {
    const { store, finished } = memoryStore(readyDraft());
    await processNextJob(store, {
      generate: async () => ({ success: false, errors: ["Falha ao gerar o site."], warnings: [] }),
    });
    expect(finished[0]?.outcome).toEqual({ ok: false, error: "Falha ao gerar o site." });

    const second = memoryStore(readyDraft());
    await processNextJob(second.store, {
      generate: async ({ outDir }) => ({ success: true, outDir, warnings: [] }),
      deploy: async () => {
        throw new Error("Cloudflare fora do ar");
      },
    });
    expect(second.finished[0]?.outcome).toEqual({ ok: false, error: "Cloudflare fora do ar" });
  });
});
