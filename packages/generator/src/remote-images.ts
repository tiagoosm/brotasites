import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SiteConfig } from "@brotasites/schema";

// Photos uploaded in the form are referenced by web address. Before building, they are
// downloaded next to the config, so the site serves optimized local copies and never
// depends on the platform's storage. Only allowed hosts are fetched (the platform's own
// storage), since configs come from clients.

// No leading dot: the templates look images up with a glob that skips hidden folders.
export const IMAGES_DIR = "_brotasites-images";
const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export interface RemoteImageOptions {
  /** Hosts photos may come from. Default: Supabase Storage (*.supabase.co). */
  allowedHosts?: string[];
  fetch?: typeof fetch;
}

function allowed(url: URL, hosts: string[] | undefined): boolean {
  if (url.protocol !== "https:") return false;
  if (!hosts) return url.hostname.endsWith(".supabase.co");
  return hosts.some((host) => url.hostname === host);
}

const isRemote = (path: string | null | undefined): path is string =>
  typeof path === "string" && /^[a-z][a-z0-9+.-]*:/i.test(path);

/**
 * Downloads every remote photo in the config into `<baseDir>/.brotasites-images` and returns
 * a config pointing to the local copies. Photos that cannot be used are left out, with a
 * pt-BR warning, so the site is still built.
 */
export async function localizeRemoteImages(
  config: SiteConfig,
  baseDir: string,
  options: RemoteImageOptions = {},
): Promise<{ config: SiteConfig; warnings: string[]; downloaded: number }> {
  const doFetch = options.fetch ?? fetch;
  const warnings: string[] = [];
  const cache = new Map<string, string | null>();
  let downloaded = 0;

  async function localize(path: string | null | undefined, where: string) {
    if (!isRemote(path)) return path;
    if (cache.has(path)) return cache.get(path) ?? null;
    let local: string | null = null;
    try {
      const url = new URL(path);
      if (!allowed(url, options.allowedHosts)) throw new Error("endereço não permitido");
      const response = await doFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) throw new Error(`resposta ${response.status}`);
      const type = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      const extension = extensions[type];
      if (!extension) throw new Error("formato não suportado");
      const body = Buffer.from(await response.arrayBuffer());
      if (body.byteLength > MAX_BYTES) throw new Error("arquivo grande demais");
      const name = `${createHash("sha256").update(path).digest("hex").slice(0, 16)}.${extension}`;
      await mkdir(join(baseDir, IMAGES_DIR), { recursive: true });
      await writeFile(join(baseDir, IMAGES_DIR, name), body);
      local = `${IMAGES_DIR}/${name}`;
      downloaded += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      warnings.push(
        `Não foi possível baixar a foto (${where}): ${path} (${reason}). O site será gerado sem ela.`,
      );
    }
    cache.set(path, local);
    return local;
  }

  const business = { ...config.business, logo: await localize(config.business.logo, "logo") };
  const sections: SiteConfig["sections"] = [];
  for (const section of config.sections) {
    if (section.id === "hero" || section.id === "sobre") {
      const where = section.id === "hero" ? 'seção "Hero"' : 'seção "Sobre"';
      const image = await localize(section.content.image, where);
      sections.push({ ...section, content: { ...section.content, image } } as typeof section);
    } else if (section.id === "galeria") {
      const images: string[] = [];
      for (const path of section.content.images) {
        const local = await localize(path, 'seção "Galeria"');
        if (local) images.push(local);
      }
      sections.push({ ...section, content: { ...section.content, images } });
    } else {
      sections.push(section);
    }
  }
  return { config: { ...config, business, sections }, warnings, downloaded };
}
