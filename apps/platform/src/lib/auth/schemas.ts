import { z } from "zod";
import { PASSWORD_MAX, passwordProblem } from "./passwords";

// What the account routes accept (checked again on the server for every request). Messages
// are pt-BR, shown next to the field.

/** The terms in force; the database accepts only this one (accounts migration). */
export const TERMS_VERSION = "2026-10-draft";

export const emailSchema = z
  .string("Informe o seu e-mail.")
  .trim()
  .toLowerCase()
  .max(254, "Use um e-mail mais curto.")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Escreva um e-mail válido, como voce@exemplo.com.");

export const fullNameSchema = z
  .string("Informe o seu nome.")
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(2, "Informe o seu nome.")
      .max(80, "Use até 80 caracteres.")
      .regex(/^[\p{L}\p{M}' .-]+$/u, "Use só letras, espaços, apóstrofo, ponto ou hífen."),
  );

/** A Brazilian phone typed in any format, stored in E.164 ("+5535999990000"). */
export const phoneSchema = z
  .string()
  .transform((value) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    if (value.trim().startsWith("+")) return `+${digits}`;
    return digits.length === 10 || digits.length === 11 ? `+55${digits}` : `+${digits}`;
  })
  .pipe(
    z.string().regex(/^(\+[1-9][0-9]{7,14})?$/, "Escreva o número com DDD, como (35) 99999-0000."),
  );

export const passwordSchema = z
  .string("Escolha uma senha.")
  .max(PASSWORD_MAX, `Use até ${PASSWORD_MAX} caracteres.`);

/** Checks a new password against the rules and the email it belongs to. */
export function newPassword(email: string | undefined) {
  return passwordSchema.superRefine((value, ctx) => {
    const problem = passwordProblem(value, email);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });
}

const captchaToken = z.string().max(4096).optional();
const next = z.string().max(300).optional();

export const signUpSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    acceptTerms: z.literal(
      true,
      "Para criar a conta, aceite os Termos e a Política de Privacidade.",
    ),
    captchaToken,
    next,
  })
  .superRefine((value, ctx) => {
    const problem = passwordProblem(value.password, value.email);
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escreva a sua senha.").max(PASSWORD_MAX),
  captchaToken,
  next,
});

/** The sign-in link, "forgot password" and resending the confirmation: just an email. */
export const emailOnlySchema = z.object({ email: emailSchema, captchaToken, next });

export const profileSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema.optional(),
});

export const changeEmailSchema = z.object({ email: emailSchema });

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(PASSWORD_MAX).optional(),
  password: passwordSchema,
  captchaToken,
});

export const deleteAccountSchema = z.object({ email: emailSchema });

export const acceptTermsSchema = z.object({ version: z.literal(TERMS_VERSION) });

/** The first message of each field, for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fields[key] ??= issue.message;
  }
  return fields;
}
