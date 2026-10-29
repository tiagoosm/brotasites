import { publicPages } from "./site-url";

// The public pages exist twice, prerendered: for visitors and for signed-in people (only the
// menu differs). The proxy, which already reads the session on every request, serves the right
// one under the page's own address; the internal addresses are never reachable directly.

export const PUBLIC_VARIANTS = ["visitante", "logado"] as const;
export type PublicVariant = (typeof PUBLIC_VARIANTS)[number];

const pages: readonly string[] = publicPages;

/** The internal address of a public page for this session, or null for any other path. */
export function publicVariantPath(path: string, signedIn: boolean): string | null {
  const page = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (!pages.includes(page)) return null;
  const variant: PublicVariant = signedIn ? "logado" : "visitante";
  return `/${variant}${page === "/" ? "" : page}`;
}

/** A request for an internal address itself ("/logado/ajuda"): answered as not found. */
export function isVariantPath(path: string): boolean {
  const first = path.split("/")[1] ?? "";
  return (PUBLIC_VARIANTS as readonly string[]).includes(first);
}
