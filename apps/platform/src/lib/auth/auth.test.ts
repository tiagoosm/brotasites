import { describe, expect, it } from "vitest";
import { isCommonPassword, passwordProblem, passwordStrength } from "./passwords";
import {
  emailSchema,
  fieldErrors,
  fullNameSchema,
  phoneSchema,
  profileSchema,
  signUpSchema,
  TERMS_VERSION,
} from "./schemas";

describe("passwords", () => {
  it("asks for 10 characters and refuses the common ones", () => {
    expect(passwordProblem("curta")).toBe("Use pelo menos 10 caracteres.");
    for (const common of [
      "1234567890",
      "Senha123456",
      "qwertyuiop",
      "aaaaaaaaaaaa",
      "abcdefghijk",
      "9876543210",
      "Flamengo123",
      "brótasites1",
    ]) {
      expect(isCommonPassword(common), common).toBe(true);
      expect(passwordProblem(common), common).toBe("Essa senha é muito comum. Escolha outra.");
    }
    expect(passwordProblem("padariadoze2026", "padariadoze@exemplo.com")).toBe(
      "Não use o seu e-mail na senha.",
    );
    expect(passwordProblem("pão quente às 6h da manhã")).toBeNull();
  });

  it("measures length and variety", () => {
    expect(passwordStrength("1234567890")).toBe(0);
    expect(passwordStrength("cafezinho!")).toBe(1);
    expect(passwordStrength("Cafezinho-Forte-2026")).toBe(4);
  });
});

describe("account schemas", () => {
  it("normalizes the email", () => {
    expect(emailSchema.parse("  Ze@PadariaDoZe.com.BR ")).toBe("ze@padariadoze.com.br");
    expect(emailSchema.safeParse("ze@padaria").success).toBe(false);
    expect(emailSchema.safeParse("ze padaria@x.com").success).toBe(false);
  });

  it("accepts real names and refuses markup and control characters", () => {
    expect(fullNameSchema.parse("  José   d'Ávila-Souza Jr. ")).toBe("José d'Ávila-Souza Jr.");
    for (const name of ["<script>", "Zé\u0000", "a", "Zé 123", "x".repeat(81)]) {
      expect(fullNameSchema.safeParse(name).success, name).toBe(false);
    }
  });

  it("stores the phone in E.164", () => {
    expect(phoneSchema.parse("(35) 99999-0000")).toBe("+5535999990000");
    expect(phoneSchema.parse("35 3471-0000")).toBe("+553534710000");
    expect(phoneSchema.parse("+1 415 555 0100")).toBe("+14155550100");
    expect(phoneSchema.parse("")).toBe("");
    expect(phoneSchema.safeParse("123").success).toBe(false);
    expect(profileSchema.parse({ fullName: "Zé" })).toEqual({ fullName: "Zé" });
  });

  it("needs the accepted terms and a good password to sign up, with pt-BR messages", () => {
    const result = signUpSchema.safeParse({
      fullName: "Zé",
      email: "ze@padariadoze.com.br",
      password: "1234567890",
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        acceptTerms: "Para criar a conta, aceite os Termos e a Política de Privacidade.",
        password: "Essa senha é muito comum. Escolha outra.",
      });
    }
    expect(TERMS_VERSION).toBe("2026-10-draft");
  });
});
