import { expect, test } from "@playwright/test";
import {
  allBefore,
  allSteps,
  PAYMENT,
  padaria,
  SITE,
  siteRow,
  threeDirections,
  withSite,
} from "./support/supabase";

// After the form: sending the answers, the 3 directions on the site page, the finished site,
// the address, approval and the test payment. Generation is asynchronous: no loading screen.

const dashboard = `/meus-sites/${SITE}`;

test("the site pages need an account, and the old page leads to the dashboard", async ({
  page,
}) => {
  await page.goto("/meu-site");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fmeus-sites$/);
});

test("sending the answers starts the directions and opens the dashboard", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { draft: padaria, completed: allBefore("contato") });
  // The 5th step ends with a short look at the answers and the send button (E25).
  await page.goto(`/criar/${SITE}/contato`);
  const review = page.locator("#conferir");
  await expect(review.getByRole("group", { name: "Confira antes de enviar" })).toBeVisible();
  await expect(review.getByText(/Padaria do Zé/)).toBeVisible();
  await expect(review.getByRole("link", { name: "Mudar" }).first()).toHaveAttribute(
    "href",
    `/criar/${SITE}/negocio`,
  );
  await expect(review.getByText(/Fiel à marca/)).toBeVisible();
  await page.getByRole("button", { name: "Enviar e ver as direções" }).click();
  await expect(page).toHaveURL(new RegExp(`${dashboard}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Padaria do Zé");
  await expect(page.getByRole("status").first()).toContainText("Criando as 3 direções");
  await expect(page.getByText("Respostas recebidas. Estamos criando as 3 direções.")).toBeVisible();
  expect(state.rpc.map((call) => call.name)).toContain("request_directions");
  // The server asks the database (with the limits) and starts the job itself.
  expect(state.api).toContain(`/api/sites/${SITE}/directions`);
  expect(state.saved.at(-1)?.completed).toEqual(allSteps);
});

test("what is missing to generate is listed, with links back", async ({ page, context }) => {
  await withSite(context, {
    draft: { business: { name: "Padaria do Zé" } },
    completed: allBefore("contato"),
  });
  await page.goto(`/criar/${SITE}/contato`);
  await expect(page.getByText("o tipo de negócio")).toBeVisible();
  await expect(page.getByText("um contato (WhatsApp, telefone ou e-mail)")).toBeVisible();
  await expect(page.locator("#conferir").getByRole("link", { name: "negócio" })).toHaveAttribute(
    "href",
    `/criar/${SITE}/negocio`,
  );
});

test("choosing one of the 3 directions, after a confirmation", async ({ page, context }) => {
  const state = await withSite(context, {
    site: siteRow("awaiting_direction_choice"),
    draft: padaria,
    completed: allSteps,
    directions: threeDirections,
  });
  await page.goto(dashboard);
  const cards = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) });
  await expect(cards.getByRole("heading", { level: 3 })).toHaveText([
    "Fiel à marca",
    "Evolução",
    "Contraste",
  ]);
  await expect(page.getByRole("img", { name: "Direção Evolução, no computador" })).toBeVisible();

  const evolution = cards.filter({ hasText: "Evolução" });
  await evolution.getByRole("button", { name: "Escolher esta" }).click();
  await expect(evolution.getByText("A identidade fica fixa depois disso.")).toBeVisible();
  await evolution.getByRole("button", { name: "Sim, escolher" }).click();
  await expect(page.getByRole("status").first()).toContainText("Montando seu site");
  expect(state.rpc.at(-1)).toEqual({
    name: "choose_direction",
    body: { p_site_id: SITE, p_direction_id: threeDirections[1]?.id },
  });
});

test("none of the 3 fits: asking for 3 more", async ({ page, context }) => {
  const state = await withSite(context, {
    site: siteRow("awaiting_direction_choice"),
    draft: padaria,
    directions: threeDirections,
  });
  await page.goto(dashboard);
  // E41: the round is spent only after the client says what to change, or skips it.
  const redo = page.getByRole("button", { name: "Nenhuma serviu: criar outras 3" });
  await expect(redo).toHaveAttribute("aria-expanded", "false");
  await redo.click();
  await expect(redo).toHaveAttribute("aria-expanded", "true");
  expect(state.rpc.filter((call) => call.name === "request_directions")).toEqual([]);
  await page.getByRole("button", { name: "Criar sem dizer o motivo" }).click();
  await expect(page.getByRole("status").first()).toContainText("Criando as 3 direções");
  expect(state.rpc.at(-1)).toEqual({ name: "request_directions", body: { p_site_id: SITE } });
});

test("asking for 3 more, saying what to change (E41)", async ({ page, context }) => {
  const state = await withSite(context, {
    site: siteRow("awaiting_direction_choice"),
    draft: padaria,
    directions: threeDirections,
  });
  await page.goto(dashboard);
  await page.getByRole("button", { name: "Nenhuma serviu: criar outras 3" }).click();
  const panel = page.getByRole("region", { name: "O que você não gostou?" });
  const lighter = panel.getByRole("button", { name: "Mais claro" });
  const darker = panel.getByRole("button", { name: "Mais escuro" });
  await lighter.click();
  await expect(lighter).toHaveAttribute("aria-pressed", "true");
  // Opposites replace each other.
  await darker.click();
  await expect(darker).toHaveAttribute("aria-pressed", "true");
  await expect(lighter).toHaveAttribute("aria-pressed", "false");
  await panel.getByRole("button", { name: "Outras fontes" }).click();
  await panel.getByLabel("Quer contar mais? (opcional)").fill("  Queria algo mais  alegre.  ");
  await expect(panel.getByText("29/140")).toBeVisible();
  await panel.getByRole("button", { name: "Criar outras 3" }).click();
  await expect(page.getByRole("status").first()).toContainText("Criando as 3 direções");
  expect(state.rpc.at(-1)).toEqual({
    name: "request_directions",
    body: {
      p_site_id: SITE,
      feedback: { reasons: ["darker", "fonts"], note: "Queria algo mais  alegre." },
    },
  });
});

const finished = {
  draft: padaria,
  completed: allSteps,
  site: siteRow("awaiting_approval", {
    subdomain: "padaria-do-ze",
    preview_token: "tok_abcdefghijklmnopqrstuvwxyz012345",
    approved_direction: threeDirections[0]?.id ?? null,
  }),
};

test("the finished site: private address, approval and the test payment", async ({
  page,
  context,
}) => {
  const state = await withSite(context, finished);
  await page.goto(dashboard);
  await expect(page.getByRole("link", { name: /Ver o site pronto/ })).toHaveAttribute(
    "href",
    `https://previa.sites.localhost/${SITE}/tok_abcdefghijklmnopqrstuvwxyz012345/`,
  );
  await page.getByRole("button", { name: "Aprovar e publicar" }).click();
  await expect(page).toHaveURL(new RegExp(`${dashboard}/pagamento\\?p=${PAYMENT}$`));
  await expect(page.getByText("R$ 297")).toBeVisible();
  await expect(page.getByText("Pagamento único. Sem mensalidade.")).toBeVisible();
  await page.getByRole("button", { name: "Simular pagamento aprovado" }).click();
  await expect(page).toHaveURL(new RegExp(`${dashboard}$`));
  await expect(page.getByRole("status").first()).toContainText("Colocando no ar");
  expect(state.api).toEqual(
    expect.arrayContaining([`/api/sites/${SITE}/approve`, `/api/payments/${PAYMENT}/confirm-stub`]),
  );
});

test("asking for changes rebuilds with the approved identity", async ({ page, context }) => {
  const state = await withSite(context, finished);
  await page.goto(dashboard);
  await expect(page.getByRole("link", { name: "Textos, serviços e fotos" })).toHaveAttribute(
    "href",
    `/criar/${SITE}/conteudo`,
  );
  await page.getByRole("button", { name: "Montar o site de novo com as mudanças" }).click();
  await expect(page.getByRole("status").first()).toContainText("Montando seu site");
  expect(state.rpc.at(-1)?.name).toBe("request_rebuild");
});

test("a build that failed on our side: a generic message and one way to try again (E39)", async ({
  page,
  context,
}) => {
  const state = await withSite(context, {
    ...finished,
    site: {
      ...finished.site,
      status: "needs_attention",
      preview_token: null,
      status_message: "Algo deu errado do nosso lado. Nossa equipe já foi avisada.",
    },
    events: [
      {
        id: 9,
        kind: "job_failed",
        message: "Algo deu errado do nosso lado. Nossa equipe já foi avisada.",
        created_at: "2026-11-12T10:00:00Z",
      },
    ],
  });
  await page.goto(dashboard);
  await expect(page.getByRole("status").first()).toContainText("Precisa de atenção");
  await expect(
    page.getByRole("heading", { name: "Não conseguimos terminar o seu site" }),
  ).toBeVisible();
  // Never the technical detail: that is for the team only.
  await expect(page.getByText(/__name|ReferenceError|stack|JobError/)).toHaveCount(0);
  // One button for it (the rebuild button of "Pedir ajustes" stays out of the way).
  await expect(
    page.getByRole("button", { name: "Montar o site de novo com as mudanças" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByRole("status").first()).toContainText("Montando seu site");
  expect(state.rpc.at(-1)?.name).toBe("request_rebuild");
});

test("directions that failed on our side: the page opens and leads back to the answers", async ({
  page,
  context,
}) => {
  await withSite(context, {
    site: siteRow("needs_attention", {
      status_message: "Algo deu errado do nosso lado. Nossa equipe já foi avisada.",
    }),
    draft: padaria,
    completed: allSteps,
  });
  await page.goto(dashboard);
  await expect(page.getByRole("status").first()).toContainText("Precisa de atenção");
  await expect(
    page.getByRole("link", { name: "Revisar as respostas e tentar de novo" }),
  ).toHaveAttribute("href", `/criar/${SITE}/contato`);
});

test("a finished site made from few answers invites the client to tell more (E41)", async ({
  page,
  context,
}) => {
  await withSite(context, {
    ...finished,
    draft: { ...padaria, business: { ...padaria.business, description: "Padaria.", story: {} } },
  });
  await page.goto(dashboard);
  await expect(page.getByText(/Seu site ficaria ainda melhor com mais detalhes/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Pedir ajustes" })).toHaveAttribute(
    "href",
    "#ajustes",
  );
});

test("a finished site from full answers shows no such note", async ({ page, context }) => {
  await withSite(context, {
    ...finished,
    draft: {
      ...padaria,
      business: { ...padaria.business, story: { bestseller: "Pão de queijo e bolo de fubá" } },
    },
  });
  await page.goto(dashboard);
  await expect(page.getByRole("heading", { name: "Site pronto" })).toBeVisible();
  await expect(page.getByText(/Seu site ficaria ainda melhor/)).toHaveCount(0);
});

test("the address: suggestion, availability and keeping it before approving", async ({
  page,
  context,
}) => {
  const state = await withSite(context, {
    ...finished,
    site: { ...finished.site, subdomain: null },
    taken: ["padaria-do-ze"],
  });
  // "Publicar" is the site's own page now (it was step 7 of the form).
  await page.goto(`${dashboard}/publicar`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Onde o seu site vai morar?");
  await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue("padaria-do-ze");
  await expect(page.getByText("Esse endereço já está em uso.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar e publicar" })).toBeDisabled();
  await page.getByRole("button", { name: /^Usar padaria-do-ze-/ }).click();
  await expect(page.getByText("Disponível.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar este endereço" }).click();
  await expect(page.getByText("Endereço guardado para o seu site.")).toBeVisible();
  expect(state.site?.subdomain).toMatch(/^padaria-do-ze-santa-rita/);
  await page.getByRole("button", { name: "Aprovar e publicar" }).click();
  await expect(page).toHaveURL(new RegExp(`${dashboard}/pagamento`));
});

test("a published site can be downloaded as a .zip", async ({ page, context }) => {
  await withSite(context, {
    ...finished,
    site: { ...finished.site, status: "live" },
  });
  await page.goto(dashboard);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar o site (.zip)" }).click();
  expect((await download).suggestedFilename()).toBe("site.zip");
});

test("old addresses of steps 6 and 7 lead to the site's pages", async ({ page, context }) => {
  await withSite(context, finished);
  await page.goto(`/criar/${SITE}/direcao`);
  await expect(page).toHaveURL(new RegExp(`${dashboard}$`));
  await page.goto(`/criar/${SITE}/endereco`);
  await expect(page).toHaveURL(new RegExp(`${dashboard}/publicar$`));
  await expect(page.getByRole("button", { name: "Aprovar e publicar" })).toBeVisible();
  await page.goto(`/criar/${SITE}/etapa/marca`);
  await expect(page).toHaveURL(new RegExp(`/criar/${SITE}/marca$`));
});

test("before a direction is chosen, Publicar says what comes first", async ({ page, context }) => {
  await withSite(context, { site: siteRow("awaiting_direction_choice"), draft: padaria });
  await page.goto(`${dashboard}/publicar`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ainda não é hora de publicar");
  await expect(page.getByRole("link", { name: "Ir para a página do site" })).toHaveAttribute(
    "href",
    dashboard,
  );
});

test("the site page leads to Publicar when the site is ready", async ({ page, context }) => {
  await withSite(context, { ...finished, site: { ...finished.site, subdomain: null } });
  await page.goto(dashboard);
  await page.getByRole("link", { name: "Publicar: endereço e aprovação" }).click();
  await expect(page).toHaveURL(new RegExp(`${dashboard}/publicar$`));
});
