import { describe, expect, it } from "vitest";
import { suggestEmail } from "./email-typos";
import {
  isCommonPassword,
  passwordHints,
  passwordProblem,
  passwordStrength,
  strengthLabels,
  variety,
} from "./passwords";
import {
  emailSchema,
  fieldErrors,
  fullNameSchema,
  phoneSchema,
  profileSchema,
  signInSchema,
  signUpSchema,
  TERMS_VERSION,
} from "./schemas";

describe("passwords (E27: 8 characters is the one requirement; the rest is strength)", () => {
  it("requires only 8 characters, up to 128", () => {
    expect(passwordProblem("cafe123")).toBe("Use pelo menos 8 caracteres.");
    // No composition rule: lowercase only, digits only, a common one, all accepted.
    for (const password of ["cafezinho", "12345678", "senha123", "Pão quente"]) {
      expect(passwordProblem(password), password).toBeNull();
    }
    const at128 = "x".repeat(128);
    expect(passwordProblem(at128)).toBeNull();
    expect(passwordProblem(`${at128}y`)).toBe("Use até 128 caracteres.");
    // Characters as people count them: an emoji is one.
    expect(passwordProblem("😊😊😊😊😊😊😊😊")).toBeNull();
  });

  it("counts the four kinds of character as hints, from any script", () => {
    expect(variety("cafezinho")).toBe(1);
    expect(variety("Cafezinho")).toBe(2);
    expect(variety("Cafezinho9")).toBe(3);
    expect(variety("Cafezinho9!")).toBe(4);
    expect(variety("Café forte 9€")).toBe(4);
    // A space is not a symbol; accented letters are letters.
    expect(variety("cafe forte")).toBe(1);
    expect(passwordHints.map((hint) => hint.label)).toEqual([
      "minúscula",
      "maiúscula",
      "número",
      "símbolo (! @ # ?)",
    ]);
  });

  it("finds the common ones, with the usual capital, number or symbol around them", () => {
    for (const common of [
      "Senha@1234",
      "Brasil2026!",
      "P@ssw0rd123!",
      "Flamengo123!",
      "Qwerty#2026",
      "Brótasites1!",
      "12345678",
      "qwertyuiop",
      "aaaaaaaaaaaa",
    ]) {
      expect(isCommonPassword(common), common).toBe(true);
    }
    expect(isCommonPassword("Cafezinho-Forte-2026")).toBe(false);
  });

  it("says Fraca, Boa or Forte from length, variety and guessability", () => {
    expect(passwordStrength("")).toBe("weak");
    expect(passwordStrength("cafe")).toBe("weak"); // under 8
    expect(passwordStrength("cafezinho")).toBe("weak"); // 8+, one kind
    expect(passwordStrength("Senha@1234")).toBe("weak"); // common
    expect(passwordStrength("Padariadoze#26", { email: "padariadoze@exemplo.com" })).toBe("weak");
    expect(passwordStrength("Joao-Bolo-2026", { name: "João da Silva" })).toBe("weak");
    expect(passwordStrength("Cafezinho9")).toBe("good");
    expect(passwordStrength("cafezinhoforte")).toBe("good"); // 12+, one kind
    expect(passwordStrength("Cafe-forte-99")).toBe("strong"); // 12+, three kinds
    expect(passwordStrength("bolo de fuba quente")).toBe("good"); // 16+, one kind
    expect(passwordStrength("bolo de fuba quente 9")).toBe("strong"); // 16+, two kinds
    expect(strengthLabels).toEqual({ weak: "Fraca", good: "Boa", strong: "Forte" });
  });
});

describe("email typos", () => {
  it("suggests the common provider for a likely typo, and nothing for a right one", () => {
    expect(suggestEmail("voce@gmial.com")).toBe("voce@gmail.com");
    expect(suggestEmail("voce@gmai.com")).toBe("voce@gmail.com");
    expect(suggestEmail("voce@gamil.com")).toBe("voce@gmail.com");
    expect(suggestEmail("voce@hotmial.com")).toBe("voce@hotmail.com");
    expect(suggestEmail("voce@outlok.com")).toBe("voce@outlook.com");
    expect(suggestEmail("voce@yaho.com")).toBe("voce@yahoo.com");
    expect(suggestEmail("Voce@Gmail.com")).toBeNull();
    expect(suggestEmail("ze@padariadoze.com.br")).toBeNull();
    expect(suggestEmail("ze@uol.com.br")).toBeNull();
    expect(suggestEmail("sem-arroba")).toBeNull();
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

  it("needs the accepted terms, 8 characters and the same password twice, with pt-BR messages", () => {
    const result = signUpSchema.safeParse({
      fullName: "Zé",
      email: "ze@padariadoze.com.br",
      password: "cafe",
      confirmPassword: "cafe",
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        acceptTerms: "Para criar a conta, aceite os Termos e a Política de Privacidade.",
        password: "Use pelo menos 8 caracteres.",
      });
    }
    const differ = signUpSchema.safeParse({
      fullName: "Zé",
      email: "ze@padariadoze.com.br",
      password: "Cafe-forte-99",
      confirmPassword: "Cafe-forte-98",
      acceptTerms: true,
    });
    expect(differ.success).toBe(false);
    if (!differ.success) {
      expect(fieldErrors(differ.error)).toEqual({ confirmPassword: "As senhas não são iguais." });
    }
    // Only the length is required (E27): a plain 8-character password is accepted.
    expect(
      signUpSchema.safeParse({
        fullName: "Marcela Dias",
        email: "ze@padariadoze.com.br",
        password: "marcela2",
        confirmPassword: "marcela2",
        acceptTerms: true,
      }).success,
    ).toBe(true);
    // Signing in with an older, weaker password is still accepted by the schema.
    expect(signInSchema.safeParse({ email: "ze@x.com.br", password: "senha1" }).success).toBe(true);
    expect(TERMS_VERSION).toBe("2026-11-draft");
  });
});
