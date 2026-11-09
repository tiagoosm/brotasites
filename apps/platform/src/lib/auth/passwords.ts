// Passwords (docs/security.md, accounts; E26, changed by the owner in E27), one place for the
// browser and the API. The only requirement to create or change a password is its length: 8
// characters or more (128 at most). Everything else only measures how strong it is: lowercase,
// uppercase, numbers and symbols, its length, and whether it is a common password or holds the
// person's email or name, which make it "Fraca". Signing in with any older password still works.
// Supabase's leaked-password check (owner step) can still refuse a leaked one.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
/** From this length a varied password is "Forte". */
export const PASSWORD_STRONG = 12;
/** From this length a password is "Forte" with only two kinds of character (a passphrase). */
export const PASSPHRASE = 16;

export type PasswordHint = "lower" | "upper" | "digit" | "symbol";

/** Who the password belongs to: either inside it makes it weak. */
export interface PasswordOwner {
  email?: string | null;
  name?: string | null;
}

/** Characters as people count them (an emoji is one), not UTF-16 units. */
const count = (value: string) => [...value].length;

/** The one requirement, as the checklist shows it. */
export const lengthRequirement = {
  label: `${PASSWORD_MIN} caracteres`,
  test: (value: string) => count(value) >= PASSWORD_MIN,
};

/** What makes a password stronger (never required), in the order of the checklist. */
export const passwordHints: readonly {
  id: PasswordHint;
  label: string;
  test: (value: string) => boolean;
}[] = [
  { id: "lower", label: "minúscula", test: (value) => /\p{Ll}/u.test(value) },
  { id: "upper", label: "maiúscula", test: (value) => /\p{Lu}/u.test(value) },
  { id: "digit", label: "número", test: (value) => /\p{Nd}/u.test(value) },
  {
    // Any symbol or punctuation, from any script: not a letter, a number or a space.
    id: "symbol",
    label: "símbolo (! @ # ?)",
    test: (value) => /[^\p{L}\p{M}\p{N}\s]/u.test(value),
  },
];

/** How many kinds of character the password has (0 to 4). */
export function variety(password: string): number {
  return passwordHints.filter((hint) => hint.test(password)).length;
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

/** Why a password is refused (pt-BR, shown under the field), or null when it is fine. */
export function passwordProblem(password: string): string | null {
  if (count(password) > PASSWORD_MAX) return `Use até ${PASSWORD_MAX} caracteres.`;
  if (count(password) < PASSWORD_MIN) return `Use pelo menos ${PASSWORD_MIN} caracteres.`;
  return null;
}

/** A common password, or one that holds the person's email or name: never better than weak. */
export function isGuessable(password: string, owner: PasswordOwner = {}): boolean {
  if (isCommonPassword(password)) return true;
  const value = plain(password);
  const local = plain(owner.email?.split("@")[0] ?? "");
  if (local.length >= 4 && value.includes(local)) return true;
  return nameParts(owner.name).some((part) => value.includes(part));
}

export type Strength = "weak" | "good" | "strong";

/**
 * Three levels, said in text: "Fraca" (under 8 characters, common, with the email or the name,
 * or short and plain), "Boa", "Forte" (12 or more with three kinds of character, or 16 or more
 * with two). The four kinds only raise the level; none is required.
 */
export function passwordStrength(password: string, owner: PasswordOwner = {}): Strength {
  if (passwordProblem(password) || isGuessable(password, owner)) return "weak";
  const length = count(password);
  const kinds = variety(password);
  if ((length >= PASSWORD_STRONG && kinds >= 3) || (length >= PASSPHRASE && kinds >= 2)) {
    return "strong";
  }
  if (kinds >= 2 || length >= PASSWORD_STRONG) return "good";
  return "weak";
}

export const strengthLabels: Record<Strength, string> = {
  weak: "Fraca",
  good: "Boa",
  strong: "Forte",
};
