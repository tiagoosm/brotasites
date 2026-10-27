import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type SiteConfig, siteConfigSchema } from "@brotasites/schema";
import {
  cleanText,
  type SiteConfig as SiteConfig12,
  siteConfigSchema as siteConfig12Schema,
} from "@brotasites/schema/v1.2";

/** Every string of a config, cleaned of control characters and bidirectional overrides. */
function cleanStrings(value: unknown): unknown {
  if (typeof value === "string") return cleanText(value);
  if (Array.isArray(value)) return value.map(cleanStrings);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cleanStrings(item)]),
    );
  }
  return value;
}

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

export type AnyLoadedConfig =
  | { version: "1.1"; config: SiteConfig; configPath: string; baseDir: string }
  | { version: "1.2"; config: SiteConfig12; configPath: string; baseDir: string };

/**
 * Loads a config of either version: 1.2 renders the catalog template (src/v12), 1.1 the
 * "classico" template the live product still uses until the platform moves to 1.2 (E10).
 */
export function loadAnyConfig(): AnyLoadedConfig {
  const envPath = process.env.BROTASITES_CONFIG;
  if (!envPath) throw new Error("BROTASITES_CONFIG is not set.");
  const configPath = resolve(envPath);
  const raw = JSON.parse(readFileSync(configPath, "utf8"));
  const baseDir = dirname(configPath);
  if (raw?.schemaVersion === "1.2") {
    return {
      version: "1.2",
      config: siteConfig12Schema.parse(cleanStrings(raw)),
      configPath,
      baseDir,
    };
  }
  return { version: "1.1", config: siteConfigSchema.parse(raw), configPath, baseDir };
}

/** Domain client sites live under (docs/hosting.md); `sites.localhost` in development. */
export function baseDomain(): string {
  return process.env.BASE_DOMAIN || "sites.localhost";
}

/** Address of a 1.2 site: its own domain, or its subdomain of BASE_DOMAIN. */
export function siteUrl12(config: SiteConfig12): string {
  return `https://${config.site.customDomain ?? `${config.site.subdomain}.${baseDomain()}`}`;
}

export function siteUrl(config: SiteConfig): string {
  const host = config.site.customDomain ?? `${config.site.subdomain}.brotasites.com`;
  return `https://${host}`;
}
