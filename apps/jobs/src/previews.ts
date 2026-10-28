import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { deployToR2, type R2Options, uploadPreviewToR2 } from "@brotasites/generator";

// Where finished sites go: a private preview (previa.<domain>/<site>/<token>/) before the client
// approves, and the live site after payment. On R2 in production; a local folder in development,
// served by the local runner (local.ts).

export interface PreviewHost {
  /** The base path the site must be built with. */
  base(siteId: string, token: string): string;
  upload(siteId: string, token: string, distDir: string): Promise<void>;
}

export interface Publisher {
  deploy(subdomain: string, distDir: string): Promise<void>;
}

export const previewBase = (siteId: string, token: string) => `/${siteId}/${token}/`;

export class R2PreviewHost implements PreviewHost {
  constructor(private readonly r2: R2Options) {}
  base = previewBase;
  async upload(siteId: string, token: string, distDir: string) {
    await uploadPreviewToR2(distDir, siteId, token, this.r2);
  }
}

export class R2Publisher implements Publisher {
  constructor(private readonly r2: R2Options) {}
  async deploy(subdomain: string, distDir: string) {
    await deployToR2(distDir, { site: { subdomain } }, { ...this.r2, strictCsp: true });
  }
}

/** Development: previews in a folder served at PREVIEW_ORIGIN by the local runner. */
export class LocalPreviewHost implements PreviewHost {
  constructor(private readonly root: string) {}
  base = previewBase;
  async upload(siteId: string, token: string, distDir: string) {
    const target = join(this.root, siteId, token);
    await rm(join(this.root, siteId), { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    await cp(distDir, target, { recursive: true });
  }
}
