// Seeded randomness shared by the catalog and the engine: the same seed always gives the same
// choices, so a site can be rebuilt identically. Not for anything security related.

/** 32-bit FNV-1a hash of a string. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface Random {
  /** A float in [0, 1). */
  next(): number;
  /** A float in [min, max). */
  range(min: number, max: number): number;
  /** An integer in [min, max]. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Picks by weight; items with weight 0 are never picked. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
}

/** Mulberry32 seeded with the hash of `seed`. */
export function createRandom(seed: string): Random {
  let state = hashString(seed);
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const random: Random = {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (items) => {
      if (items.length === 0) throw new Error("Cannot pick from an empty list");
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    weighted: (items, weight) => {
      const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
      if (total <= 0) throw new Error("Cannot pick: every weight is 0");
      let target = next() * total;
      for (const item of items) {
        target -= Math.max(0, weight(item));
        if (target < 0) return item;
      }
      return items[items.length - 1] as (typeof items)[number];
    },
  };
  return random;
}
