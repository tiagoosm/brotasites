import { readFileSync } from "node:fs";
import type { Family } from "@brotasites/schema/v1.2";

// The copy playbooks (packages/ai/playbooks): one per family, plus the common rules. Each file
// has a version in its front matter; the version goes into the cache key and into the site's
// `ai.playbookVersion`, so a changed playbook never serves an old answer.

export interface Playbook {
  family: string;
  version: string;
  /** The whole file without its front matter: it goes into the model's instructions. */
  text: string;
  /** Lowercase phrases from the "Banned phrases" section. */
  banned: string[];
}

const dir = new URL("../playbooks/", import.meta.url);

/** Families with their own playbook this round; the others use general.md. */
export const playbookFamilies: readonly Family[] = ["food", "beauty", "events-creative"];

export function parsePlaybook(source: string): Playbook {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error("Playbook without front matter");
  const meta = Object.fromEntries(
    (match[1] as string).split("\n").map((line) => {
      const [key, ...rest] = line.split(":");
      return [key?.trim(), rest.join(":").trim()];
    }),
  );
  if (!meta.family || !meta.version) throw new Error("Playbook needs a family and a version");
  const text = (match[2] as string).trim();
  const bannedSection = /## Banned phrases\n([\s\S]*?)(?:\n## |$)/.exec(text)?.[1] ?? "";
  const banned = bannedSection
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim().toLowerCase())
    .filter(Boolean);
  return { family: meta.family, version: meta.version, text, banned };
}

const loaded = new Map<string, Playbook>();

function load(name: string): Playbook {
  const cached = loaded.get(name);
  if (cached) return cached;
  const playbook = parsePlaybook(readFileSync(new URL(`${name}.md`, dir), "utf8"));
  loaded.set(name, playbook);
  return playbook;
}

export interface FamilyPlaybook {
  /** "food@1+common@1": the family's playbook and the common rules, with their versions. */
  version: string;
  text: string;
  banned: string[];
}

/** The common rules and the family's playbook (or general.md), as the copy step uses them. */
export function playbookFor(family: Family): FamilyPlaybook {
  const common = load("common");
  const own = load(playbookFamilies.includes(family) ? family : "general");
  return {
    version: `${own.family}@${own.version}+common@${common.version}`,
    text: `${common.text}\n\n${own.text}`,
    banned: [...new Set([...common.banned, ...own.banned])],
  };
}
