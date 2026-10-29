import { describe, expect, it } from "vitest";
import { MemoryStore, runPurges } from "../src/index.js";

describe("hosting cleanup of deleted accounts", () => {
  it("removes each queued site once and retries the failures", async () => {
    const store = new MemoryStore();
    store.purges.push(
      { id: 1, siteId: "s1", subdomain: "padaria", attempts: 0, done: false },
      { id: 2, siteId: "s2", subdomain: null, attempts: 0, done: false },
    );
    const seen: string[] = [];
    const purger = async (site: { siteId: string; subdomain: string | null }) => {
      seen.push(site.siteId);
      if (site.siteId === "s2") throw new Error("R2 indisponível");
      return 3;
    };
    expect(await runPurges(store, purger, () => {}, 2)).toBe(1);
    expect(store.purges.map((p) => [p.id, p.done, p.attempts, p.error])).toEqual([
      [1, true, 1, undefined],
      [2, false, 1, "R2 indisponível"],
    ]);
    // Next round: only the failed one, until 5 attempts.
    expect(await runPurges(store, purger, () => {}, 10)).toBe(0);
    expect(store.purges[1]?.attempts).toBe(5);
    expect(seen.filter((id) => id === "s2")).toHaveLength(5);
  });

  it("waits without R2: the cleanups stay queued", async () => {
    const store = new MemoryStore();
    store.purges.push({ id: 1, siteId: "s1", subdomain: "x", attempts: 0, done: false });
    expect(await runPurges(store, undefined)).toBe(0);
    expect(store.purges[0]?.attempts).toBe(0);
  });
});
