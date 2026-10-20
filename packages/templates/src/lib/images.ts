import type { ImageMetadata } from "astro";

// "@site" points to the config file's folder (see astro.config.ts).
const modules = import.meta.glob<{ default: ImageMetadata }>(
  ["@site/**/*.{jpg,jpeg,png,webp,avif}", "!@site/**/node_modules/**"],
  { eager: true },
);

const images = Object.entries(modules).map(([key, module]) => ({
  key: key.replaceAll("\\", "/"),
  image: module.default,
}));

/** Finds an image referenced in the config (e.g. "assets/hero.jpg"). Missing images return undefined. */
export function findImage(path: string | null | undefined): ImageMetadata | undefined {
  if (!path) return undefined;
  const suffix = `/${path.replaceAll("\\", "/").replace(/^\.?\//, "")}`;
  return images.find(({ key }) => key.endsWith(suffix))?.image;
}
