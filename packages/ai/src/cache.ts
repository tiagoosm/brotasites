import { createHash } from "node:crypto";
import { stableStringify } from "./data.js";

// Answers cached by the hash of everything that shapes them (docs/ai-and-reviewer.md): task,
// model, prompt and playbook versions and the input. Same input, same answer, no new cost.
// In memory here; a Supabase table in E10 implements the same interface.

export interface AiCache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

export function cacheKey(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(parts)).digest("hex");
}

export class MemoryCache implements AiCache {
  private readonly entries = new Map<string, unknown>();

  async get(key: string): Promise<unknown | undefined> {
    const value = this.entries.get(key);
    return value === undefined ? undefined : structuredClone(value);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.entries.set(key, structuredClone(value));
  }

  get size(): number {
    return this.entries.size;
  }
}
