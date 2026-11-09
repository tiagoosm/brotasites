import { hosts } from "./domains/hosts";

/**
 * The platform's public address, for canonical links, the sitemap and share images
 * (NEXT_PUBLIC_PLATFORM_URL, read in lib/domains/hosts.ts with every other address).
 */
export const PLATFORM_URL = hosts.platformUrl;

/** Public pages, listed in the sitemap. */
export const publicPages = ["/", "/ajuda", "/termos", "/privacidade"] as const;

/** The base domain of client sites (BASE_DOMAIN), separate from the platform's. */
export const SITES_DOMAIN = hosts.sitesDomain;

/** The sites' domain for examples on screen ("seunegocio.brotasites.com"). */
export const EXAMPLE_SITES_DOMAIN = hosts.exampleSitesDomain;
