// The profile button shows the person's initials (E17): the first letter of the first and of the
// last name ("Zé da Padaria" → "ZP"), skipping the small words of Portuguese names. Accents are
// kept ("Ágata Érica" → "ÁÉ"). No name, no initials: the button shows a person icon instead.

const SMALL_WORDS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "del", "van", "von"]);

export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "")
    .normalize("NFC")
    .split(/[\s\-–—]+/)
    .map((word) => word.replace(/[^\p{L}\p{M}]/gu, ""))
    .filter((word) => word.length > 0);
  const main = words.filter((word, index) => index === 0 || !SMALL_WORDS.has(word.toLowerCase()));
  if (main.length === 0) return "";
  const first = [...(main[0] as string)][0] ?? "";
  const last = main.length > 1 ? ([...(main.at(-1) as string)][0] ?? "") : "";
  return (first + last).toLocaleUpperCase("pt-BR");
}
