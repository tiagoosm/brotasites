/**
 * The platform's public address, for canonical links, the sitemap and share images.
 * Set NEXT_PUBLIC_PLATFORM_URL when the platform goes online.
 */
export const PLATFORM_URL = (
  process.env.NEXT_PUBLIC_PLATFORM_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

/** Public pages, listed in the sitemap. */
export const publicPages = ["/", "/ajuda", "/termos", "/privacidade"] as const;

/** The base domain of client sites (BASE_DOMAIN), separate from the platform's. */
export const SITES_DOMAIN = (process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "sites.localhost").replace(
  /^\.+|\.+$/g,
  "",
);
