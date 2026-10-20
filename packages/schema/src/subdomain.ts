// Suggests a site address from the business name ("Padaria do Zé" -> "padaria-do-ze").
// The result always satisfies `subdomainSchema` (3 to 40 characters), or is undefined.

const MAX_LENGTH = 40;

export function suggestSubdomain(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length < 3) return undefined;
  if (slug.length <= MAX_LENGTH) return slug;
  // Cut at the last whole word that fits.
  const cut = slug.slice(0, MAX_LENGTH);
  const lastHyphen = cut.lastIndexOf("-");
  const trimmed = (lastHyphen >= 3 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, "");
  return trimmed.length >= 3 ? trimmed : undefined;
}
