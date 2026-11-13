import { expect, test } from "@playwright/test";
import { padaria, SITE, siteRow, withSite } from "./support/supabase";

// The admin panel (E11): only listed admins get in; the queue, the review of one site with the
// reviewer's report, the logged decisions, and the catalog promotion cycle.

const inReview = {
  site: siteRow("in_review", {
    subdomain: "padaria-do-ze",
    preview_token: "tok_abcdefghijklmnopqrstuvwxyz012345",
    approved_direction: "d0000000-0000-4000-8000-000000000001",
  }),
  draft: padaria,
};

test("the panel asks to sign in, and is closed to clients", async ({ page, context }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fadmin$/);
  await withSite(context, inReview);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acesso restrito");
});

test("the queue lists sites waiting for a person, by status", async ({ page, context }) => {
  await withSite(context, { ...inReview, admin: true });
  await page.goto("/admin");
  await expect(page.getByRole("tab", { name: /Em revisão/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const item = page.getByRole("link", { name: /Padaria do Zé/ });
  await expect(item).toContainText("Revisor: ajustes sugeridos");
  await page.getByRole("tab", { name: /Suspensos/ }).click();
  await expect(page.getByText("Nada aqui agora.")).toBeVisible();
  await page.getByRole("tab", { name: /Em revisão/ }).click();
  await item.click();
  await expect(page).toHaveURL(new RegExp(`/admin/sites/${SITE}$`));
});

test("reviewing a site: report, answers, and decisions that need a reason", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { ...inReview, admin: true });
  await page.goto(`/admin/sites/${SITE}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Padaria do Zé");
  await expect(page.getByText("O título repete o nome do negócio.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Abrir o site montado/ })).toHaveAttribute(
    "href",
    `https://previa.sites.localhost/${SITE}/tok_abcdefghijklmnopqrstuvwxyz012345/`,
  );
  await expect(page.getByText("Pão de fermentação natural", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Pedir ajustes" }).click();
  await expect(
    page.getByText("Escreva o motivo: o cliente e o registro precisam dele."),
  ).toBeVisible();
  await page.getByLabel("Nota").fill("Troque o título: ele repete o nome.");
  await page.getByRole("button", { name: "Pedir ajustes" }).click();
  await expect(page.getByText("Decisão registrada.")).toBeVisible();
  expect(state.adminPosts.at(-1)).toEqual({
    path: `/api/admin/sites/${SITE}/decide`,
    body: { action: "request_changes", note: "Troque o título: ele repete o nome." },
  });
  await expect(page.getByText(/Montando seu site/)).toBeVisible();
});

test("a site that needs attention runs its failed step again, after a confirmation (E39)", async ({
  page,
  context,
}) => {
  const state = await withSite(context, {
    ...inReview,
    site: { ...inReview.site, status: "needs_attention", preview_token: null },
    admin: true,
  });
  await page.goto(`/admin/sites/${SITE}`);
  const retry = page.getByRole("region", { name: "Tentar de novo" });
  await expect(retry).toContainText("Montar o site");
  await expect(retry).toContainText("0 de 3 tentativas");
  await retry.getByRole("button", { name: "Tentar de novo" }).click();
  // Nothing is sent before the second click.
  expect(state.adminPosts.filter((post) => post.path.endsWith("/retry"))).toEqual([]);
  await retry.getByRole("button", { name: "Confirmar: montar o site de novo" }).click();
  await expect(page.getByText(/Nova tentativa iniciada/)).toBeVisible();
  expect(state.adminPosts.at(-1)).toEqual({
    path: `/api/admin/sites/${SITE}/retry`,
    body: { confirm: true },
  });
  expect(state.site?.status).toBe("building");
});

test("what went wrong: the step, the cause, the details and the run, for the team (E39)", async ({
  page,
  context,
}) => {
  const failedJob = {
    id: "j0000000-0000-4000-8000-000000000002",
    kind: "build",
    step: "Montar o site",
    status: "failed",
    attempts: 2,
    error: `page.evaluate: ReferenceError: __name is not defined\n${"    at eval (bundle.js:1:1)\n".repeat(80)}`,
    cause: {
      id: "keep-names",
      summary:
        "O revisor não conseguiu rodar no navegador: o código empacotado chama __name, que não existe na página.",
      action:
        "Corrigido no E39. Rode “Deploy jobs” com a versão atual da main e use “Tentar de novo”.",
    },
    createdAt: "2026-11-12T10:00:00Z",
    startedAt: "2026-11-12T10:00:05Z",
    finishedAt: "2026-11-12T10:03:00Z",
    triggerRunId: "run_cm1abc2def3ghi",
    retry: false,
  };
  await withSite(context, {
    ...inReview,
    site: { ...inReview.site, status: "needs_attention", preview_token: null },
    admin: true,
    adminJobs: [failedJob],
    failure: {
      step: "Montar o site",
      summary: failedJob.cause.summary,
      at: failedJob.finishedAt,
    },
    events: [
      {
        id: 1,
        kind: "job_failed",
        message: "Algo deu errado do nosso lado. Nossa equipe já foi avisada.",
        created_at: "2026-11-12T10:03:01Z",
      },
    ],
  });
  // The queue: a short line of what failed.
  await page.goto("/admin");
  await page.getByRole("tab", { name: /Precisa de atenção/ }).click();
  await expect(page.getByRole("link", { name: /Padaria do Zé/ })).toContainText(
    "Montar o site falhou: O revisor não conseguiu rodar no navegador",
  );

  // The overview: the same line, with a way to the site.
  await page.goto("/admin/visao-geral");
  const attention = page.getByRole("region", { name: "1 site precisa de atenção" });
  await expect(attention).toContainText("Montar o site falhou:");
  await attention.getByRole("link", { name: "Padaria do Zé" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/sites/${SITE}$`));
  const section = page.getByRole("region", { name: "O que deu errado" });
  await expect(section).toContainText("Montar o site");
  await expect(section).toContainText("2 tentativas");
  await expect(section).toContainText("O que fazer: Corrigido no E39.");
  // Before the reviewer's report.
  const box = await section.boundingBox();
  const report = await page.getByRole("heading", { name: "Relatório do revisor" }).boundingBox();
  expect(box && report && box.y < report.y).toBe(true);
  // The long text is folded, then scrolls inside its box.
  const details = section.locator("pre");
  await expect(details).toBeHidden();
  await section.getByText("Detalhes técnicos").click();
  await expect(details).toBeVisible();
  expect(await details.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await details.focus();
  await expect(details).toBeFocused();
  await expect(
    section.getByRole("link", { name: /Abrir a execução no Trigger.dev/ }),
  ).toHaveAttribute("href", "https://cloud.trigger.dev/runs/run_cm1abc2def3ghi");
  // The history: the client's generic line, with the team's complement.
  await expect(
    page.getByText(/Nossa equipe já foi avisada\. \(Equipe: Montar o site: O revisor/),
  ).toBeVisible();
});

test("no failed step: no section about errors", async ({ page, context }) => {
  await withSite(context, { ...inReview, admin: true });
  await page.goto(`/admin/sites/${SITE}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Padaria do Zé");
  await expect(page.getByRole("region", { name: "O que deu errado" })).toHaveCount(0);
});

test("approving sends the finished site to the client", async ({ page, context }) => {
  const state = await withSite(context, { ...inReview, admin: true });
  await page.goto(`/admin/sites/${SITE}`);
  await page.getByRole("button", { name: "Aprovar para o cliente" }).click();
  await expect(page.getByText("Decisão registrada.")).toBeVisible();
  expect(state.site?.status).toBe("awaiting_approval");
});

test("the catalog shows the metrics and records recommendations and requests", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { ...inReview, admin: true });
  await page.goto("/admin/catalogo");
  const compositions = page.getByRole("region", { name: "Composições" });
  await expect(compositions.getByRole("row", { name: /c0ffee00c0ffee00/ })).toContainText("1.5");
  await compositions.getByRole("button", { name: "Aposentar c0ffee00c0ffee00" }).click();
  await expect(
    page.getByText("Catálogo atualizado. Vale para as próximas direções."),
  ).toBeVisible();
  const variants = page.getByRole("region", { name: "Variantes" });
  await expect(variants.getByText("Recomendada")).toBeVisible();

  await page.getByLabel("O que falta").fill("Uma galeria em mosaico para padarias.");
  await page.getByLabel("Seção").selectOption("galeria");
  await page.getByRole("button", { name: "Registrar pedido" }).click();
  await expect(page.getByText("Pedido registrado.")).toBeVisible();
  expect(state.adminPosts.map((post) => post.body)).toEqual([
    { kind: "composition", ref: "c0ffee00c0ffee00", state: "retired" },
    { family: "food", section: "galeria", note: "Uma galeria em mosaico para padarias." },
  ]);
});

test("with the switch off, the team goes straight in and sees the reminder (E33)", async ({
  page,
  context,
}) => {
  await withSite(context, { ...inReview, admin: true });
  await page.goto("/admin");
  await expect(page.getByRole("navigation", { name: "Área da equipe" })).toBeVisible();
  const note = page.getByRole("note");
  await expect(note).toContainText("A verificação em duas etapas está desligada.");
  await expect(note).toContainText("update public.team_settings set require_second_factor = true;");
});

test("with the switch on, the team types the code first, and no reminder shows (E33)", async ({
  page,
  context,
}) => {
  await withSite(context, { ...inReview, admin: false, member: true, secondFactor: true });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Verificação em duas etapas");
  await expect(page.getByText("A verificação em duas etapas está desligada.")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Área da equipe" })).toHaveCount(0);
});

test("a client sees no reminder and is sent to the site (E33)", async ({ page, context }) => {
  await withSite(context, inReview);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acesso restrito");
  await expect(page.getByText("A verificação em duas etapas está desligada.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ir para o site" })).toBeVisible();
});
