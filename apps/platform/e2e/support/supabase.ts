import { readFileSync } from "node:fs";
import type { BrowserContext } from "@playwright/test";

// A fake Supabase for e2e: the platform points at https://e2e-test.supabase.co (see
// playwright.config.ts), the session is a cookie made here and every auth, database and
// storage call from the browser is answered by the test. Nothing reaches a real project.

export const SUPABASE = "https://e2e-test.supabase.co";
export const USER = { id: "user-1", email: "ze@padariadoze.com.br" };
export const SITE = "site-1";

export const photoBytes = readFileSync(
  new URL("../../../../packages/templates/e2e/fixture/assets/hero.jpg", import.meta.url),
);

const base64url = (value: string) => Buffer.from(value).toString("base64url");

/** A session cookie in the format @supabase/ssr reads. The token is checked via /auth/v1/user. */
export async function signIn(context: BrowserContext) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    base64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    base64url(
      JSON.stringify({
        sub: USER.id,
        email: USER.email,
        role: "authenticated",
        aud: "authenticated",
        exp,
      }),
    ),
    "assinatura",
  ].join(".");
  const user = {
    ...USER,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-21T00:00:00Z",
  };
  const session = {
    access_token: token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: "r",
    user,
  };
  await context.addCookies([
    {
      name: "sb-e2e-test-auth-token",
      value: `base64-${base64url(JSON.stringify(session))}`,
      domain: "localhost",
      path: "/",
    },
  ]);
  return user;
}

export interface FakeState {
  /** What the person's sites query returns (status screen). */
  site: { id: string; subdomain: string | null; status: string } | null;
  /** Addresses taken by someone else. */
  taken: string[];
  /** Error message request_publication answers with, if any. */
  publishError?: string;
  uploads: { path: string; type: string | null }[];
  removed: string[];
  published: { p_site_id: string; p_subdomain: string }[];
}

export async function fakeSupabase(
  context: BrowserContext,
  user: object,
  initial: Partial<FakeState> = {},
): Promise<FakeState> {
  const state: FakeState = {
    site: null,
    taken: [],
    uploads: [],
    removed: [],
    published: [],
    ...initial,
  };
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  await context.route(`${SUPABASE}/auth/v1/user`, (route) => route.fulfill(json(user)));
  await context.route(`${SUPABASE}/rest/v1/rpc/**`, (route) => {
    const request = route.request();
    const name = new URL(request.url()).pathname.split("/").pop();
    const body = request.postDataJSON() as Record<string, string>;
    if (name === "subdomain_available") {
      return route.fulfill(json(!state.taken.includes(body.p_subdomain ?? "")));
    }
    if (name === "request_publication") {
      if (state.publishError) {
        return route.fulfill(json({ code: "P0001", message: state.publishError }, 400));
      }
      state.published.push(body as FakeState["published"][number]);
      state.site = { id: SITE, subdomain: body.p_subdomain ?? null, status: "generating" };
      return route.fulfill(json("job-1"));
    }
    return route.fulfill(json({ message: "unknown function" }, 404));
  });
  await context.route(`${SUPABASE}/rest/v1/**`, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // Routes added later win in Playwright: hand database functions to their own handler.
    if (url.pathname.includes("/rest/v1/rpc/")) return route.fallback();
    const table = url.pathname.split("/").pop();
    const method = request.method();
    if (table === "sites" && method === "GET") {
      // The draft sync asks for drafts with their configs; the status screen for the site.
      const wantsDraft = url.searchParams.get("select")?.includes("site_configs");
      return route.fulfill(json(wantsDraft ? null : state.site));
    }
    if (table === "sites" && method === "POST") return route.fulfill(json({ id: SITE }, 201));
    if (method === "PATCH") return route.fulfill(json([]));
    return route.fulfill(json(method === "POST" ? [] : null, method === "POST" ? 201 : 200));
  });
  await context.route(`${SUPABASE}/storage/v1/object/public/**`, (route) =>
    route.fulfill({ status: 200, contentType: "image/jpeg", body: photoBytes }),
  );
  await context.route(`${SUPABASE}/storage/v1/object/site-images**`, (route) => {
    const request = route.request();
    if (request.method() === "DELETE") {
      const body = request.postDataJSON() as { prefixes?: string[] };
      state.removed.push(...(body.prefixes ?? []));
      return route.fulfill(json([]));
    }
    const path = new URL(request.url()).pathname.replace("/storage/v1/object/site-images/", "");
    state.uploads.push({ path, type: request.headers()["content-type"] ?? null });
    return route.fulfill(json({ Key: `site-images/${path}`, Id: "1" }));
  });
  return state;
}
