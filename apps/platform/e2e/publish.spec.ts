import { expect, type Page, test } from "@playwright/test";
import { fakeSupabase, SITE, signIn } from "./support/supabase";

// Question 7 (address, review, publish) and the status screen, against the fake Supabase.

const answered = {
  business: {
    name: "Padaria do Zé",
    category: "Padaria",
    contact: { whatsapp: "5535999990000", address: { city: "Santa Rita do Sapucaí" } },
  },
  sections: [
    { id: "hero", enabled: true },
    { id: "sobre", enabled: true, content: { text: "Desde 1998 na mesma esquina." } },
    { id: "servicos", enabled: true, content: { items: [{ name: "Pão francês" }] } },
    { id: "galeria", enabled: false },
    { id: "depoimentos", enabled: false },
    { id: "faq", enabled: false },
    { id: "cta-final", enabled: true },
    { id: "contato", enabled: true },
  ],
};

async function seed(page: Page, draft: object = answered) {
  await page.addInitScript((value) => {
    if (window.localStorage.getItem("brotasites:rascunho:v1")) return;
    window.localStorage.setItem(
      "brotasites:rascunho:v1",
      JSON.stringify({
        draft: value,
        completed: ["negocio", "modelo", "cores", "secoes", "conteudo", "contato"],
        updatedAt: Date.now(),
      }),
    );
  }, draft);
}

const address = (page: Page) => page.getByLabel("Endereço", { exact: true });

test("suggests the address and asks to sign in to publish", async ({ page, context }) => {
  await fakeSupabase(context, {});
  await seed(page);
  await page.goto("/criar/endereco");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Onde o seu site vai morar?");
  await expect(address(page)).toHaveValue("padaria-do-ze");
  await expect(page.getByText("Disponível. Esse será o endereço do seu site.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar para publicar" })).toHaveAttribute(
    "href",
    "/entrar?voltar=%2Fcriar%2Fendereco",
  );
});

test("a taken address offers another one", async ({ page, context }) => {
  await fakeSupabase(context, {}, { taken: ["padaria-do-ze"] });
  await seed(page);
  await page.goto("/criar/endereco");
  await expect(page.getByText("Esse endereço já está em uso.")).toBeVisible();
  await page.getByRole("button", { name: "Usar padaria-do-ze-santa-rita-do-sapucai" }).click();
  await expect(address(page)).toHaveValue("padaria-do-ze-santa-rita-do-sapucai");
  await expect(page.getByText("Disponível. Esse será o endereço do seu site.")).toBeVisible();
});

test("addresses are tidied as typed and reserved ones refused", async ({ page, context }) => {
  await fakeSupabase(context, {});
  await seed(page);
  await page.goto("/criar/endereco");
  await address(page).fill("Zé Doces");
  await expect(address(page)).toHaveValue("ze-doces");
  await address(page).fill("Painel");
  await expect(page.getByText("Esse endereço é reservado. Escolha outro.")).toBeVisible();
});

test("the review lists what is missing, with a way to fix it", async ({ page, context }) => {
  await fakeSupabase(context, await signIn(context));
  const sections = answered.sections.map((s) =>
    s.id === "sobre" ? { id: "sobre", enabled: true } : s,
  );
  await seed(page, { ...answered, sections });
  await page.goto("/criar/endereco");
  await expect(page.getByText("Falta 1 coisa para publicar")).toBeVisible();
  await expect(page.getByText(/Falta o texto da seção Sobre/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Corrigir em conteúdo" })).toHaveAttribute(
    "href",
    "/criar/conteudo",
  );
  await expect(page.getByRole("button", { name: "Publicar meu site" })).toBeDisabled();
});

test("publishing reserves the address and shows the site growing", async ({ page, context }) => {
  const state = await fakeSupabase(context, await signIn(context));
  await seed(page);
  await page.goto("/criar/endereco");
  await expect(page.getByText("Disponível. Esse será o endereço do seu site.")).toBeVisible();
  await page.getByRole("button", { name: "Publicar meu site" }).click();

  await expect(page).toHaveURL(/\/meu-site$/);
  expect(state.published).toEqual([{ p_site_id: SITE, p_subdomain: "padaria-do-ze" }]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O seu site está brotando");
  const steps = page.getByRole("list", { name: "Etapas da publicação" });
  await expect(steps.locator('[aria-current="step"]')).toContainText("Montando o seu site");

  // The screen follows the build on its own.
  if (state.site) state.site.status = "live";
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O seu site está no ar", {
    timeout: 10_000,
  });
  await expect(page.getByRole("link", { name: "Abrir o meu site" })).toHaveAttribute(
    "href",
    "https://padaria-do-ze.brotasites.com",
  );
});

test("an address taken at the last second is explained", async ({ page, context }) => {
  await fakeSupabase(context, await signIn(context), { publishError: "subdomain_taken" });
  await seed(page);
  await page.goto("/criar/endereco");
  await expect(page.getByText("Disponível. Esse será o endereço do seu site.")).toBeVisible();
  await page.getByRole("button", { name: "Publicar meu site" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "endereço" })).toHaveText(
    "Alguém acabou de escolher esse endereço. Escolha outro.",
  );
  await expect(page).toHaveURL(/\/criar\/endereco$/);
});

test("the status screen asks to sign in and handles failures", async ({ page, context }) => {
  await fakeSupabase(context, {});
  await page.goto("/meu-site");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entre para ver o seu site");

  await fakeSupabase(context, await signIn(context), {
    site: { id: SITE, subdomain: "padaria-do-ze", status: "failed" },
  });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Não conseguimos gerar o seu site",
  );
  await expect(page.getByRole("link", { name: "Revisar e tentar de novo" })).toBeVisible();
});
