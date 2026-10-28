import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exportLink, setHostingState } from "./hosting";

afterEach(() => vi.unstubAllEnvs());

describe("hosting", () => {
  it("signs a 10-minute export link the Worker can check", () => {
    vi.stubEnv("EXPORT_SECRET", "segredo");
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_ORIGIN", "https://previa.sites.localhost/");
    const link = new URL(exportLink("padaria-do-ze", 1_000_000_000_000) ?? "");
    expect(link.origin + link.pathname).toBe(
      "https://previa.sites.localhost/_export/padaria-do-ze",
    );
    expect(link.searchParams.get("exp")).toBe("1000000600");
    expect(link.searchParams.get("sig")).toBe(
      createHmac("sha256", "segredo").update("padaria-do-ze.1000000600").digest("hex"),
    );
    vi.stubEnv("EXPORT_SECRET", "");
    expect(exportLink("padaria-do-ze")).toBeNull();
  });

  it("changes only the state of a published site's record", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "conta");
    vi.stubEnv("CLOUDFLARE_KV_NAMESPACE_ID", "ns");
    vi.stubEnv("CLOUDFLARE_KV_API_TOKEN", "token");
    const store = new Map([
      ["site:loja", JSON.stringify({ version: "v2", previous: "v1", state: "active" })],
    ]);
    const fetcher = (async (input: string, init?: RequestInit) => {
      const key = decodeURIComponent(String(input).split("/values/")[1] ?? "");
      if (init?.method === "PUT") {
        store.set(key, String(init.body));
        return new Response("{}");
      }
      const value = store.get(key);
      return value ? new Response(value) : new Response("", { status: 404 });
    }) as typeof fetch;
    expect(await setHostingState("loja", "suspended", fetcher)).toBe("synced");
    expect(JSON.parse(store.get("site:loja") ?? "")).toMatchObject({
      version: "v2",
      previous: "v1",
      state: "suspended",
    });
    expect(await setHostingState("rascunho", "suspended", fetcher)).toBe("not-published");
    vi.stubEnv("CLOUDFLARE_KV_API_TOKEN", "");
    expect(await setHostingState("loja", "active", fetcher)).toBe("off");
  });
});
