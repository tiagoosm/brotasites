import { type SiteConfig, siteConfigSchema } from "@brotasites/schema";

export type PreviewRequest =
  | { ok: true; config: SiteConfig; scroll: number; animate: boolean }
  | { ok: false; status: number; message: string };

/** Origins allowed to embed the preview (CSP frame-ancestors). */
export function frameAncestors(): string {
  return (
    process.env.PREVIEW_FRAME_ANCESTORS ?? "'self' http://localhost:3000 http://localhost:3100"
  );
}

/**
 * Reads a preview request posted by the form: `config` (JSON), `scroll` (pixels to restore)
 * and `animate` ("0" skips the entrance animations on refreshes).
 */
export async function readPreviewRequest(
  request: Request,
  fallback: unknown,
): Promise<PreviewRequest> {
  if (request.method !== "POST") {
    const parsed = siteConfigSchema.safeParse(fallback);
    return parsed.success
      ? { ok: true, config: parsed.data, scroll: 0, animate: true }
      : { ok: false, status: 500, message: "Exemplo inválido." };
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, status: 400, message: "Envie o rascunho como formulário." };
  }

  let data: unknown;
  try {
    data = JSON.parse(String(form.get("config") ?? ""));
  } catch {
    return { ok: false, status: 400, message: "O rascunho não é um JSON válido." };
  }

  const parsed = siteConfigSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, status: 422, message: "O rascunho não passou na validação." };
  }

  const scroll = Math.max(0, Math.round(Number(form.get("scroll")) || 0));
  return { ok: true, config: parsed.data, scroll, animate: form.get("animate") !== "0" };
}
