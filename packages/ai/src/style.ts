import { normalize } from "./facts.js";

// The second pass over the copy (docs/ai-and-reviewer.md, Copy): banned phrases from the
// playbooks, generic copy (a hero that says nothing about this business), shouting and markup.

export interface StyleIssue {
  kind: "banned" | "generic" | "exclamation" | "markup";
  value: string;
  field: string;
}

export function checkStyle(
  fields: Record<string, string>,
  banned: readonly string[],
  specifics: readonly string[],
  heroFields: readonly string[],
): StyleIssue[] {
  const issues: StyleIssue[] = [];
  const bannedKeys = banned.map(normalize);
  let exclamations = 0;
  for (const [field, text] of Object.entries(fields)) {
    const plain = normalize(text);
    for (const phrase of bannedKeys) {
      if (new RegExp(`(^|[^\\p{L}])${escapeRegExp(phrase)}($|[^\\p{L}])`, "u").test(plain)) {
        issues.push({ kind: "banned", value: phrase, field });
      }
    }
    // Pages escape text anyway; an answer with markup in it is thrown away all the same.
    if (/[<>]/.test(text)) issues.push({ kind: "markup", value: text, field });
    exclamations += (text.match(/!/g) ?? []).length;
    if (/title$/i.test(field) && text.includes("!")) {
      issues.push({ kind: "exclamation", value: text, field });
    }
  }
  if (exclamations > 1) issues.push({ kind: "exclamation", value: `${exclamations}`, field: "*" });

  const hero = normalize(heroFields.map((field) => fields[field] ?? "").join(" "));
  const keys = specifics.map(normalize).filter((key) => key.length >= 3);
  if (keys.length > 0 && !keys.some((key) => hero.includes(key))) {
    issues.push({
      kind: "generic",
      value: heroFields.map((f) => fields[f]).join(" / "),
      field: "hero",
    });
  }
  return issues;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
