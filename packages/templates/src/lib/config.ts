import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type SiteConfig, siteConfigSchema } from "@brotasites/schema";

export interface LoadedSiteConfig {
  config: SiteConfig;
  /** Absolute path of the config file. */
  configPath: string;
  /** Directory that image paths in the config are relative to. */
  baseDir: string;
}

/**
 * Loads the site config from BROTASITES_CONFIG (astro.config.ts defaults it to the docs example).
 * The generator validates with friendly messages before building; this is a safety net.
 */
export function loadSiteConfig(): LoadedSiteConfig {
  const envPath = process.env.BROTASITES_CONFIG;
  if (!envPath) throw new Error("BROTASITES_CONFIG is not set.");
  const configPath = resolve(envPath);
  const config = siteConfigSchema.parse(JSON.parse(readFileSync(configPath, "utf8")));
  return { config, configPath, baseDir: dirname(configPath) };
}

export function siteUrl(config: SiteConfig): string {
  const host = config.site.customDomain ?? `${config.site.subdomain}.brotasites.com`;
  return `https://${host}`;
}
