import { hosts } from "@/lib/domains/hosts";

// Who answers for BrotaSites and how to reach them (E28): email addresses only, no contact form
// (a form would need a CAPTCHA, limits and storage). The addresses come from the environment
// (lib/domains/hosts.ts: contato@, privacidade@ and abuso@ the platform's domain by default);
// until the platform has a real domain, pages say "a definir" instead. The responsible party is
// still pending (decision of 2026-10-24).

export const CONTACT_EMAIL: string | null = hosts.contactEmail;
export const PRIVACY_EMAIL: string | null = hosts.privacyEmail;
export const ABUSE_EMAIL: string | null = hosts.abuseEmail;
export const RESPONSIBLE_PARTY: string | null = null;
export const PENDING = "a definir";
