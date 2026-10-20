import { access } from "node:fs/promises";
import { resolve } from "node:path";
import type { SiteConfig } from "@brotasites/schema";

const supportedImage = /\.(jpe?g|png|webp|avif)$/i;

interface ImageRef {
  path: string;
  where: string;
}

function referencedImages(config: SiteConfig): ImageRef[] {
  const refs: ImageRef[] = [];
  if (config.business.logo) refs.push({ path: config.business.logo, where: "logo" });
  for (const section of config.sections) {
    if (!section.enabled) continue;
    if (section.id === "hero" && section.content.image) {
      refs.push({ path: section.content.image, where: 'seção "Hero"' });
    }
    if (section.id === "sobre" && section.content.image) {
      refs.push({ path: section.content.image, where: 'seção "Sobre"' });
    }
    if (section.id === "galeria") {
      for (const path of section.content.images) refs.push({ path, where: 'seção "Galeria"' });
    }
  }
  return refs;
}

/** Lists pt-BR warnings for images that are missing or in an unsupported format. */
export async function checkImages(config: SiteConfig, baseDir: string): Promise<string[]> {
  const warnings: string[] = [];
  for (const { path, where } of referencedImages(config)) {
    if (!supportedImage.test(path)) {
      warnings.push(
        `Imagem em formato não suportado (${where}): ${path}. Use JPG, PNG, WebP ou AVIF.`,
      );
      continue;
    }
    try {
      await access(resolve(baseDir, path));
    } catch {
      warnings.push(`Imagem não encontrada (${where}): ${path}. O site será gerado sem ela.`);
    }
  }
  return warnings;
}
