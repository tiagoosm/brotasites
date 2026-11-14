import { z } from "zod";
import { PASSWORD_MAX, passwordProblem } from "./passwords";

// What the account routes accept (checked again on the server for every request). Messages
// are pt-BR, shown next to the field.

/** The terms in force; the database accepts only this one (accounts migration). */
export const TERMS_VERSION = "2026-11-draft";

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

/** A new password: 8 characters or more is the only requirement (passwords.ts, E27). */
export function newPassword() {
  return passwordSchema.superRefine((value, ctx) => {
    const problem = passwordProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });
}

/** The repeated password: checked on the server too, never only in the browser. */
export const PASSWORDS_DIFFER = "As senhas não são iguais.";
const confirmPassword = z.string("Repita a senha.").max(PASSWORD_MAX).min(1, "Repita a senha.");

const captchaToken = z.string().max(4096).optional();
const next = z.string().max(300).optional();

export const signUpSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: newPassword(),
    confirmPassword,
    acceptTerms: z.literal(
      true,
      "Para criar a conta, aceite os Termos e a Política de Privacidade.",
    ),
    captchaToken,
    next,
  })
  // The repeated password, checked on the server too.
  .superRefine((value, ctx) => {
    if (value.confirmPassword !== value.password) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: PASSWORDS_DIFFER });
    }
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escreva a sua senha.").max(PASSWORD_MAX),
  captchaToken,
  next,
});

/** "Forgot password" and resending the confirmation: just an email. */
export const emailOnlySchema = z.object({ email: emailSchema, captchaToken, next });

export const profileSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema.optional(),
});

export const changeEmailSchema = z.object({ email: emailSchema });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().max(PASSWORD_MAX).optional(),
    password: passwordSchema,
    confirmPassword,
    captchaToken,
  })
  .superRefine((value, ctx) => {
    if (value.confirmPassword !== value.password) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: PASSWORDS_DIFFER });
    }
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
