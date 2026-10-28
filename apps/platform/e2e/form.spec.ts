import { expect, type Page, test } from "@playwright/test";
import { fakeSupabase, padaria, SITE, signIn, withSite } from "./support/supabase";

// The 7-step form (docs/form-flow.md): signing in comes first, each step checks its own
// answers in Portuguese and saves them to the account.

const step = (slug: string) => new RegExp(`/criar/${SITE}/${slug}$`);

async function chooseCategory(page: Page, search: string, label: string) {
  await page.getByLabel("Tipo de negócio").fill(search);
  await page.getByText(label, { exact: true }).click();
  await expect(page.getByRole("radio", { name: label })).toHaveCount(0);
}

test("creating a site asks to sign in first", async ({ page }) => {
  await page.goto("/criar");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fcriar$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entre para criar o seu site");
});

test("signed in, a new site starts at the first question", async ({ page, context }) => {
  const user = await signIn(context);
  const state = await fakeSupabase(context, user);
  await page.goto("/criar");
  await expect(page).toHaveURL(step("negocio"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qual é o seu negócio?");
  expect(state.site?.id).toBe(SITE);
});

test("an unfinished draft opens where the person stopped", async ({ page, context }) => {
  await withSite(context, { draft: padaria, completed: ["negocio", "marca"] });
  await page.goto("/criar");
  await expect(page).toHaveURL(step("secoes"));
});

test("explains what is missing, in Portuguese, then saves and moves on", async ({
  page,
  context,
}) => {
  const state = await withSite(context);
  await page.goto(`/criar/${SITE}/negocio`);
  const next = page.getByRole("button", { name: "Próximo: marca e sensação" });
  await next.click();
  await expect(page.locator("#step-problem")).toHaveText("Informe o nome do negócio.");
  await expect(page).toHaveURL(step("negocio"));

  await page.getByLabel("Nome do negócio").fill("Padaria do Zé");
  await chooseCategory(page, "padar", "Padaria");
  await page.getByLabel("Cidade", { exact: true }).fill("Santa Rita do Sapucaí");
  await page.getByLabel("Estado").selectOption("MG");
  await page
    .getByLabel("Conte em poucas palavras o que você faz")
    .fill("Pão de fermentação natural");
  await next.click();
  await expect(page).toHaveURL(step("marca"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Como você quer que o seu negócio pareça?",
  );
  await expect
    .poll(() => state.saved.at(-1))
    .toMatchObject({
      draft: { business: { name: "Padaria do Zé", category: "padaria", state: "MG" } },
      completed: ["negocio"],
    });
});

test("the answers survive a reload", async ({ page, context }) => {
  const state = await withSite(context);
  await page.goto(`/criar/${SITE}/negocio`);
  await page.getByLabel("Nome do negócio").fill("Barbearia do Léo");
  await expect.poll(() => state.saved.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByLabel("Nome do negócio")).toHaveValue("Barbearia do Léo");
});

test("blocked topics stop the first step, kindly", async ({ page, context }) => {
  await withSite(context);
  await page.goto(`/criar/${SITE}/negocio`);
  await page.getByLabel("Nome do negócio").fill("Loja do Beto");
  await page
    .getByLabel("Conte em poucas palavras o que você faz")
    .fill("Vendemos vapes e pods descartáveis");
  await expect(page.getByText("Esse tipo de negócio a gente não atende.")).toBeVisible();
  await page.getByRole("button", { name: "Próximo: marca e sensação" }).click();
  await expect(page.locator("#step-problem")).toHaveText(
    "Não atendemos negócios de cigarro eletrônico e tabaco.",
  );
});

test("steps ahead of the person's progress send them back", async ({ page, context }) => {
  await withSite(context, { completed: ["negocio"] });
  await page.goto(`/criar/${SITE}/contato`);
  await expect(page).toHaveURL(step("marca"));
});

test("a site of another account is not found", async ({ page, context }) => {
  await withSite(context);
  await page.goto("/criar/00000000-0000-4000-8000-000000000000/negocio");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Site não encontrado");
});

test("old addresses of the form lead to the new one", async ({ page }) => {
  await page.goto("/criar/negocio");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fcriar$/);
});
