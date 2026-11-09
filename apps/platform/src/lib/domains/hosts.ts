import { registrableDomain } from "./validate";

// Every address the platform knows about, in one place (E28), read from the environment and
// never written by hand elsewhere. The rule (docs/security.md): the platform and the client
// sites always live on different registrable domains (today brotasites.com.br for the
// platform and brotasites.com for the sites), so a client site can never read the platform's
// cookies and an abusive site cannot hurt the platform's reputation.
//
// Each NEXT_PUBLIC_ variable is read by its full name, so Next.js can inline it in the
// browser's bundle too. Development and tests keep localhost and sites.localhost.

export interface HostsEnv {
  NEXT_PUBLIC_PLATFORM_URL?: string;
  NEXT_PUBLIC_ADMIN_HOST?: string;
  NEXT_PUBLIC_BASE_DOMAIN?: string;
  NEXT_PUBLIC_PREVIEW_ORIGIN?: string;
  NEXT_PUBLIC_CONTACT_EMAIL?: string;
  NEXT_PUBLIC_PRIVACY_EMAIL?: string;
  NEXT_PUBLIC_ABUSE_EMAIL?: string;
}

export interface Hosts {
  /** The platform's address, without a trailing slash ("https://brotasites.com.br"). */
  platformUrl: string;
  /** Its host ("brotasites.com.br"). */
  platformHost: string;
  /** The team's own host ("admin.brotasites.com.br"), or null: then /admin stays on the platform. */
  adminHost: string | null;
  /** The client sites' base domain (BASE_DOMAIN, "brotasites.com"). */
  sitesDomain: string;
  /** The domain shown in examples on screen: the real one, or brotasites.com in development. */
  exampleSitesDomain: string;
  /** Where the finished-site previews are served ("https://previa.brotasites.com"). */
  previewOrigin: string;
  /** Contact, privacy and abuse addresses, or null while the platform has no real domain. */
  contactEmail: string | null;
  privacyEmail: string | null;
  abuseEmail: string | null;
}

const DEV_PLATFORM = "http://localhost:3000";
const DEV_SITES = "sites.localhost";
const DEV_PREVIEW = "http://127.0.0.1:4500";
/** The example's domain before the real one is set (the owner's sites domain). */
const EXAMPLE_FALLBACK = "brotasites.com";

const clean = (value: string | undefined) => value?.trim() || undefined;
const bareDomain = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");

/** A host name that only exists on this machine or in tests. */
export function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".test")
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function emailFor(explicit: string | undefined, local: string, platformHost: string) {
  const value = clean(explicit);
  if (value) return value.toLowerCase();
  return platformHost && !isLocalHost(platformHost) ? `${local}@${platformHost}` : null;
}

export function readHosts(env: HostsEnv & Record<string, string | undefined>): Hosts {
  const platformUrl = (clean(env.NEXT_PUBLIC_PLATFORM_URL) ?? DEV_PLATFORM).replace(/\/+$/, "");
  const platformHost = hostOf(platformUrl);
  const admin = clean(env.NEXT_PUBLIC_ADMIN_HOST);
  const sitesDomain = bareDomain(clean(env.NEXT_PUBLIC_BASE_DOMAIN) ?? DEV_SITES);
  return {
    platformUrl,
    platformHost,
    adminHost: admin ? bareDomain(admin) : null,
    sitesDomain,
    exampleSitesDomain: isLocalHost(sitesDomain) ? EXAMPLE_FALLBACK : sitesDomain,
    previewOrigin: (clean(env.NEXT_PUBLIC_PREVIEW_ORIGIN) ?? DEV_PREVIEW).replace(/\/+$/, ""),
    contactEmail: emailFor(env.NEXT_PUBLIC_CONTACT_EMAIL, "contato", platformHost),
    privacyEmail: emailFor(env.NEXT_PUBLIC_PRIVACY_EMAIL, "privacidade", platformHost),
    abuseEmail: emailFor(env.NEXT_PUBLIC_ABUSE_EMAIL, "abuso", platformHost),
  };
}

/** This deployment's addresses. */
export const hosts: Hosts = readHosts({
  NEXT_PUBLIC_PLATFORM_URL: process.env.NEXT_PUBLIC_PLATFORM_URL,
  NEXT_PUBLIC_ADMIN_HOST: process.env.NEXT_PUBLIC_ADMIN_HOST,
  NEXT_PUBLIC_BASE_DOMAIN: process.env.NEXT_PUBLIC_BASE_DOMAIN,
  NEXT_PUBLIC_PREVIEW_ORIGIN: process.env.NEXT_PUBLIC_PREVIEW_ORIGIN,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  NEXT_PUBLIC_PRIVACY_EMAIL: process.env.NEXT_PUBLIC_PRIVACY_EMAIL,
  NEXT_PUBLIC_ABUSE_EMAIL: process.env.NEXT_PUBLIC_ABUSE_EMAIL,
});

/** The platform's own hosts (address, admin, previews): none can be a client's domain. */
export function ownHosts(value: Hosts = hosts): string[] {
  return [value.platformHost, value.adminHost, hostOf(value.previewOrigin)].filter(
    (host): host is string => Boolean(host),
  );
}

/**
 * A link to a page of the team's area: the local path, or the full address on the admin host
 * when there is one ("/admin/sites" or "https://admin.brotasites.com.br/admin/sites").
 */
export function adminUrl(path = "/admin", value: Hosts = hosts): string {
  const local = path.startsWith("/") ? path : `/${path}`;
  if (!value.adminHost) return local;
  const scheme = value.platformUrl.startsWith("http://") ? "http" : "https";
  return `${scheme}://${value.adminHost}${local}`;
}

/**
 * The production check (docs/security.md): both addresses set, and the platform and the sites
 * on different registrable domains, with the admin host under the platform's. Returns the
 * problems in plain English, empty when all is well.
 */
export function productionHostProblems(
  env: HostsEnv & Record<string, string | undefined>,
): string[] {
  const problems: string[] = [];
  if (!clean(env.NEXT_PUBLIC_PLATFORM_URL)) problems.push("NEXT_PUBLIC_PLATFORM_URL is not set.");
  if (!clean(env.NEXT_PUBLIC_BASE_DOMAIN)) problems.push("NEXT_PUBLIC_BASE_DOMAIN is not set.");
  if (problems.length) return problems;
  const value = readHosts(env);
  if (!value.platformHost) {
    return ["NEXT_PUBLIC_PLATFORM_URL is not a valid address (https://brotasites.com.br)."];
  }
  if (!value.platformUrl.startsWith("https://")) {
    problems.push("NEXT_PUBLIC_PLATFORM_URL must use https://.");
  }
  const platform = value.platformHost;
  const sites = value.sitesDomain;
  if (
    platform === sites ||
    platform.endsWith(`.${sites}`) ||
    sites.endsWith(`.${platform}`) ||
    (registrableDomain(platform) ?? platform) === (registrableDomain(sites) ?? sites)
  ) {
    problems.push(
      `The platform (${platform}) and the client sites (${sites}) must be on different registrable domains.`,
    );
  }
  if (value.adminHost) {
    const admin = value.adminHost;
    const platformDomain = registrableDomain(platform) ?? platform;
    if (admin === platform || !admin.endsWith(`.${platformDomain}`)) {
      problems.push(
        `NEXT_PUBLIC_ADMIN_HOST (${admin}) must be a subdomain of the platform's domain (${platformDomain}).`,
      );
    }
  }
  return problems;
}

/**
 * Refuses a production deployment with wrong addresses, loudly (called by next.config.ts at
 * build and start). "Production" is Vercel's production environment, or BROTASITES_STRICT_HOSTS=1
 * on any other host: local builds, CI and Vercel previews keep the development defaults.
 */
export function assertProductionHosts(env: Record<string, string | undefined>): void {
  if (env.VERCEL_ENV !== "production" && env.BROTASITES_STRICT_HOSTS !== "1") return;
  const problems = productionHostProblems(env);
  if (problems.length) {
    throw new Error(
      `BrotaSites refuses to run in production with these addresses (docs/security.md):\n- ${problems.join("\n- ")}`,
    );
  }
}
