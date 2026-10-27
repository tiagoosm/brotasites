import { z } from "zod";
import { hexColorSchema } from "../primitives.js";
import { isReservedSubdomain } from "./reserved.js";

// Building blocks of schema 1.2. Error messages are user-facing, so they are written in pt-BR.

export { hexColorSchema };

/** Ids that point into the catalog (variants, font pairs, ornaments, presets). */
export const catalogIdSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, "Use um identificador do catálogo.");

/** Uploaded files (logo, photos) are referenced by their id, never by a URL. */
export const assetIdSchema = z.uuid("Use a referência de um arquivo enviado.");

export const imageSchema = z
  .strictObject({
    assetId: assetIdSchema,
    alt: z.string().trim().max(160, "Descreva a foto em até 160 caracteres."),
    /** The client says the photo shows the face of a child or teenager. */
    showsMinor: z.boolean().optional(),
    /** The client confirms the guardians authorized it (docs/categories.md, Minors). */
    minorConsent: z.literal(true).optional(),
  })
  .refine((image) => !image.showsMinor || image.minorConsent === true, {
    path: ["minorConsent"],
    error: "Confirme que os responsáveis autorizaram o uso da foto.",
  });

/**
 * Removes characters that can disguise text: control characters (line breaks stay) and the
 * bidirectional overrides used to reverse how a name or link reads.
 */
export function cleanText(text: string): string {
  const hidden = (code: number) =>
    (code <= 0x1f && code !== 0x0a) ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0x200e ||
    code === 0x200f;
  return Array.from(text.normalize("NFC"))
    .filter((char) => !hidden(char.codePointAt(0) ?? 0))
    .join("");
}

/**
 * True for the only links a client site may have: https, tel: with digits, mailto: and
 * in-page anchors (docs/security.md). Everything else (javascript:, data:, http:) is false.
 */
export function isSafeHref(href: string): boolean {
  return (
    /^https:\/\/[^\s"'<>]+$/i.test(href) ||
    /^tel:\+?[0-9]{8,15}$/.test(href) ||
    /^mailto:[^\s"'<>:/]+@[^\s"'<>/]+$/i.test(href) ||
    /^#[a-z][a-z0-9-]*$/.test(href)
  );
}

// 3 to 40 characters: lowercase letters, digits and hyphens, not starting or ending with a
// hyphen. A double hyphen is refused, which also refuses punycode ("xn--") look-alikes.
export const subdomainSchema = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/,
    "O endereço deve ter de 3 a 40 caracteres, só letras minúsculas, números e hífen, sem começar ou terminar com hífen.",
  )
  .refine((value) => !value.includes("--"), "O endereço não pode ter dois hífens seguidos.")
  .refine((value) => !isReservedSubdomain(value), "Este endereço não está disponível.");

// Only the format: ownership is verified by the hosting (Cloudflare for SaaS).
export const customDomainSchema = z
  .string()
  .max(253)
  .regex(
    /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    "Use um domínio como padariadoze.com.br, sem http:// e sem barras.",
  );

/** Landline or mobile with area code, digits only (country code 55 optional). */
export const phoneSchema = z
  .string()
  .regex(/^(?:55)?[1-9][0-9][0-9]{8,9}$/, "Informe o telefone só com números, com DDD.");

/** Digits only, 12 or 13, starting with the country code 55. */
export const whatsappSchema = z
  .string()
  .regex(
    /^55[1-9][0-9][0-9]{8,9}$/,
    "Informe o WhatsApp só com números, com o código do Brasil (55) e o DDD (ex.: 5535999990000).",
  );

export const emailSchema = z.email("Informe um e-mail válido.").max(254);

export const zipSchema = z.string().regex(/^[0-9]{5}-?[0-9]{3}$/, "Informe o CEP com 8 números.");

export const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
export const stateSchema = z.enum(states, "Escolha o estado (UF).");

/** Username only: the generator builds the address. */
export const instagramSchema = z
  .string()
  .regex(/^[A-Za-z0-9._]{1,30}$/, "Informe só o nome de usuário do Instagram, sem @.");

/** Page name only (facebook.com/<page>): the generator builds the address. */
export const facebookSchema = z
  .string()
  .regex(/^[A-Za-z0-9.-]{3,50}$/, "Informe só o nome da página do Facebook.");

/** 24-hour "HH:MM". */
export const timeSchema = z
  .string()
  .regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/, "Use o horário no formato 24h, como 08:30.");
