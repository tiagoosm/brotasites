import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect, test } from "@playwright/test";
import {
  fakeAccounts,
  fakeSupabase,
  padaria,
  SITE,
  SUPABASE,
  signIn,
  siteRow,
  threeDirections,
  withSite,
} from "./support/supabase";

// Cost limits and the team panel (E24): rounds of directions, one unpaid site in progress,
// discarding, the warning before an idle site is deleted, and the team's overview, costs,
// accounts and limits. The database side is in supabase/tests/cost_limits.sql and admin_panel.sql.

const dashboardOf = (siteId: string) => `/meus-sites/${siteId}`;
const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

async function board(request: APIRequestContext, userId: string, data: Record<string, unknown>) {
  await request.post(`${SUPABASE}/__test/dashboard`, {
    data: { userId, fullName: "Zé da Padaria", ...data },
  });
}

function row(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    status,
    subdomain: null,
    status_message: null,
    created_at: days(10),
    updated_at: days(1),
    approved_at: null,
    published_at: null,
    last_activity_at: days(1),
    keep_until: null,
    site_configs: { name: "Padaria do Zé", completed: ["negocio"] },
    site_events: [],
    ...extra,
  };
}

const person = () => {
  const id = randomUUID();
  return { id, email: `limite-${id.slice(0, 8)}@padariadoze.com.br` };
};

test.describe("rounds of directions", () => {
  test("the redos left are counted next to the button", async ({ page, context }) => {
    await withSite(context, {
      site: siteRow("awaiting_direction_choice"),
      draft: padaria,
      directions: threeDirections,
      quota: { used: 2, free: 3, availableAt: null },
    });
    await page.goto(dashboardOf(SITE));
    const redo = page.getByRole("button", { name: "Nenhuma serviu: criar outras 3" });
    await expect(redo).toBeEnabled();
    await expect(page.locator("#refazer-info")).toHaveText("Você usou 1 de 2 refazeres grátis.");
  });

  test("past the free ones the button waits, says until when, and choosing still works", async ({
    page,
    context,
  }) => {
    const state = await withSite(context, {
      site: siteRow("awaiting_direction_choice"),
      draft: padaria,
      directions: threeDirections,
      quota: {
        used: 3,
        free: 3,
        availableAt: new Date(Date.now() + 40 * 60_000).toISOString(),
      },
    });
    await page.goto(dashboardOf(SITE));
    const redo = page.getByRole("button", { name: "Nenhuma serviu: criar outras 3" });
    await expect(redo).toBeDisabled();
    await expect(redo).toHaveAttribute("aria-describedby", "refazer-info");
    await expect(page.locator("#refazer-info")).toContainText(
      /^Próxima rodada disponível (às|em \d{2}\/\d{2} às) \d{2}h\d{2}\. Depois dos refazeres grátis, você pode pedir mais 1 rodada a cada hora\.$/,
    );
    // Choosing one of the 3 is never blocked.
    const cards = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { level: 3 }) });
    await cards.first().getByRole("button", { name: "Escolher esta" }).click();
    await cards.first().getByRole("button", { name: "Sim, escolher" }).click();
    await expect(page.getByRole("status").first()).toContainText("Montando seu site");
    expect(state.rpc.at(-1)?.name).toBe("choose_direction");
  });

  test("the server's refusal is shown in words, not as a failure", async ({ page, context }) => {
    await withSite(context, {
      site: siteRow("awaiting_direction_choice"),
      draft: padaria,
      directions: threeDirections,
      // The page thinks a round is free; the database says wait (another tab used it).
      quota: { used: 2, free: 3, availableAt: null },
    });
    await page.route("**/api/sites/*/directions", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "Próxima rodada disponível às 15h40." }),
      }),
    );
    await page.goto(dashboardOf(SITE));
    await page.getByRole("button", { name: "Nenhuma serviu: criar outras 3" }).click();
    await page.getByRole("button", { name: "Criar sem dizer o motivo" }).click();
    await expect(page.getByText("Próxima rodada disponível às 15h40.")).toBeVisible();
  });
});

test.describe("one unpaid site in progress", () => {
  test("the dashboard explains why another site cannot start yet", async ({
    page,
    context,
    request,
  }) => {
    const who = person();
    const open = row("draft");
    await board(request, who.id, {
      sites: [open],
      slots: { open: 1, allowed: 1, openSiteId: open.id },
    });
    await signIn(context, { user: who });
    await page.goto("/meus-sites");
    const create = page.getByRole("button", { name: "Criar outro site" });
    await expect(create).toBeDisabled();
    await expect(create).toHaveAttribute("aria-describedby", "vaga-de-site");
    await expect(page.locator("#vaga-de-site")).toContainText(
      "Termine e publique o site que está em andamento para criar outro. Ou descarte-o.",
    );
    await expect(page.getByRole("link", { name: "Ir para o site em andamento" })).toHaveAttribute(
      "href",
      `/meus-sites/${open.id}`,
    );
  });

  test("with the slot free, creating another is a link", async ({ page, context, request }) => {
    const who = person();
    await board(request, who.id, {
      sites: [row("live", { last_activity_at: null })],
      slots: { open: 0, allowed: 1, openSiteId: null },
    });
    await signIn(context, { user: who });
    await page.goto("/meus-sites");
    await expect(page.getByRole("link", { name: "Criar outro site" })).toHaveAttribute(
      "href",
      "/criar?novo=1",
    );
    await expect(page.locator("#vaga-de-site")).toHaveCount(0);
  });

  test("/criar refuses a second site and leads to the one in progress", async ({
    page,
    context,
  }) => {
    const user = await signIn(context);
    const state = await fakeSupabase(context, user, { openSiteId: SITE });
    await page.goto("/criar?novo=1");
    await expect(
      page.getByRole("heading", { name: "Você já tem um site em andamento" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o site em andamento" })).toHaveAttribute(
      "href",
      `/meus-sites/${SITE}`,
    );
    expect(state.site).toBeNull();
  });

  test("discarding asks first, then frees the slot", async ({ page, context }) => {
    const state = await withSite(context, {
      site: siteRow("awaiting_direction_choice"),
      draft: padaria,
      directions: threeDirections,
    });
    await page.goto(dashboardOf(SITE));
    await page.getByRole("button", { name: "Descartar este site" }).click();
    await expect(
      page.getByText("Apagar este site, as respostas e as fotos? Isso não pode ser desfeito."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    expect(state.discarded).toBeUndefined();
    await page.getByRole("button", { name: "Descartar este site" }).click();
    await page.getByRole("button", { name: "Sim, descartar" }).click();
    await expect(page).toHaveURL(/\/meus-sites$/);
    expect(state.discarded).toBe(true);
  });

  test("a draft, or a site we are working on, can be discarded from the dashboard card", async ({
    page,
    context,
    request,
  }) => {
    const who = person();
    const working = row("generating_directions", {
      site_configs: { name: "Real Dente", completed: [] },
    });
    await board(request, who.id, {
      sites: [working, row("live", { site_configs: { name: "Bolos da Ana", completed: [] } })],
      slots: { open: 1, allowed: 1, openSiteId: working.id },
    });
    await signIn(context, { user: who });
    const discarded: string[] = [];
    await page.route("**/api/sites/*/discard", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ confirm: true });
      discarded.push(new URL(route.request().url()).pathname);
      await route.fulfill({ json: { discarded: true } });
    });
    await page.goto("/meus-sites");
    const sites = page.getByRole("list", { name: "Seus sites" });
    // A published site has no discard button.
    await expect(
      sites
        .getByRole("listitem", { name: "Bolos da Ana" })
        .getByRole("button", { name: /Descartar/ }),
    ).toHaveCount(0);
    const card = sites.getByRole("listitem", { name: "Real Dente" });
    await card.getByRole("button", { name: "Descartar Real Dente" }).click();
    await expect(card).toContainText(
      "Apagar Real Dente, as respostas e as fotos? O que estamos preparando para ele para na hora. Isso não pode ser desfeito.",
    );
    await card.getByRole("button", { name: "Cancelar" }).click();
    expect(discarded).toEqual([]);
    await card.getByRole("button", { name: "Descartar Real Dente" }).click();
    await card.getByRole("button", { name: "Sim, descartar" }).click();
    await expect.poll(() => discarded).toEqual([`/api/sites/${working.id}/discard`]);
  });

  test("a site being worked on can be discarded from its page too", async ({ page, context }) => {
    const state = await withSite(context, {
      site: siteRow("generating_directions"),
      draft: padaria,
    });
    await page.goto(dashboardOf(SITE));
    await page.getByRole("button", { name: "Descartar este site" }).click();
    await expect(page.getByText(/O que estamos preparando para ele para na hora\./)).toBeVisible();
    await page.getByRole("button", { name: "Sim, descartar" }).click();
    await expect(page).toHaveURL(/\/meus-sites$/);
    expect(state.discarded).toBe(true);
  });

  test("a paid or published site has no discard button", async ({ page, context }) => {
    await withSite(context, { site: siteRow("live", { subdomain: "padaria-do-ze" }) });
    await page.goto(dashboardOf(SITE));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Descartar este site" })).toHaveCount(0);
  });
});

test.describe("idle sites", () => {
  test("the card says how long it is kept, and the warning comes before the deletion", async ({
    page,
    context,
    request,
  }) => {
    const who = person();
    const site = row("draft", { last_activity_at: days(23) });
    await board(request, who.id, {
      sites: [site],
      slots: { open: 1, allowed: 1, openSiteId: site.id },
      notices: [
        {
          id: randomUUID(),
          kind: "site_deletion_warning",
          site_id: site.id,
          created_at: days(0),
          read_at: null,
          days_left: 7,
        },
      ],
    });
    await signIn(context, { user: who });
    await page.goto("/meus-sites");
    const card = page
      .getByRole("list", { name: "Seus sites" })
      .getByRole("listitem", { name: "Padaria do Zé" });
    await expect(card).toContainText(
      /Guardado até \d{2}\/\d{2}\/\d{4}\. Sem novidades, ele será apagado\./,
    );
    await page.getByRole("button", { name: "Avisos, 1 não lido" }).click();
    await expect(
      page.getByRole("link", {
        name: /Padaria do Zé será apagado em 7 dias se não houver novidades\./,
      }),
    ).toHaveAttribute("href", `/meus-sites/${site.id}`);
  });

  test("a recent site says any change renews the deadline; a paid one says nothing", async ({
    page,
    context,
    request,
  }) => {
    const who = person();
    await board(request, who.id, {
      sites: [
        row("awaiting_approval", { last_activity_at: days(2) }),
        row("live", {
          last_activity_at: days(200),
          site_configs: { name: "Bolos da Ana", completed: [] },
        }),
      ],
      slots: { open: 1, allowed: 1, openSiteId: null },
    });
    await signIn(context, { user: who });
    await page.goto("/meus-sites");
    const sites = page.getByRole("list", { name: "Seus sites" });
    await expect(sites.getByRole("listitem", { name: "Padaria do Zé" })).toContainText(
      "Qualquer mudança renova o prazo.",
    );
    await expect(sites.getByRole("listitem", { name: "Bolos da Ana" })).not.toContainText(
      "Guardado até",
    );
  });
});

test.describe("team panel", () => {
  test("closed to clients, at the page and at the data", async ({ page, context }) => {
    const state = await withSite(context);
    for (const path of ["/admin/visao-geral", "/admin/custos", "/admin/contas", "/admin/limites"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acesso restrito");
    }
    const response = await page.evaluate(async () => (await fetch("/api/admin/overview")).status);
    expect(response).toBe(403);
    expect(state.adminGets).toEqual([]);
  });

  test("overview: no data yet says so, with no invented numbers", async ({ page, context }) => {
    await withSite(context, { admin: true });
    await page.goto("/admin/visao-geral");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visão geral");
    await expect(page.getByText("Nenhum site criado no período: sem dados ainda.")).toBeVisible();
    await expect(page.getByText("US$ 0,00 de US$ 20,00 (0%). Alerta em 80%.")).toBeVisible();
  });

  test("overview: funnel, cost and the budget alert at 80%", async ({ page, context }) => {
    await withSite(context, { admin: true, spentUsd: 17 });
    await page.goto("/admin/visao-geral");
    await expect(page.getByRole("tab", { name: "30 dias" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const funnel = page.getByRole("table");
    await expect(funnel.getByRole("row")).toHaveCount(8);
    await expect(page.getByText("US$ 17,00 de US$ 20,00 (85%). Alerta em 80%.")).toBeVisible();
    await expect(page.getByRole("status").first()).toContainText("80%");
    await page.getByRole("tab", { name: "7 dias" }).click();
    await expect(page.getByRole("tab", { name: "7 dias" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("costs: per day, per task and per site", async ({ page, context }) => {
    await withSite(context, { admin: true, spentUsd: 1.7 });
    await page.goto("/admin/custos");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Custos dos últimos 30 dias");
    await expect(page.getByText("Média por site")).toBeVisible();
    await expect(page.getByText("Direções").first()).toBeVisible();
  });

  test("accounts: search, filter, detail and an exception with its reason", async ({
    page,
    context,
  }) => {
    const state = await withSite(context, { admin: true });
    await page.goto("/admin/contas");
    await expect(page.getByRole("status")).toHaveText("2 contas");
    await page.getByLabel("Buscar por e-mail ou nome").fill("ana");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("status")).toHaveText("1 conta");
    await expect(page.getByRole("link", { name: /ana@bolosdaana\.com\.br/ })).toBeVisible();
    expect(state.adminGets.at(-1)).toContain("q=ana");

    await page.getByLabel("Buscar por e-mail ou nome").fill("");
    await page.getByLabel("Filtro").selectOption("limit");
    await page.getByRole("button", { name: "Buscar" }).click();
    const ze = page.getByRole("link", { name: /ze@padariadoze\.com\.br/ });
    await expect(ze).toContainText("estourou o limite de rodadas");
    expect(state.adminGets.at(-1)).toContain("filter=limit");

    await ze.click();
    const zeId = fakeAccounts[0]?.userId as string;
    await expect(page).toHaveURL(new RegExp(`/admin/contas/${zeId}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ze@padariadoze.com.br");
    expect(state.adminGets).toContain(`/api/admin/accounts/${zeId}`);

    await page.getByRole("button", { name: "Liberar mais 1 site em andamento" }).click();
    const confirm = page.getByRole("button", { name: /^Confirmar/ });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Motivo (fica no log)").fill("Agência com dois clientes.");
    await confirm.click();
    await expect(page.getByText("Feito. A ação foi registrada no log.")).toBeVisible();
    expect(state.adminPosts.at(-1)).toEqual({
      path: "/api/admin/limits",
      body: { action: "grant_site_slot", userId: zeId, note: "Agência com dois clientes." },
    });
  });

  test("limits: values in force, the dry run and postponing a deletion", async ({
    page,
    context,
  }) => {
    const state = await withSite(context, { admin: true });
    await page.goto("/admin/limites");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Limites");
    await expect(page.getByText("Serão apagados nos próximos 7 dias:")).toContainText("1 site");
    // Client domains against the 100 the hosting includes, with the alert from 80 (E25).
    await expect(page.getByText("84 de 100 incluídos", { exact: true })).toBeVisible();
    await expect(page.getByRole("status").first()).toContainText(
      "Domínios de clientes: 84 de 100 incluídos.",
    );
    await page.getByRole("button", { name: "Adiar 14 dias" }).click();
    await page.getByLabel("Motivo (fica no log)").fill("Cliente pediu mais prazo.");
    await page.getByRole("button", { name: "Confirmar o adiamento" }).click();
    await expect(page.getByText("Feito. A ação foi registrada no log.")).toBeVisible();
    expect(state.adminPosts.at(-1)).toEqual({
      path: "/api/admin/limits",
      body: { action: "extend_cleanup", siteId: SITE, days: 14, note: "Cliente pediu mais prazo." },
    });
  });

  test("the queue shows each site's AI cost and rounds", async ({ page, context }) => {
    await withSite(context, {
      admin: true,
      site: siteRow("in_review", { subdomain: "padaria-do-ze" }),
      draft: padaria,
    });
    await page.goto("/admin");
    const item = page.getByRole("link", { name: /Padaria do Zé/ });
    await expect(item).toContainText("IA US$ 0,42");
    await expect(item).toContainText("2 rodadas");
  });
});
