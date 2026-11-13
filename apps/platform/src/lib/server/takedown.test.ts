import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  cleanUpDeletedSite,
  hostingStateOf,
  runScheduledDeletions,
  syncHosting,
  takedownError,
} from "./takedown";

// E42: the hosting follows the database, in the right order, and a failed cleanup never puts a
// site back on the air nor stops the routine.

function fakeDb(answers: Record<string, { data?: unknown; error?: { message: string } }[]>) {
  const calls: { name: string; args: unknown }[] = [];
  const storage = {
    from: () => ({
      list: async () => ({ data: [] }),
      remove: async () => ({ data: [] }),
    }),
  };
  const db = {
    calls,
    storage,
    rpc: (name: string, args: unknown) => {
      calls.push({ name, args });
      const next = answers[name]?.shift() ?? { data: null };
      return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
    },
  };
  return db as unknown as SupabaseClient & { calls: typeof calls };
}

describe("hosting state of a site status", () => {
  it("maps live, grace and everything else", () => {
    expect(hostingStateOf("live")).toBe("active");
    expect(hostingStateOf("grace")).toBe("grace");
    expect(hostingStateOf("offline")).toBe("offline");
  });

  it("never throws when the KV fails", async () => {
    const result = await syncHosting(
      { status: "offline", subdomain: "padaria-do-ze" },
      { setState: async () => Promise.reject(new Error("KV down")) },
    );
    expect(result).toBe("failed");
    expect(await syncHosting({ status: "offline", subdomain: null })).toBe("none");
  });
});

describe("cleaning up a deleted site", () => {
  it("takes it offline in KV before any other cleanup, and survives every failure", async () => {
    const order: string[] = [];
    await cleanUpDeletedSite(
      fakeDb({}),
      {
        siteId: "s1",
        ownerId: "u1",
        subdomain: "padaria-do-ze",
        queued: true,
        removed: true,
      },
      {
        setState: async (subdomain, state) => {
          order.push(`kv ${subdomain} ${state}`);
          throw new Error("KV down");
        },
        deleteKey: async (key) => {
          order.push(`delete ${key}`);
          throw new Error("KV down");
        },
        purge: async () => {
          order.push("purge");
          return false;
        },
      },
    );
    expect(order).toEqual(["kv padaria-do-ze offline", "delete preview:s1", "purge"]);
  });

  it("does nothing when the database had already deleted it", async () => {
    const order: string[] = [];
    await cleanUpDeletedSite(
      fakeDb({}),
      { siteId: "s1", ownerId: "u1", subdomain: "x", queued: true, removed: false } as never,
      {
        setState: async () => {
          order.push("kv");
          return "synced";
        },
      },
    );
    expect(order).toEqual([]);
  });
});

describe("the scheduled deletions of the daily routine", () => {
  it("deletes what is due once, and records a failure to retry", async () => {
    const db = fakeDb({
      server_due_deletions: [{ data: [{ site_id: "s1" }, { site_id: "s2" }] }],
      server_delete_site_now: [
        { data: { siteId: "s1", ownerId: "u1", subdomain: "a-b", queued: true, removed: true } },
        { error: { message: "busy" } },
      ],
    });
    const states: string[] = [];
    const result = await runScheduledDeletions(db, {
      setState: async (subdomain, state) => {
        states.push(`${subdomain} ${state}`);
        return "synced";
      },
      deleteKey: async () => "off",
      purge: async () => true,
    });
    expect(result).toEqual({ deleted: 1, failed: 1 });
    expect(states).toEqual(["a-b offline"]);
    const failed = db.calls.find((call) => call.name === "server_deletion_failed");
    expect(failed?.args).toEqual({ p_site_id: "s2", p_error: "busy" });
    expect(
      db.calls
        .filter((call) => call.name === "server_delete_site_now")
        .map((call) => (call.args as { p_actor: string }).p_actor),
    ).toEqual(["system", "system"]);
  });

  it("stops quietly when the list fails", async () => {
    const db = fakeDb({ server_due_deletions: [{ error: { message: "down" } }] });
    expect(await runScheduledDeletions(db)).toEqual({ deleted: 0, failed: 0 });
  });
});

describe("the database's codes in Portuguese", () => {
  it("maps each code and falls back to a retry message", () => {
    expect(takedownError("suspended")[0]).toBe(409);
    expect(takedownError("reason_required")[1]).toMatch(/motivo/);
    expect(takedownError("site_not_found")[0]).toBe(404);
    expect(takedownError("whatever")[0]).toBe(503);
  });
});
