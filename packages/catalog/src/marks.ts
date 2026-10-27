// How the business is signed in the header and footer: its logo, or a monogram when there is
// no logo (the AI never redraws a logo), or the name set in the heading font.

export const markStyles = [
  "logo",
  "wordmark",
  "monogram-circle",
  "monogram-square",
  "monogram-seal",
  "monogram-arch",
] as const;
export type MarkStyle = (typeof markStyles)[number];

const smallWords = new Set([
  "a",
  "as",
  "o",
  "os",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "no",
]);

/** Up to 2 initials for a monogram: "Padaria do Zé" -> "PZ", "Ateliê" -> "A". */
export function monogramLetters(name: string): string {
  const words = name
    .split(/[\s\-–—&+/]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word && !smallWords.has(word.toLowerCase()));
  const initials = words.map((word) => (word[0] as string).toLocaleUpperCase("pt-BR"));
  if (initials.length === 0) return "";
  return initials.length === 1 ? (initials[0] as string) : `${initials[0]}${initials.at(-1)}`;
}
