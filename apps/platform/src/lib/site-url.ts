/**
 * The platform's public address, for canonical links, the sitemap and share images.
 * Set NEXT_PUBLIC_PLATFORM_URL when the platform goes online.
 */
export const PLATFORM_URL = (
  process.env.NEXT_PUBLIC_PLATFORM_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

/** Public pages, listed in the sitemap. */
export const publicPages = ["/", "/ajuda", "/termos", "/privacidade"] as const;
