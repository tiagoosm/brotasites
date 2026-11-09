import { describe, expect, it } from "vitest";
import { suggestEmail } from "./email-typos";
import {
  isCommonPassword,
  missingRules,
  type PasswordRule,
  passwordProblem,
  passwordStrength,
  strengthLabels,
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

describe("passwords (E26: five rules, always checked together)", () => {
  const good = "Cafe-forte9"; // 11 characters, every rule

  it("needs each of the five rules, each one failing alone", () => {
    expect(passwordProblem(good)).toBeNull();
    expect(missingRules(good)).toEqual([]);
    const cases: [string, PasswordRule, string][] = [
      ["Cafe-for9", "length", "Use pelo menos 10 caracteres."],
      ["CAFE-FORTE9", "lower", "Inclua uma letra minúscula."],
      ["cafe-forte9", "upper", "Inclua uma letra maiúscula."],
      ["Cafe-forte!", "digit", "Inclua um número."],
      ["Cafeforte99", "symbol", "Inclua um símbolo, como ! @ # ?."],
    ];
    for (const [password, rule, message] of cases) {
      expect(missingRules(password), password).toEqual([rule]);
      expect(passwordProblem(password), password).toBe(message);
    }
    // Several at once, in one sentence.
    expect(passwordProblem("cafe")).toBe(
      "Use pelo menos 10 caracteres e inclua uma letra maiúscula, um número e um símbolo, como ! @ # ?.",
    );
    expect(passwordProblem("cafeforteforte")).toBe(
      "Inclua uma letra maiúscula, um número e um símbolo, como ! @ # ?.",
    );
  });

  it("takes any symbol from any script, and counts spaces and accents as people do", () => {
    for (const password of [
      "Pão quente 6h«",
      "Café forte 9€",
      "Açaí da tarde 7¿",
      "Mate gelado 3😊",
    ]) {
      expect(passwordProblem(password), password).toBeNull();
    }
    // A space alone is not a symbol.
    expect(missingRules("Cafe forte 99")).toEqual(["symbol"]);
    // "ü" and "Ç" are letters, never symbols.
    expect(missingRules("Çüüüüüüü99")).toEqual(["symbol"]);
  });

  it("allows up to 128 characters", () => {
    const at128 = `Aa1!${"x".repeat(124)}`;
    expect(passwordProblem(at128)).toBeNull();
    expect(passwordProblem(`${at128}y`)).toBe("Use até 128 caracteres.");
  });

  it("refuses the common ones, with the usual capital, number or symbol around them", () => {
    for (const common of [
      "Senha@1234",
      "Senha@12345",
      "Brasil2026!",
      "P@ssw0rd123!",
      "Flamengo123!",
      "Qwerty#2026",
      "Brótasites1!",
      "!Senha2026",
    ]) {
      expect(isCommonPassword(common), common).toBe(true);
      expect(passwordProblem(common), common).toBe("Essa senha é muito comum. Escolha outra.");
    }
    for (const plain of ["1234567890", "qwertyuiop", "aaaaaaaaaaaa", "abcdefghijk", "9876543210"]) {
      expect(isCommonPassword(plain), plain).toBe(true);
    }
    expect(isCommonPassword("Cafezinho-Forte-2026")).toBe(false);
  });

  it("refuses the person's email and name inside the password", () => {
    expect(passwordProblem("Padariadoze#26", { email: "padariadoze@exemplo.com" })).toBe(
      "Não use o seu e-mail na senha.",
    );
    // Parts of 4 letters or more, without accents or capitals.
    expect(passwordProblem("Joao-Bolo-2026", { name: "João da Silva" })).toBe(
      "Não use o seu nome na senha.",
    );
    expect(passwordProblem("Bolo#de#fuba9", { name: "Zé da Silva" })).toBeNull();
  });

  it("says Fraca, Boa or Forte, and every rule met is never Fraca", () => {
    expect(passwordStrength("")).toBe("weak");
    expect(passwordStrength("cafezinho!")).toBe("weak");
    expect(passwordStrength("Senha@123")).toBe("weak");
    expect(passwordStrength(good)).toBe("good");
    expect(passwordStrength("Cafe-forte-99")).toBe("good"); // 13
    expect(passwordStrength("Cafe-forte-999")).toBe("strong"); // 14
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

  it("needs the accepted terms, a good password and the same one twice, with pt-BR messages", () => {
    const result = signUpSchema.safeParse({
      fullName: "Zé",
      email: "ze@padariadoze.com.br",
      password: "Senha@12345",
      confirmPassword: "Senha@12345",
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        acceptTerms: "Para criar a conta, aceite os Termos e a Política de Privacidade.",
        password: "Essa senha é muito comum. Escolha outra.",
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
    // The name is checked on the server too.
    const named = signUpSchema.safeParse({
      fullName: "Marcela Dias",
      email: "ze@padariadoze.com.br",
      password: "Marcela#2026",
      confirmPassword: "Marcela#2026",
      acceptTerms: true,
    });
    expect(named.success).toBe(false);
    // Signing in with an older, weaker password is still accepted by the schema.
    expect(signInSchema.safeParse({ email: "ze@x.com.br", password: "senha1" }).success).toBe(true);
    expect(TERMS_VERSION).toBe("2026-10-draft");
  });
});
