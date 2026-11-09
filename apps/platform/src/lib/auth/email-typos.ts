// "Você quis dizer voce@gmail.com?" (E26): a likely typo in the domain of a common email
// provider, offered as a suggestion the person can accept, never a block. Only the domain is
// compared; the part before @ is never touched.

const DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "ig.com.br",
  "globo.com",
];

/** Typos too far for the distance check below but common enough to name. */
const KNOWN: Record<string, string> = {
  "gmail.com.br": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "hotmail.co": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "yaho.com.br": "yahoo.com.br",
};

/** Edits (insert, delete, change, swap two neighbours) between two short strings. */
function distance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = d[i] as number[];
      const above = d[i - 1] as number[];
      row[j] = Math.min(
        (above[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (above[j - 1] as number) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j] as number, ((d[i - 2] as number[])[j - 2] as number) + 1);
      }
    }
  }
  return (d[a.length] as number[])[b.length] as number;
}

/** The corrected email, or null when the domain looks right (or unlike any common one). */
export function suggestEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!domain || DOMAINS.includes(domain)) return null;
  const known = KNOWN[domain];
  if (known) return `${local}@${known}`;
  let best: { domain: string; distance: number } | null = null;
  for (const candidate of DOMAINS) {
    const d = distance(domain, candidate);
    if (d <= 2 && (!best || d < best.distance)) best = { domain: candidate, distance: d };
  }
  // Short domains are too easy to mistake for one another: one edit at most there.
  if (!best || (domain.length < 8 && best.distance > 1)) return null;
  return `${local}@${best.domain}`;
}
