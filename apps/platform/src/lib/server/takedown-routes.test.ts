import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// E42: the owner's routes. Someone else's site, the rate limit, the typed address, the
// database's refusal in Portuguese and the hosting following the answer.

const state = vi.hoisted(() => ({
  owned: { site: { id: "s1", subdomain: "padaria-do-ze" }, user: { id: "u1" } } as unknown,
  allowed: true,
  rpc: [] as { name: string; args: Record<string, unknown> }[],
  answer: {
    data: { status: "offline", changed: true, subdomain: "padaria-do-ze", ownerId: "u1" },
    error: null,
  } as {
    data: unknown;
    error: { message: string } | null;
  },
  kv: [] as string[],
}));

vi.mock("./session", () => ({ ownSite: async () => state.owned }));
vi.mock("./rate-limit", () => ({ rulesFor: () => [], withinLimits: async () => state.allowed }));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminSupabase: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpc.push({ name, args });
      return state.answer;
    },
  }),
}));
vi.mock("./hosting", () => ({
  setHostingState: async (subdomain: string, value: string) => {
    state.kv.push(`${subdomain} ${value}`);
    return "synced";
  },
}));

const { ownerTakedown, ownerWithdraw } = await import("./takedown-routes");

const request = (body: unknown) =>
  new Request("https://brotasites.com.br/api/sites/s1/offline", {
    method: "POST",
    headers: { origin: "https://brotasites.com.br", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_PLATFORM_URL", "https://brotasites.com.br");
  state.allowed = true;
  state.rpc = [];
  state.kv = [];
  state.owned = { site: { id: "s1", subdomain: "padaria-do-ze" }, user: { id: "u1" } };
  state.answer = {
    data: { status: "offline", changed: true, subdomain: "padaria-do-ze", ownerId: "u1" },
    error: null,
  };
});
afterEach(() => vi.unstubAllEnvs());

describe("the owner's take-offline and deletion routes", () => {
  it("takes the site offline as the owner and follows with the hosting", async () => {
    const response = await ownerTakedown(request({ confirm: true }), "s1", "offline");
    expect(response.status).toBe(200);
    expect(state.rpc).toEqual([
      {
        name: "server_take_offline",
        args: { p_site_id: "s1", p_actor: "owner", p_actor_id: "u1" },
      },
    ]);
    expect(state.kv).toEqual(["padaria-do-ze offline"]);
  });

  it("refuses without the confirmation, and someone else's site", async () => {
    expect((await ownerTakedown(request({}), "s1", "offline")).status).toBe(400);
    state.owned = { error: new Response(null, { status: 404 }) };
    expect((await ownerTakedown(request({ confirm: true }), "s1", "offline")).status).toBe(404);
    expect(state.rpc).toEqual([]);
  });

  it("respects the rate limit", async () => {
    state.allowed = false;
    expect((await ownerTakedown(request({ confirm: true }), "s1", "online")).status).toBe(429);
    expect(state.rpc).toEqual([]);
  });

  it("schedules a deletion only with the address typed right, for the waiting days", async () => {
    const wrong = await ownerTakedown(
      request({ confirm: true, address: "padaria" }),
      "s1",
      "schedule",
    );
    expect(wrong.status).toBe(400);
    expect(((await wrong.json()) as { error: string }).error).toMatch(
      /endereço digitado não confere/,
    );
    const right = await ownerTakedown(
      request({ confirm: true, address: " Padaria-Do-Ze " }),
      "s1",
      "schedule",
    );
    expect(right.status).toBe(200);
    expect(state.rpc[0]).toEqual({
      name: "server_request_deletion",
      args: { p_site_id: "s1", p_actor: "owner", p_actor_id: "u1", p_days: 7 },
    });
  });

  it("cancelling leaves the hosting alone (the site stays offline)", async () => {
    await ownerTakedown(request({ confirm: true }), "s1", "cancel");
    expect(state.rpc[0]?.name).toBe("server_cancel_deletion");
    expect(state.kv).toEqual([]);
  });

  it("says the database's refusal in Portuguese, and the hosting does not move", async () => {
    state.answer = { data: null, error: { message: "suspended" } };
    const response = await ownerTakedown(request({ confirm: true }), "s1", "online");
    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: string }).error).toMatch(/suspenso/);
    expect(state.kv).toEqual([]);
  });
});

describe("the owner's withdrawal (E43, direito de arrependimento)", () => {
  it("records the withdrawal, confirms receipt at once and takes the site offline", async () => {
    state.answer = {
      data: {
        requestId: "r1",
        requestedAt: "2026-11-14T12:00:00Z",
        amountCents: 29700,
        status: "requested",
        changed: true,
        subdomain: "padaria-do-ze",
        ownerId: "u1",
        siteStatus: "offline",
        deleteAfter: "2026-11-21T12:00:00Z",
      },
      error: null,
    };
    const response = await ownerWithdraw(request({ confirm: true }), "s1");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      requestId: "r1",
      requestedAt: "2026-11-14T12:00:00Z",
      amountCents: 29700,
      hosting: "synced",
    });
    expect(state.rpc).toEqual([
      { name: "server_withdraw", args: { p_site_id: "s1", p_owner_id: "u1" } },
    ]);
    expect(state.kv).toEqual(["padaria-do-ze offline"]);
  });

  it("asked twice, answers the same request without touching the hosting", async () => {
    state.answer = {
      data: {
        requestId: "r1",
        requestedAt: "2026-11-14T12:00:00Z",
        amountCents: 29700,
        status: "requested",
        changed: false,
        subdomain: "padaria-do-ze",
        ownerId: "u1",
        siteStatus: "offline",
        deleteAfter: null,
      },
      error: null,
    };
    const response = await ownerWithdraw(request({ confirm: true }), "s1");
    expect((await response.json()).hosting).toBe("none");
    expect(state.kv).toEqual([]);
  });

  it("after the 7 days, says the period ended", async () => {
    state.answer = { data: null, error: { message: "withdrawal_expired" } };
    const response = await ownerWithdraw(request({ confirm: true }), "s1");
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/prazo para desistir com devolução/);
  });

  it("needs the confirmation", async () => {
    const response = await ownerWithdraw(request({}), "s1");
    expect(response.status).toBe(400);
    expect(state.rpc).toEqual([]);
  });
});
