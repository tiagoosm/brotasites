import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { fieldErrors } from "@/lib/auth/schemas";

// What every route that changes something checks first (docs/security.md, accounts): the
// request comes from a page of the platform itself, as JSON, with a body that passes its
// schema. Responses never carry secrets, tokens or the person's full email.

export const NO_STORE = { "cache-control": "no-store", "x-robots-tag": "noindex" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function refuse(status: number, error: string, fields?: Record<string, string>) {
  return json(fields ? { error, fields } : { error }, status);
}

export const guardErrors = {
  origin: "Pedido recusado. Atualize a página e tente de novo.",
  invalid: "Confira os campos destacados.",
  rateLimited: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
  unavailable: "Isso não está disponível agora. Tente de novo mais tarde.",
} as const;

/** The platform's own origins: the request's and NEXT_PUBLIC_PLATFORM_URL. */
function allowedOrigins(request: Request): Set<string> {
  const origins = new Set([new URL(request.url).origin]);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  if (host) origins.add(`${proto}://${host}`);
  const platform = process.env.NEXT_PUBLIC_PLATFORM_URL?.replace(/\/+$/, "");
  if (platform) origins.add(platform);
  return origins;
}

/**
 * CSRF: a POST counts only from the platform's own pages. Browsers send Origin on every POST
 * from a page; a missing Origin is refused too.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin) && allowedOrigins(request).has(origin as string);
}

/** Origin, JSON and schema, in that order; the parsed body or the response to send. */
export async function readBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.output<T> } | { error: NextResponse }> {
  if (request.method !== "POST" || !sameOrigin(request)) {
    return { error: refuse(403, guardErrors.origin) };
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return { error: refuse(415, guardErrors.origin) };
  }
  const raw = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: refuse(400, guardErrors.invalid, fieldErrors(parsed.error)) };
  }
  return { data: parsed.data };
}

/** The visitor's IP as Vercel reports it (the first address of x-forwarded-for). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

/** A rate-limit key that never stores the email or the IP itself. */
export function limitKey(kind: string, value: string): string {
  return `${kind}:${createHash("sha256").update(`brotasites|${kind}|${value.toLowerCase()}`).digest("hex").slice(0, 40)}`;
}

/** "z***@padariadoze.com.br", for messages and logs: never the full address. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Answers no sooner than `ms` after `started`, so an existing and a new email take about the
 * same time (no account enumeration by timing).
 */
export async function steadyPace(started: number, ms = 800): Promise<void> {
  const wait = started + ms - Date.now();
  if (wait > 0) await new Promise((done) => setTimeout(done, wait));
}
