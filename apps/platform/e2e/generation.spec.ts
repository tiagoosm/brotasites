import { expect, test } from "@playwright/test";
import { createUser, ownIp, PASSWORD, uniqueEmail } from "./support/accounts";
import { padaria, SITE, siteRow, withSite } from "./support/supabase";

// E34: creating a site never ends in a site stuck in "Criando as 3 direções". In production,
// until generation is set up, creating is closed (the second e2e server runs with that rule);
// a job left queued too long offers "Tentar de novo"; the team's overview names what is missing.

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

test("a job stuck in the queue offers to try again, and says when it still cannot start", async ({
  page,
  context,
}) => {
  const state = await withSite(context, {
    site: siteRow("generating_directions"),
    draft: padaria,
    job: { id: "a0000000-0000-4000-8000-000000000001", status: "queued", created_at: ago(20) },
  });
  await page.goto(`/meus-sites/${SITE}`);
  const stuck = page.getByRole("region", { name: "Isto está demorando mais que o normal" });
  await expect(stuck).toBeVisible();
  await expect(stuck).toContainText("Suas respostas estão guardadas.");
  await stuck.getByRole("button", { name: "Tentar de novo" }).click();
  const failed = page.getByText("Ainda não foi possível começar. Tente de novo mais tarde.");
  await expect(failed).toBeVisible();
  expect(state.api).toContain("/api/jobs/start");
  // When the queue answers, no error.
  state.jobStarts = true;
  await stuck.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(failed).toHaveCount(0);
});

test("a job queued a few minutes ago is not stuck", async ({ page, context }) => {
  await withSite(context, {
    site: siteRow("generating_directions"),
    draft: padaria,
    job: { id: "a0000000-0000-4000-8000-000000000001", status: "queued", created_at: ago(2) },
  });
  await page.goto(`/meus-sites/${SITE}`);
  await expect(page.getByText("Criando as 3 direções").first()).toBeVisible();
  await expect(page.getByText("Isto está demorando mais que o normal")).toHaveCount(0);
});

test("the team's overview names what generation is missing, never values", async ({
  page,
  context,
}) => {
  await withSite(context, {
    admin: true,
    generation: {
      enforced: true,
      ready: false,
      missing: ["TRIGGER_SECRET_KEY", "CLOUDFLARE_KV_NAMESPACE_ID"],
      stuckJobs: 2,
      stuckMinutes: 15,
    },
  });
  await page.goto("/admin/visao-geral");
  const notice = page.getByRole("status").filter({ hasText: "A criação de sites está fechada" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("TRIGGER_SECRET_KEY");
  await expect(notice).toContainText("CLOUDFLARE_KV_NAMESPACE_ID");
  await expect(notice).toContainText("docs/launch-status.md");
  await expect(
    page.getByText("2 gerações estão paradas na fila há mais de 15 minutos."),
  ).toBeVisible();
});

test("with generation set up and nothing stuck, the overview says nothing", async ({
  page,
  context,
}) => {
  await withSite(context, {
    admin: true,
    generation: { enforced: true, ready: true, missing: [], stuckJobs: 0, stuckMinutes: 15 },
  });
  await page.goto("/admin/visao-geral");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visão geral");
  await expect(page.getByText("A criação de sites está fechada")).toHaveCount(0);
});

test.describe("in production without generation set up", () => {
  const PLATFORM = "http://platform.localhost:3101";
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads the fixtures from this pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "one browser is enough for the server's rule");
  });

  test("creating is closed: a clear page, and no site or job is created (E34)", async ({
    page,
    context,
    request,
  }) => {
    await ownIp(context);
    const email = uniqueEmail("geracao");
    await createUser(request, { email });
    await page.goto(`${PLATFORM}/entrar`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(`${PLATFORM}/meus-sites`);

    await page.goto(`${PLATFORM}/criar?novo=1`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Estamos preparando a criação de sites",
    );
    await expect(
      page.getByText(
        "Estamos preparando a criação de sites. Avisaremos você por e-mail quando abrir.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para Meus sites" })).toBeVisible();

    // The API refuses too, before any site or job is written (asked from the page, with its
    // session and its origin).
    const answers = await page.evaluate(async (site) => {
      const post = async (path: string) => {
        const response = await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        return { status: response.status, body: await response.json().catch(() => ({})) };
      };
      return {
        created: await post("/api/sites"),
        directions: await post(`/api/sites/${site}/directions`),
      };
    }, SITE);
    expect(answers.created.status).toBe(503);
    expect(answers.created.body.code).toBe("generation_not_ready");
    // Not this person's site: refused before generation is even asked (404), never 200.
    expect([404, 503]).toContain(answers.directions.status);
  });
});
