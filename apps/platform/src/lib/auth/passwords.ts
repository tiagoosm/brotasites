// Password rules (docs/security.md, accounts): at least 10 characters and not one of the
// passwords people use most. The list is small and local on purpose: it catches the obvious
// ones without a download; Supabase's leaked-password check (owner step) catches the rest.

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

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

/** Lowercase, without accents, for comparing with the list. */
function plain(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
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
  return COMMON.has(value) || trivial(value);
}

/** Why a password is refused (pt-BR, shown under the field), or null when it is fine. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `Use até ${PASSWORD_MAX} caracteres.`;
  if (isCommonPassword(password)) return "Essa senha é muito comum. Escolha outra.";
  const local = email?.split("@")[0];
  if (local && local.length >= 4 && plain(password).includes(plain(local))) {
    return "Não use o seu e-mail na senha.";
  }
  return null;
}

export type Strength = 0 | 1 | 2 | 3 | 4;

/** A simple meter: length and variety, nothing heavy. 0 is refused, 4 is strong. */
export function passwordStrength(password: string, email?: string): Strength {
  if (passwordProblem(password, email)) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((kind) =>
    kind.test(password),
  ).length;
  let score = 1;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (kinds >= 3) score++;
  return Math.min(4, score) as Strength;
}

export const strengthLabels: Record<Strength, string> = {
  0: "Fraca demais",
  1: "Aceitável",
  2: "Boa",
  3: "Forte",
  4: "Muito forte",
};
