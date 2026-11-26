import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AiDirector, SimulatedModelClient } from "@brotasites/ai";
import { SimulatedReviewerAgent } from "@brotasites/reviewer";
import type { FormDraft } from "@brotasites/schema/v1.2";
import { templatesRoot } from "@brotasites/templates";
import {
  JOB_KINDS,
  MemoryStore,
  type PipelineDeps,
  type PreviewHost,
  previewBase,
  runJob,
} from "../src/index.js";

// The pipeline over the in-memory store, with the simulated AI and agent (test/pipeline.test.ts
// and the real build in test/e2e/build-real.test.ts).

const assetsDir = join(templatesRoot, "e2e/fixture-v12/assets");
const photos = readdirSync(assetsDir).filter((file) => file.endsWith(".jpg"));

export function setup(draftChange?: (draft: FormDraft) => void) {
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

export async function runNext(deps: PipelineDeps, store: MemoryStore) {
  const job = await store.claimJob(JOB_KINDS);
  if (!job) throw new Error("no job");
  return runJob(deps, job);
}
