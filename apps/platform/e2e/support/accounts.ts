import { randomBytes } from "node:crypto";
import { type APIRequestContext, type BrowserContext, expect, type Page } from "@playwright/test";
import { SUPABASE } from "./supabase";

// Accounts in e2e: real round trips through the platform's account routes to the fake Supabase
// (fake-supabase.mjs). Each test gets its own emails and its own IP, so the rate limits of one
// test never touch another.

export const PASSWORD = "Pao-quente-2026";
/** The platform in e2e (playwright.config.ts), for the Origin of API calls made by tests. */
export const BASE = "http://localhost:3100";

export function uniqueEmail(tag: string): string {
  return `${tag}-${randomBytes(4).toString("hex")}@padariadoze.com.br`;
}

/** A different visitor IP for this context (Vercel sets x-forwarded-for in production). */
export async function ownIp(context: BrowserContext): Promise<string> {
  const ip = `198.51.100.${1 + ((randomBytes(1)[0] as number) % 250)}-${randomBytes(3).toString("hex")}`;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  return ip;
}

export async function createUser(
  request: APIRequestContext,
  user: { email: string; password?: string; confirmed?: boolean; fullName?: string },
): Promise<{ id: string }> {
  const response = await request.post(`${SUPABASE}/__test/users`, {
    data: { password: PASSWORD, fullName: "Zé da Padaria", ...user },
  });
  return (await response.json()) as { id: string };
}

interface Mail {
  to: string;
  type: "signup" | "magiclink" | "recovery" | "email_change";
  tokenHash: string;
  redirectTo: string | null;
}

export async function mails(request: APIRequestContext, to: string): Promise<Mail[]> {
  return (await (
    await request.get(`${SUPABASE}/__test/outbox?to=${encodeURIComponent(to)}`)
  ).json()) as Mail[];
}

/** The latest email of a type, waiting for it to arrive. */
export async function lastMail(
  request: APIRequestContext,
  to: string,
  type: Mail["type"],
): Promise<Mail> {
  let found: Mail | undefined;
  await expect
    .poll(async () => {
      found = (await mails(request, to)).filter((mail) => mail.type === type).at(-1);
      return Boolean(found);
    })
    .toBe(true);
  return found as Mail;
}

const linkTypes = {
  signup: "signup",
  magiclink: "email",
  recovery: "recovery",
  email_change: "email_change",
};

/** The link the email template builds (docs/email-templates): token_hash, type and redirect_to. */
export function linkOf(mail: Mail): string {
  const redirect = mail.redirectTo ? `&redirect_to=${encodeURIComponent(mail.redirectTo)}` : "";
  return `/auth/confirm?token_hash=${mail.tokenHash}&type=${linkTypes[mail.type]}${redirect}`;
}

export async function signInWithPassword(
  page: Page,
  email: string,
  password = PASSWORD,
  voltar?: string,
) {
  await page.goto(voltar ? `/entrar?voltar=${encodeURIComponent(voltar)}` : "/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
