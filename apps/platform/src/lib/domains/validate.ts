import { imitationWords } from "@brotasites/schema/v1.2";
import { PUBLIC_SUFFIX_RULES } from "./public-suffixes";

// The check of a client's own domain (E25, docs/security.md), on the server: the format, the
// public suffix (the Public Suffix List, ICANN section), and the names nobody may connect
// (the platform's own, test and reserved names, imitations of banks, government and brands).
// Ownership is proved later by the hosting (Cloudflare for SaaS); this only refuses early.
//
// The "www" pair: the hosting's free plans connect a hostname by a CNAME record, which most
// registrars do not allow at the root of a domain, and "apex proxying" is an Enterprise add-on
// (developers.cloudflare.com, Cloudflare for SaaS, Plans). So a domain typed as
// "seunegocio.com.br" or "www.seunegocio.com.br" connects "www.seunegocio.com.br", and the root
// is its alias: the client redirects it to the www at the registrar (most offer it), and the
// Worker redirects it too if it ever reaches us. Any other subdomain (loja.seunegocio.com.br)
// connects as typed, without an alias.

export type DomainProblem =
  | "empty"
  | "format"
  | "too_long"
  | "not_ascii"
  | "punycode"
  | "wildcard"
  | "ip"
  | "reserved"
  | "no_suffix"
  | "platform"
  | "protected";

export type DomainCheck =
  | { ok: true; host: string; alias: string | null; registrable: string }
  | { ok: false; problem: DomainProblem; message: string };

const messages: Record<DomainProblem, string> = {
  empty: "Escreva o seu domínio, como seunegocio.com.br.",
  format: "Escreva só o domínio, como seunegocio.com.br, sem http://, barras, porta ou espaços.",
  too_long: "Esse domínio é longo demais. Confira se digitou certo.",
  not_ascii:
    "Use só letras sem acento, números, hífen e ponto. Domínios com acento ainda não são aceitos.",
  punycode: "Domínios com acento ou letras especiais ainda não são aceitos.",
  wildcard: "Use um domínio só, sem asterisco.",
  ip: "Use um domínio, como seunegocio.com.br, e não um número de IP.",
  reserved: "Esse é um domínio de teste ou reservado. Use o domínio do seu negócio.",
  no_suffix: "Esse domínio não parece completo. Use algo como seunegocio.com.br.",
  platform: "Esse domínio é da BrotaSites. Use o domínio do seu negócio.",
  protected:
    "Esse domínio parece de um banco, de um órgão público ou de outra marca, e não pode ser conectado.",
};

const fail = (problem: DomainProblem): DomainCheck => ({
  ok: false,
  problem,
  message: messages[problem],
});

/** Top-level names for tests and private networks (RFC 2606, 6761, 6762, 8375). */
const RESERVED_TLDS = new Set([
  "test",
  "example",
  "invalid",
  "localhost",
  "local",
  "onion",
  "internal",
  "lan",
  "home",
  "arpa",
  "localdomain",
]);
const RESERVED_DOMAINS = new Set(["example.com", "example.net", "example.org"]);
/** Suffixes only government, justice, the armed forces and banks can register in Brazil. */
const PROTECTED_SUFFIXES = new Set([
  "gov.br",
  "jus.br",
  "leg.br",
  "mil.br",
  "mp.br",
  "def.br",
  "b.br",
  "gov",
]);
/** Hosting and testing addresses that never belong to a client's business. */
const PLATFORM_SUFFIXES = [
  "vercel.app",
  "workers.dev",
  "pages.dev",
  "brotasites.com",
  "brotasites.com.br",
];
/** Brand words long enough to refuse even inside a longer name (bancodobrasil, meunubank). */
const LONG_IMITATIONS = [...imitationWords].filter((word) => word.length >= 6);

let rules: { exact: Set<string>; wildcard: Set<string>; exception: Set<string> } | null = null;

function suffixRules() {
  if (!rules) {
    rules = { exact: new Set(), wildcard: new Set(), exception: new Set() };
    for (const rule of PUBLIC_SUFFIX_RULES.split(" ")) {
      if (rule.startsWith("!")) rules.exception.add(rule.slice(1));
      else if (rule.startsWith("*.")) rules.wildcard.add(rule.slice(2));
      else rules.exact.add(rule);
    }
  }
  return rules;
}

/** The public suffix of a host (com.br, com, co.uk), by the Public Suffix List's algorithm. */
export function publicSuffix(host: string): string | null {
  const { exact, wildcard, exception } = suffixRules();
  const labels = host.split(".");
  for (let i = 0; i < labels.length; i++) {
    const candidate = labels.slice(i).join(".");
    if (exception.has(candidate)) return labels.slice(i + 1).join(".");
    if (exact.has(candidate)) return candidate;
    const parent = labels.slice(i + 1).join(".");
    if (parent && wildcard.has(parent)) return candidate;
  }
  return null;
}

/** The domain a person registers: the public suffix and one label before it. */
export function registrableDomain(host: string): string | null {
  const suffix = publicSuffix(host);
  if (!suffix || suffix === host) return null;
  const rest = host.slice(0, -(suffix.length + 1)).split(".");
  return `${rest[rest.length - 1]}.${suffix}`;
}

/** Postel: the common ways people write a domain, tidied; anything else stays for the checks. */
export function tidyDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/\.$/, "");
}

export interface DomainContext {
  /** The base domain of the client sites (BASE_DOMAIN). */
  baseDomain: string;
  /** The platform's own hosts (its address, the previews' address). */
  platformHosts?: readonly string[];
}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function checkDomain(raw: string, context: DomainContext): DomainCheck {
  const host = tidyDomain(raw ?? "");
  if (!host) return fail("empty");
  if (/[^\x21-\x7e]/.test(host)) return /\s/.test(host) ? fail("format") : fail("not_ascii");
  if (host.includes("*")) return fail("wildcard");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return fail("ip");
  if (/[/:?#@\\]/.test(host)) return fail("format");
  if (host.length > 253) return fail("too_long");
  const labels = host.split(".");
  if (labels.length < 2) return fail("no_suffix");
  if (labels.some((label) => label.startsWith("xn--"))) return fail("punycode");
  if (labels.some((label) => label.length > 63)) return fail("too_long");
  if (!labels.every((label) => LABEL.test(label))) return fail("format");

  // The platform's own addresses first: in development the base domain is a test name.
  const own = [context.baseDomain, ...(context.platformHosts ?? []), ...PLATFORM_SUFFIXES]
    .map((value) => value.toLowerCase())
    .filter(Boolean);
  if (own.some((domain) => host === domain || host.endsWith(`.${domain}`))) return fail("platform");

  const tld = labels[labels.length - 1] as string;
  if (RESERVED_TLDS.has(tld)) return fail("reserved");
  const registrable = registrableDomain(host);
  if (!registrable) return fail("no_suffix");
  if (RESERVED_DOMAINS.has(registrable)) return fail("reserved");
  if (own.includes(registrable)) return fail("platform");

  const suffix = publicSuffix(host) ?? "";
  if (PROTECTED_SUFFIXES.has(suffix)) return fail("protected");
  const name = registrable.slice(0, -(suffix.length + 1));
  const words = labels.flatMap((label) => label.split("-"));
  if (
    words.some((word) => imitationWords.has(word)) ||
    LONG_IMITATIONS.some((word) => name.includes(word))
  ) {
    return fail("protected");
  }

  // The www pair (see the top of this file).
  if (host === registrable || host === `www.${registrable}`) {
    return { ok: true, host: `www.${registrable}`, alias: registrable, registrable };
  }
  return { ok: true, host, alias: null, registrable };
}

/** The platform's own hosts, from its environment (never connectable as a client domain). */
export function platformHosts(env: Record<string, string | undefined> = process.env): string[] {
  const hosts: string[] = [];
  for (const value of [env.NEXT_PUBLIC_PLATFORM_URL, env.NEXT_PUBLIC_PREVIEW_ORIGIN]) {
    try {
      if (value) hosts.push(new URL(value).hostname);
    } catch {
      // Not a URL: nothing to add.
    }
  }
  return hosts;
}
