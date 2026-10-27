import type { ImageMetadata } from "astro";

// Uploaded files are referenced by id in a 1.2 config. The generator writes each one next to
// the config as `assets/<id>.<ext>`; "@site" points to the config's folder (astro.config.ts).
const modules = import.meta.glob<{ default: ImageMetadata }>(
  ["@site/**/*.{jpg,jpeg,png,webp}", "!@site/**/node_modules/**"],
  { eager: true },
);

const byId = new Map<string, ImageMetadata>();
for (const [key, module] of Object.entries(modules)) {
  const name = key.replaceAll("\\", "/").split("/").pop() ?? "";
  const id = name.replace(/\.[a-z]+$/i, "");
  if (/^[0-9a-f-]{36}$/i.test(id)) byId.set(id.toLowerCase(), module.default);
}

/** The local image of an asset id, or undefined when the file is missing. */
export function findAsset(assetId: string | null | undefined): ImageMetadata | undefined {
  return assetId ? byId.get(assetId.toLowerCase()) : undefined;
}

/**
 * A photo good enough to fill a wide frame: at least 1200 px on its long side. Smaller ones are
 * "weak" and variants show them smaller (a framed print instead of a full-width strip).
 */
export function isStrongPhoto(image: ImageMetadata | undefined): boolean {
  return Boolean(image && Math.max(image.width, image.height) >= 1200);
}
