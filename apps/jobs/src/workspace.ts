import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanImage, ImageRejected } from "@brotasites/generator";
import type { SiteConfig } from "@brotasites/schema/v1.2";
import type { AssetRecord, PipelineStore } from "./store.js";

// A job's scratch folder: the config, the cleaned photos next to it (assets/<id>.webp, where
// the templates look for them) and the builds.

export interface Workspace {
  dir: string;
  /** Asset ids whose photo passed the pipeline. */
  assets: Set<string>;
  /** Some photo is big enough to fill a wide frame (the engine picks variants by this). */
  strongPhoto: boolean;
  /** pt-BR notes about refused or weak photos. */
  warnings: string[];
  writeConfig(config: SiteConfig | object): Promise<string>;
  dispose(): Promise<void>;
}

/** Downloads every photo the client sent and keeps only the cleaned copies (docs/security.md). */
export async function prepareWorkspace(store: PipelineStore, siteId: string): Promise<Workspace> {
  const dir = await mkdtemp(join(tmpdir(), `brotasites-job-${siteId.slice(0, 8)}-`));
  await mkdir(join(dir, "assets"));
  const assets = new Set<string>();
  const warnings: string[] = [];
  let strongPhoto = false;
  for (const asset of await store.listAssets(siteId)) {
    try {
      const clean = await cleanImage(await store.downloadAsset(asset));
      await writeFile(join(dir, "assets", `${asset.id}.webp`), clean.data);
      assets.add(asset.id);
      if (asset.kind === "image" && clean.strong) strongPhoto = true;
    } catch (error) {
      warnings.push(photoWarning(asset, error));
    }
  }
  return {
    dir,
    assets,
    strongPhoto,
    warnings,
    async writeConfig(config) {
      const path = join(dir, "site-config.json");
      await writeFile(path, JSON.stringify(config, null, 2));
      return path;
    },
    dispose: () => rm(dir, { recursive: true, force: true }),
  };
}

function photoWarning(asset: AssetRecord, error: unknown): string {
  const what = asset.kind === "logo" ? "O logo" : "Uma foto";
  if (error instanceof ImageRejected) return `${what} não pôde ser usada: ${error.message}`;
  return `${what} não pôde ser lida e ficou de fora.`;
}
