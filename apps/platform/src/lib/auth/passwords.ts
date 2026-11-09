// Password rules (docs/security.md, accounts; E26), the one place for the browser and the API.
// To create or change a password, all five are required: 10 characters or more (128 at most), a
// lowercase letter, an uppercase letter, a number and a symbol. And always: not one of the
// passwords people use most (with the usual capital and number at the end), not a run or a
// repetition, and not the person's email or name. The list is small and local on purpose: it
// catches the obvious ones without a download; Supabase's leaked-password check (owner step)
// catches the rest. Signing in with an older, weaker password still works (signInSchema).

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
/** From this length a password that meets every rule is "Forte". */
export const PASSWORD_STRONG = 14;

export type PasswordRule = "length" | "lower" | "upper" | "digit" | "symbol";

/** Who the password belongs to: neither may appear in it. */
export interface PasswordOwner {
  email?: string | null;
  name?: string | null;
}

/** Characters as people count them (an emoji is one), not UTF-16 units. */
const count = (value: string) => [...value].length;

/** The five rules, in the order of the checklist, with the text shown for each. */
export const passwordRules: readonly {
  id: PasswordRule;
  label: string;
  /** What is missing, inside a sentence ("Inclua … e …"). */
  missing: string;
  test: (value: string) => boolean;
}[] = [
  {
    id: "length",
    label: `${PASSWORD_MIN} caracteres ou mais`,
    missing: `pelo menos ${PASSWORD_MIN} caracteres`,
    test: (value) => count(value) >= PASSWORD_MIN,
  },
  {
    id: "lower",
    label: "Uma letra minúscula",
    missing: "uma letra minúscula",
    test: (value) => /\p{Ll}/u.test(value),
  },
  {
    id: "upper",
    label: "Uma letra maiúscula",
    missing: "uma letra maiúscula",
    test: (value) => /\p{Lu}/u.test(value),
  },
  {
    id: "digit",
    label: "Um número",
    missing: "um número",
    test: (value) => /\p{Nd}/u.test(value),
  },
  {
    // Any symbol or punctuation, from any script: not a letter, a number or a space.
    id: "symbol",
    label: "Um símbolo, como ! @ # ?",
    missing: "um símbolo, como ! @ # ?",
    test: (value) => /[^\p{L}\p{M}\p{N}\s]/u.test(value),
  },
];

/** The rules a password does not meet yet, in checklist order. */
export function missingRules(password: string): PasswordRule[] {
  return passwordRules.filter((rule) => !rule.test(password)).map((rule) => rule.id);
}

// Whole passwords people use most, and the words behind them ("Senha@123", "Brasil2026!").
const COMMON = new Set([
  "1234567890",
  "12345678910",
  "123456789012",
  "0123456789",
  "0987654321",
  "1111111111",
  "0000000000",
  "1234512345",
  "1q2w3e4r5t",
  "1qaz2wsx3edc",
  "qwertyuiop",
  "qwerty1234",
  "qwerty12345",
  "asdfghjkl1",
  "zxcvbnm123",
  "password12",
  "password123",
  "password1234",
  "passw0rd123",
  "iloveyou12",
  "abc1234567",
  "abcdefghij",
  "abcd123456",
  "senha12345",
  "senha123456",
  "senhasenha",
  "minhasenha",
  "minhasenha1",
  "mudar12345",
  "mudar123456",
  "brasil1234",
  "brasil12345",
  "flamengo123",
  "corinthians",
  "corinthians1",
  "palmeiras123",
  "saopaulo123",
  "vasco12345",
  "gremio1234",
  "cruzeiro123",
  "botafogo123",
  "fluminense1",
  "santos1234",
  "internacional",
  "jesus12345",
  "jesuscristo",
  "deusefiel1",
  "amorzinho1",
  "familia123",
  "princesa123",
  "chocolate1",
  "futebol123",
  "brotasites",
  "brotasites1",
  "brotasites123",
  "padaria123",
]);

/** The words under the common passwords: with only numbers or symbols around, still common. */
const COMMON_WORDS = new Set([
  "senha",
  "minhasenha",
  "novasenha",
  "password",
  "passwd",
  "senhaforte",
  "qwerty",
  "qwertyuiop",
  "asdfgh",
  "asdfghjkl",
  "zxcvbnm",
  "abc",
  "abcd",
  "abcdef",
  "admin",
  "administrador",
  "mudar",
  "mudarsenha",
  "trocar",
  "segredo",
  "acesso",
  "teste",
  "iloveyou",
  "teamo",
  "amor",
  "amorzinho",
  "amormeu",
  "meuamor",
  "brasil",
  "flamengo",
  "corinthians",
  "palmeiras",
  "saopaulo",
  "vasco",
  "gremio",
  "cruzeiro",
  "botafogo",
  "fluminense",
  "santos",
  "internacional",
  "jesus",
  "jesuscristo",
  "deus",
  "deusefiel",
  "familia",
  "princesa",
  "chocolate",
  "futebol",
  "welcome",
  "bemvindo",
  "letmein",
  "brotasites",
  "padaria",
]);

/** Lowercase, without accents, for comparing. */
function plain(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The usual swaps, undone: "P@ssw0rd" reads "password". */
function unLeet(value: string): string {
  return value
    .replace(/[@4]/g, "a")
    .replace(/0/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/3/g, "e")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t");
}

/** One character repeated, or a straight run like "abcdefghij" or "9876543210". */
function trivial(value: string): boolean {
  if (new Set(value).size <= 2) return true;
  const codes = [...value].map((char) => char.charCodeAt(0));
  const steps = new Set(codes.slice(1).map((code, index) => code - (codes[index] as number)));
  return steps.size === 1 && (steps.has(1) || steps.has(-1));
}

export function isCommonPassword(password: string): boolean {
  const value = plain(password);
  if (COMMON.has(value) || trivial(value)) return true;
  // The letters in the middle, with numbers and symbols trimmed from both ends.
  const core = value.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  if (!core) return true;
  const words = [core, unLeet(core)];
  return words.some((word) => COMMON_WORDS.has(word) || COMMON.has(word));
}

/** Parts of a name worth checking: 4 letters or more, plain. */
function nameParts(name: string | null | undefined): string[] {
  return plain(name ?? "")
    .split(/[^\p{L}]+/u)
    .filter((part) => part.length >= 4);
}

/** "a", "a e b", "a, b e c". */
function joined(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

/** Why a password is refused (pt-BR, shown under the field), or null when it is fine. */
export function passwordProblem(password: string, owner: PasswordOwner = {}): string | null {
  if (count(password) > PASSWORD_MAX) return `Use até ${PASSWORD_MAX} caracteres.`;
  const missing = passwordRules.filter((rule) => !rule.test(password));
  if (missing[0]?.id === "length") {
    const others = missing.slice(1).map((rule) => rule.missing);
    return others.length
      ? `Use pelo menos ${PASSWORD_MIN} caracteres e inclua ${joined(others)}.`
      : `Use pelo menos ${PASSWORD_MIN} caracteres.`;
  }
  if (missing.length) return `Inclua ${joined(missing.map((rule) => rule.missing))}.`;
  if (isCommonPassword(password)) return "Essa senha é muito comum. Escolha outra.";
  const value = plain(password);
  const local = plain(owner.email?.split("@")[0] ?? "");
  if (local.length >= 4 && value.includes(local)) return "Não use o seu e-mail na senha.";
  if (nameParts(owner.name).some((part) => value.includes(part))) {
    return "Não use o seu nome na senha.";
  }
  return null;
}

export type Strength = "weak" | "good" | "strong";

/**
 * Three levels, said in text: "Fraca" (a rule missing, or a common password), "Boa" (every rule,
 * 10 to 13 characters), "Forte" (every rule and 14 or more). A password that meets every rule
 * and is not common (nor the person's email or name) is never "Fraca".
 */
export function passwordStrength(password: string, owner: PasswordOwner = {}): Strength {
  if (passwordProblem(password, owner)) return "weak";
  return count(password) >= PASSWORD_STRONG ? "strong" : "good";
}

export const strengthLabels: Record<Strength, string> = {
  weak: "Fraca",
  good: "Boa",
  strong: "Forte",
};
