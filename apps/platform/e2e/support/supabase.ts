import { readFileSync } from "node:fs";
import type { BrowserContext, Route } from "@playwright/test";

// A fake Supabase for e2e: the platform points at https://e2e-test.supabase.co (see
// playwright.config.ts), the session is a cookie made here and every auth, database and
// storage call from the browser is answered by the test. The platform's own route handlers
// (/api/...) are answered here too, so nothing reaches a real project or Trigger.dev.

export const SUPABASE = "https://e2e-test.supabase.co";
export const USER = { id: "1c0a7b5e-9d2f-4f61-8b3a-5e7d9c2a4f10", email: "ze@padariadoze.com.br" };
export const SITE = "7d1c1a52-2f0e-4c39-9a35-6b1f4a8e2c10";
export const PAYMENT = "9e2b4c6d-8f0a-4b1c-a3d5-e7f9a1b3c5d7";

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

export interface FakeDirection {
  id: string;
  round: number;
  direction: "fiel-a-marca" | "evolucao" | "contraste";
  identity: {
    personality: string;
    palette: Record<string, string>;
    fontPair: string;
    heroVariant: string;
  };
  source: "ai" | "engine";
  screenshots: string[];
}

export interface FakeState {
  /** The person's site, or null before /criar creates one. */
  site: {
    id: string;
    subdomain: string | null;
    status: string;
    round: number;
    schema_version: "1.2";
    status_message: string | null;
    preview_token: string | null;
    approved_direction: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  draft: Record<string, unknown>;
  completed: string[];
  directions: FakeDirection[];
  events: { id: number; kind: string; message: string; created_at: string }[];
  /** Addresses taken by someone else. */
  taken: string[];
  /** Every call to a database function, in order. */
  rpc: { name: string; body: Record<string, unknown> }[];
  /** Every draft saved to the account. */
  saved: { draft: Record<string, unknown>; completed: string[] }[];
  uploads: string[];
  removed: string[];
  /** Calls to the platform's route handlers. */
  api: string[];
  /** The person is on the admins list (is_admin). */
  admin?: boolean;
  /** Bodies posted to the admin route handlers, by path. */
  adminPosts: { path: string; body: Record<string, unknown> }[];
}

export function siteRow(status = "draft", extra: Partial<NonNullable<FakeState["site"]>> = {}) {
  return {
    id: SITE,
    subdomain: null,
    status,
    round: 0,
    schema_version: "1.2" as const,
    status_message: null,
    preview_token: null,
    approved_direction: null,
    created_at: "2026-10-28T10:00:00Z",
    updated_at: "2026-10-28T10:00:00Z",
    ...extra,
  };
}

/** Answers that meet the minimum to generate (docs/form-flow.md). */
export const padaria = {
  business: {
    name: "Padaria do Zé",
    category: "padaria",
    city: "Santa Rita do Sapucaí",
    state: "MG",
    description: "Padaria de bairro com pão de fermentação natural desde 1998.",
  },
  content: { services: [{ name: "Pão de fermentação natural" }] },
  contact: {
    whatsapp: "5535999990000",
    hasFixedAddress: true,
    street: "Rua das Flores",
    serviceArea: [],
    openingHours: { mode: "byAppointment", rules: [] },
  },
};

const stepSlugs = ["negocio", "marca", "secoes", "conteudo", "contato", "direcao", "endereco"];

/** The steps before `slug`, as completed. */
export const allBefore = (slug: string) => stepSlugs.slice(0, stepSlugs.indexOf(slug));

export async function fakeSupabase(
  context: BrowserContext,
  user: object,
  initial: Partial<FakeState> = {},
): Promise<FakeState> {
  const state: FakeState = {
    site: null,
    draft: {},
    completed: [],
    directions: [],
    events: [],
    taken: [],
    rpc: [],
    saved: [],
    uploads: [],
    removed: [],
    api: [],
    adminPosts: [],
    ...initial,
  };
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  const event = (kind: string, message: string) =>
    state.events.unshift({
      id: state.events.length + 1,
      kind,
      message,
      created_at: new Date().toISOString(),
    });
  const setStatus = (status: string, extra: Partial<NonNullable<FakeState["site"]>> = {}) => {
    if (state.site) state.site = { ...state.site, status, ...extra };
  };

  // The sites Worker's export link (apps/sites-worker), answered with a tiny zip.
  await context.route("https://previa.sites.localhost/_export/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/zip",
      headers: { "content-disposition": 'attachment; filename="site.zip"' },
      body: Buffer.from("PK\u0005\u0006".padEnd(22, "\u0000"), "binary"),
    }),
  );
  await context.route(`${SUPABASE}/auth/v1/user`, (route) => route.fulfill(json(user)));

  await context.route(`${SUPABASE}/rest/v1/rpc/**`, (route) => {
    const request = route.request();
    const name = new URL(request.url()).pathname.split("/").pop() ?? "";
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    state.rpc.push({ name, body });
    switch (name) {
      case "subdomain_available":
        return route.fulfill(json(!state.taken.includes(String(body.p_subdomain))));
      case "request_directions":
        setStatus("generating_directions");
        event("directions_requested", "Respostas recebidas. Estamos criando as 3 direções.");
        return route.fulfill(json("job-directions"));
      case "choose_direction":
        setStatus("building", { approved_direction: String(body.p_direction_id) });
        event("direction_chosen", "Direção escolhida. Estamos montando o site.");
        return route.fulfill(json("job-build"));
      case "is_admin":
        return route.fulfill(json(state.admin === true));
      case "request_rebuild":
        setStatus("building");
        return route.fulfill(json("job-rebuild"));
      default:
        return route.fulfill(json({ message: "unknown function" }, 404));
    }
  });

  await context.route(`${SUPABASE}/rest/v1/**`, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // Routes added later win in Playwright: hand database functions to their own handler.
    if (url.pathname.includes("/rest/v1/rpc/")) return route.fallback();
    const table = url.pathname.split("/").pop();
    const method = request.method();
    const one = request.headers().accept?.includes("vnd.pgrst.object+json");
    const answer = (rows: unknown[]) => route.fulfill(json(one ? (rows[0] ?? null) : rows));
    const idFilter = url.searchParams.get("id");

    if (table === "sites") {
      if (method === "GET") {
        if (!state.site || (idFilter && idFilter !== `eq.${state.site.id}`)) return answer([]);
        const select = url.searchParams.get("select") ?? "";
        const row = select.includes("site_configs")
          ? { ...state.site, site_configs: { draft: state.draft, completed: state.completed } }
          : state.site;
        return answer([row]);
      }
      if (method === "POST") {
        state.site = siteRow();
        return route.fulfill(json(one ? { id: SITE } : [{ id: SITE }], 201));
      }
      if (method === "PATCH") {
        const patch = request.postDataJSON() as { subdomain?: string };
        if (patch.subdomain && state.taken.includes(patch.subdomain)) {
          return route.fulfill(json({ code: "23505", message: "duplicate key" }, 409));
        }
        if (state.site) state.site = { ...state.site, ...patch };
        return route.fulfill({ status: 204, body: "" });
      }
    }
    if (table === "site_configs") {
      if (method === "POST" || method === "PATCH") {
        const body = request.postDataJSON() as {
          draft?: Record<string, unknown>;
          completed?: string[];
        };
        state.draft = body.draft ?? state.draft;
        state.completed = body.completed ?? state.completed;
        if (method === "PATCH")
          state.saved.push({ draft: state.draft, completed: state.completed });
        return route.fulfill({ status: method === "POST" ? 201 : 204, body: "" });
      }
    }
    if (table === "site_events" && method === "GET") return answer(state.events);
    if (table === "site_directions" && method === "GET") {
      return answer(state.directions.filter((d) => !idFilter || idFilter === `eq.${d.id}`));
    }
    if (table === "assets") {
      if (method === "POST") {
        const id = `5a1b2c3d-4e5f-4a6b-8c7d-${String(state.uploads.length).padStart(12, "0")}`;
        return route.fulfill(json(one ? { id } : [{ id }], 201));
      }
      if (method === "GET") {
        const ids = (url.searchParams.get("id") ?? "").replace(/^in\.\(|\)$/g, "").split(",");
        const rows = ids.filter(Boolean).map((id, index) => ({
          id: id.replace(/^eq\./, ""),
          storage_path: state.uploads[index] ?? "x.webp",
          bucket: "site-uploads",
        }));
        return answer(rows);
      }
      if (method === "DELETE") return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill(json(method === "GET" ? [] : null, method === "POST" ? 201 : 200));
  });

  await context.route(`${SUPABASE}/storage/v1/object/**`, (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/storage/v1/object/", "");
    if (path.startsWith("sign/")) {
      if (request.method() === "POST") {
        return route.fulfill(json({ signedURL: `/object/${path}?token=t` }));
      }
      return route.fulfill({ status: 200, contentType: "image/jpeg", body: photoBytes });
    }
    if (request.method() === "DELETE") {
      const body = request.postDataJSON() as { prefixes?: string[] };
      state.removed.push(...(body.prefixes ?? []));
      return route.fulfill(json([]));
    }
    const file = path.replace(/^site-uploads\//, "");
    state.uploads.push(file);
    return route.fulfill(json({ Key: path, Id: "1" }));
  });

  // The platform's route handlers.
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    state.api.push(url.pathname);
    if (url.pathname.startsWith("/api/admin/")) return answerAdmin(route, url, state, json);
    if (url.pathname === "/api/jobs/start") return route.fulfill(json({ started: false }));
    if (url.pathname.endsWith("/renders")) {
      const urls: Record<string, string> = {};
      for (const direction of state.directions) {
        for (const shot of direction.screenshots)
          urls[shot] = `${SUPABASE}/storage/v1/object/sign/site-renders/${shot}`;
      }
      return route.fulfill(json(urls));
    }
    if (url.pathname.endsWith("/approve")) return route.fulfill(json({ paymentId: PAYMENT }));
    if (url.pathname.endsWith("/export")) {
      return route.fulfill(
        json({
          url: `https://previa.sites.localhost/_export/${state.site?.subdomain}?exp=1&sig=ab`,
        }),
      );
    }
    if (url.pathname.endsWith("/confirm-stub")) {
      setStatus("publishing");
      event("payment_confirmed", "Pagamento confirmado.");
      return route.fulfill(json({ siteId: SITE }));
    }
    return route.fulfill(json({ error: "not found" }, 404));
  });
  return state;
}

/** A signed-in person with a site, its draft and progress. */
export async function withSite(
  context: BrowserContext,
  initial: Partial<FakeState> = {},
): Promise<FakeState> {
  const user = await signIn(context);
  return fakeSupabase(context, user, { site: siteRow(), ...initial });
}

export const threeDirections: FakeDirection[] = (
  ["fiel-a-marca", "evolucao", "contraste"] as const
).map((direction, index) => ({
  id: `d0000000-0000-4000-8000-00000000000${index}`,
  round: 0,
  direction,
  identity: {
    personality: "artesanal",
    palette: {
      background: "#FFFAF2",
      surface: "#FFFFFF",
      text: "#1F1A14",
      textMuted: "#5C5148",
      primary: ["#B45309", "#1F5130", "#3B2C5E"][index] as string,
      onPrimary: "#FFFFFF",
      accent: "#7C2D12",
    },
    fontPair: "fraunces-inter",
    heroVariant: "split",
  },
  source: index === 2 ? "engine" : "ai",
  screenshots: [`${SITE}/0/${direction}-1280.png`, `${SITE}/0/${direction}-390.png`],
}));

type Json = (
  body: unknown,
  status?: number,
) => { status: number; contentType: string; body: string };

/** The admin route handlers, answered from the fake's state (the real ones check is_admin). */
function answerAdmin(route: Route, url: URL, state: FakeState, json: Json) {
  if (!state.admin) return route.fulfill(json({ error: "Esta área é só para a equipe." }, 403));
  const request = route.request();
  if (request.method() === "POST") {
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    state.adminPosts.push({ path: url.pathname, body });
    if (url.pathname.endsWith("/decide") && state.site) {
      const next: Record<string, string> = {
        approve: "awaiting_approval",
        request_changes: "building",
        suspend: "suspended",
        unsuspend: "in_review",
      };
      if ((body.action === "request_changes" || body.action === "suspend") && !body.note) {
        return route.fulfill(
          json({ error: "Escreva o motivo: o cliente e o registro precisam dele." }, 400),
        );
      }
      state.site = { ...state.site, status: next[String(body.action)] ?? state.site.status };
      return route.fulfill(json({ status: state.site.status }));
    }
    return route.fulfill(json({ ok: true }));
  }
  if (url.pathname === "/api/admin/queue") {
    const business = (state.draft.business ?? {}) as Record<string, string>;
    return route.fulfill(
      json(
        state.site
          ? [
              {
                id: state.site.id,
                status: state.site.status,
                statusMessage: state.site.status_message,
                subdomain: state.site.subdomain,
                updatedAt: state.site.updated_at,
                name: business.name ?? null,
                category: business.category ?? null,
                city: business.city ?? null,
                state: business.state ?? null,
                review: "changesNeeded",
              },
            ]
          : [],
      ),
    );
  }
  if (url.pathname.startsWith("/api/admin/sites/") && state.site) {
    return route.fulfill(
      json({
        site: state.site,
        draft: state.draft,
        ownerEmail: USER.email,
        direction: { direction: "evolucao", composition_key: "c0ffee00c0ffee00", source: "ai" },
        screenshots: [],
        reports: [
          {
            status: "changesNeeded",
            created_at: "2026-10-29T10:00:00Z",
            report: {
              findings: [
                {
                  check: "agent:repetition",
                  severity: "medium",
                  where: "hero",
                  message: "O título repete o nome do negócio.",
                },
              ],
            },
          },
        ],
        events: state.events,
        decisions: [],
        payments: [],
      }),
    );
  }
  if (url.pathname === "/api/admin/catalog") {
    const metrics = {
      suggested: 6,
      chosen: 2,
      approved: 1,
      changeRequests: 1,
      findings: { low: 1, medium: 1, high: 0 },
      decisions: 2,
      reviewHours: 1.5,
    };
    return route.fulfill(
      json({
        metrics: {
          compositions: [{ key: "c0ffee00c0ffee00", ...metrics }],
          variants: [{ id: "hero-feast", ...metrics }],
        },
        weights: [{ kind: "variant", ref: "hero-feast", state: "recommended" }],
        requests: [],
      }),
    );
  }
  return route.fulfill(json({ error: "not found" }, 404));
}
