import { z } from "zod";

// Error messages are user-facing, so they are written in pt-BR.

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use uma cor no formato #RRGGBB (ex.: #B45309).");

// 3 to 40 characters: lowercase letters, digits and hyphens, not starting or ending with a hyphen.
export const subdomainSchema = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/,
    "O endereço deve ter de 3 a 40 caracteres, só letras minúsculas, números e hífen, sem começar ou terminar com hífen.",
  );

// Digits only, with country and area code (e.g. 5535999990000).
export const whatsappSchema = z
  .string()
  .regex(
    /^[0-9]{12,13}$/,
    "Informe o WhatsApp só com números, incluindo país e DDD (ex.: 5535999990000).",
  );

export const ctaSchema = z
  .object({
    label: z.string().max(30),
    action: z.enum(["whatsapp", "phone", "link", "scroll"]),
    target: z.string().nullish(),
  })
  // Link buttons open real web addresses only (no javascript:, data: and the like).
  .refine((cta) => cta.action !== "link" || !cta.target || /^https?:\/\/\S+$/i.test(cta.target), {
    path: ["target"],
    error: "Use um endereço que comece com http:// ou https://.",
  });

export type Cta = z.infer<typeof ctaSchema>;
