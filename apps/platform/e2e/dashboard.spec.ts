import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { pricing } from "../src/config/pricing";
import { BASE } from "./support/accounts";
import { SUPABASE, signIn } from "./support/supabase";
import { findSmallTargetsWhileScrolling } from "./support/targets";

// The dashboard (E16): rendered on the server from the fake Supabase (support/fake-supabase.mjs),
// with each test's own account so parallel tests never share a dashboard.

const person = () => {
  const id = randomUUID();
  return { id, email: `painel-${id.slice(0, 8)}@padariadoze.com.br` };
};

const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function row(
  status: string,
  extra: Record<string, unknown> & { name?: string; completed?: string[] } = {},
) {
  const { name = "Padaria do Zé", completed = [], ...rest } = extra;
  return {
    id: randomUUID(),
    status,
    subdomain: null,
    status_message: null,
    created_at: days(10),
    updated_at: days(1),
    approved_at: null,
    published_at: null,
    site_configs: { name, completed },
    site_events: [],
    ...rest,
  };
}

async function board(
  request: APIRequestContext,
  userId: string,
  data: { sites?: unknown[]; notices?: unknown[]; fullName?: string },
) {
  await request.post(`${SUPABASE}/__test/dashboard`, {
    data: { userId, fullName: "Zé da Padaria", ...data },
  });
}

test("without a session the server sends people to sign in", async ({ request }) => {
  const response = await request.get("/painel", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/entrar?voltar=%2Fpainel");
});

test("the dashboard is never cached nor indexed", async ({ context, request }) => {
  const who = person();
  await board(request, who.id, {});
  await signIn(context, { user: who });
  const response = await context.request.get("/painel");
  // Private and never stored: no shared cache keeps it (Next.js sets the page's own Vary).
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(response.headers()["x-robots-tag"]).toBe("noindex");
});

test("with no sites: an invitation, and nothing pending", async ({ page, context, request }) => {
  const who = person();
  await board(request, who.id, {});
  await signIn(context, { user: who });
  await page.goto("/painel");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Olá, Zé");
  await expect(page.getByRole("main").getByText(who.email)).toBeVisible();
  await expect(page.getByText("Tudo em dia.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Crie seu primeiro site" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar meu site" })).toHaveAttribute(
    "href",
    "/criar",
  );
  // The account lives in the profile menu of the one header (E17), read on the server.
  await page.getByRole("button", { name: "Menu da conta de Zé da Padaria" }).click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Painel",
    "Criar site",
    "Perfil e segurança",
    "Sair",
  ]);
});

test("each status shows its label, what is pending and the right button", async ({
  page,
  context,
  request,
}) => {
  const who = person();
  const sites = [
    row("draft", { name: "Rascunho do Zé", completed: ["negocio"] }),
    row("awaiting_direction_choice", { name: "Bolos da Ana" }),
    row("awaiting_approval", { name: "Oficina do Beto" }),
    row("needs_attention", { name: "Café da Lu", status_message: "Falta uma foto da fachada." }),
    row("building", {
      name: "Barbearia",
      site_events: [{ kind: "directions_ready", created_at: days(3) }],
    }),
    row("suspended", { name: "Loja Suspensa" }),
  ];
  await board(request, who.id, { sites, fullName: "" });
  await signIn(context, { user: who, confirmed: false });
  await page.goto("/painel");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Olá");
  const pending = page.getByRole("region", { name: "Precisa de você" });
  await expect(pending.getByRole("complementary", { name: "Confirmação do e-mail" })).toBeVisible();
  await expect(pending.getByRole("heading", { level: 3 })).toHaveText([
    "Café da Lu: Precisa de atenção",
    "Bolos da Ana: Escolha uma das 3",
    "Oficina do Beto: Site pronto para conferir",
    "Rascunho do Zé: Rascunho",
    "Complete o seu perfil",
  ]);
  await expect(pending.getByText("Falta uma foto da fachada.")).toBeVisible();
  await expect(pending.getByText("Continue de onde parou: Marca e sensação.")).toBeVisible();

  const card = (name: string) =>
    page.getByRole("region", { name: "Seus sites" }).getByRole("listitem", { name });
  await expect(card("Rascunho do Zé").getByRole("link", { name: /^Continuar/ })).toHaveAttribute(
    "href",
    `/criar/${sites[0]?.id}/marca`,
  );
  await expect(card("Bolos da Ana")).toContainText("Sua vez");
  await expect(
    card("Bolos da Ana").getByRole("link", { name: /^Escolher direção/ }),
  ).toHaveAttribute("href", `/meus-sites/${sites[1]?.id}`);
  await expect(card("Oficina do Beto").getByRole("link", { name: /^Revisar/ })).toBeVisible();
  await expect(card("Barbearia")).toContainText("Montando seu site");
  await expect(card("Barbearia").getByRole("list", { name: "Linha do tempo" })).toContainText(
    "Direções prontas",
  );
  await expect(card("Loja Suspensa")).toContainText(
    "Seu site foi suspenso. Veja os motivos na página do site.",
  );
  // No admin data reaches the page.
  await expect(page.getByText(/Nota interna/)).toHaveCount(0);
});

test("a published site shows its address, hosting and days of changes left", async ({
  page,
  context,
  request,
}) => {
  const who = person();
  const publishedAt = days(5);
  await board(request, who.id, {
    sites: [
      row("live", {
        subdomain: "padaria-do-ze",
        approved_at: days(6),
        published_at: publishedAt,
      }),
    ],
  });
  await signIn(context, { user: who });
  await page.goto("/painel");
  const card = page.getByRole("listitem", { name: "Padaria do Zé" });
  await expect(card.getByRole("link", { name: /padaria-do-ze\.sites\.localhost/ })).toHaveAttribute(
    "href",
    "https://padaria-do-ze.sites.localhost",
  );
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date(publishedAt))
    .split("-")
    .map(Number) as [number, number, number];
  const until = new Date(Date.UTC(year, month - 1 + pricing.hostingMonths, day));
  const untilText = `${String(until.getUTCDate()).padStart(2, "0")}/${String(until.getUTCMonth() + 1).padStart(2, "0")}/${until.getUTCFullYear()}`;
  await expect(card).toContainText(`Hospedagem incluída até${untilText}`);
  await expect(card).toContainText(`${pricing.adjustmentsDays - 5} dias restantes`);
  await expect(card.getByRole("list", { name: "Linha do tempo" }).getByRole("listitem")).toHaveText(
    [/^Criado/, /^Aprovado/, /^Publicado/],
  );
  await expect(card.getByRole("link", { name: /^Baixar o site/ })).toBeVisible();
  await expect(page.getByText("Tudo em dia.")).toBeVisible();
});

test("a notice shows, leads to the right page and is read when opened", async ({
  page,
  context,
  request,
}) => {
  const who = person();
  const site = row("awaiting_direction_choice", { name: "Bolos da Ana" });
  const notice = {
    id: randomUUID(),
    kind: "directions_ready",
    site_id: site.id,
    created_at: days(0),
    read_at: null,
  };
  await board(request, who.id, { sites: [site], notices: [notice] });
  await signIn(context, { user: who });
  await page.goto("/painel");
  const bell = page.getByRole("button", { name: "Avisos, 1 não lido" });
  await expect(bell).toBeVisible();
  await bell.click();
  const link = page.getByRole("link", { name: /As 3 direções de Bolos da Ana estão prontas\./ });
  await expect(link).toHaveAttribute("href", `/meus-sites/${site.id}`);
  await expect(page.getByRole("button", { name: "Avisos", exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const stored = await (
        await request.get(`${SUPABASE}/__test/dashboard?userId=${who.id}`)
      ).json();
      return stored.notices[0].read_at !== null;
    })
    .toBe(true);
  // Read: gone from the count after a reload.
  await page.reload();
  await expect(page.getByRole("button", { name: "Avisos", exact: true })).toBeVisible();
});

test("marking notices goes through the platform, only for the person", async ({
  context,
  request,
}) => {
  const who = person();
  const other = person();
  const theirs = {
    id: randomUUID(),
    kind: "site_published",
    site_id: null,
    created_at: days(0),
    read_at: null,
  };
  await board(request, other.id, { notices: [theirs] });
  await board(request, who.id, {});
  await signIn(context, { user: who });
  const answer = await context.request.post("/api/notifications/read", {
    headers: { origin: BASE },
    data: { ids: [theirs.id] },
  });
  expect(answer.status()).toBe(200);
  expect((await answer.json()).marked).toBe(0);
  const stored = await (
    await request.get(`${SUPABASE}/__test/dashboard?userId=${other.id}`)
  ).json();
  expect(stored.notices[0].read_at).toBeNull();
  // Bad input, another site's Origin, no session: refused.
  expect(
    (
      await context.request.post("/api/notifications/read", {
        headers: { origin: BASE },
        data: { ids: ["1 or 1=1"] },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await context.request.post("/api/notifications/read", {
        headers: { origin: "https://evil.example" },
        data: { all: true },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/notifications/read", {
        headers: { origin: BASE },
        data: { all: true },
      })
    ).status(),
  ).toBe(401);
});

test("one person never sees another's sites", async ({ page, context, request }) => {
  const a = person();
  const b = person();
  await board(request, a.id, { sites: [row("live", { name: "Site da Ana" })] });
  await board(request, b.id, { sites: [row("draft", { name: "Site do Beto" })] });
  await signIn(context, { user: b });
  await page.goto("/painel");
  await expect(page.getByText("Site do Beto").first()).toBeVisible();
  await expect(page.getByText("Site da Ana")).toHaveCount(0);
});

test("the old list address leads to the dashboard; site pages keep theirs", async ({
  context,
  request,
}) => {
  const answer = await request.get("/meus-sites", { maxRedirects: 0 });
  expect(answer.status()).toBe(308);
  expect(answer.headers().location).toBe("/painel");
  const who = person();
  await board(request, who.id, {});
  await signIn(context, { user: who });
  const site = await context.request.get(`/meus-sites/${randomUUID()}`, { maxRedirects: 0 });
  expect(site.status()).toBe(200);
});

test("the dashboard passes axe, with 44px targets and no sideways scroll", async ({
  page,
  context,
  request,
}) => {
  const who = person();
  await board(request, who.id, {
    sites: [
      row("live", { subdomain: "padaria-do-ze", published_at: days(2), approved_at: days(3) }),
      row("draft", { name: "Outro site", completed: ["negocio", "marca"] }),
    ],
    notices: [
      {
        id: randomUUID(),
        kind: "email_confirmed",
        site_id: null,
        created_at: days(1),
        read_at: null,
      },
    ],
  });
  await signIn(context, { user: who });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/painel");
  await page.getByRole("button", { name: /^Avisos/ }).click();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).join(" | ")}`),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.keyboard.press("Escape");
  const small = await findSmallTargetsWhileScrolling(page);
  expect(small).toEqual([]);
});
