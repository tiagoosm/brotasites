import { formSteps12 as formSteps } from "@brotasites/schema/v1.2";
import { expect, test } from "@playwright/test";
import { allBefore, padaria, SITE, siteRow, withSite } from "./support/supabase";

// "5 passos e seu site pronto" (E25): the form has 5 steps and says so at every screen size;
// drafts saved by the former 7-step form still open; no "etapa", "sete" or "sete perguntas" is
// left in what the client reads on the public pages and in the form.

const at = (slug: string) => `/criar/${SITE}/${slug}`;

test("the form has exactly 5 steps and shows Passo N de 5", async ({ page, context }) => {
  test.setTimeout(90_000);
  expect(formSteps.map((step) => step.slug)).toEqual([
    "negocio",
    "marca",
    "secoes",
    "conteudo",
    "contato",
  ]);
  await withSite(context, { draft: padaria, completed: allBefore("contato") });
  for (const [index, step] of formSteps.entries()) {
    await page.goto(at(step.slug));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(step.question);
    // The rail on wide screens, the bar under the header below 1280px: one of them is visible.
    await expect(
      page
        .getByText(new RegExp(`Passo\\s*${index + 1}\\s*de\\s*5`))
        .locator("visible=true")
        .first(),
    ).toBeVisible();
    await expect(page).toHaveTitle(`Passo ${index + 1} de 5: ${step.title} · BrotaSites`);
  }
  await expect(page.getByText(/de 7\b/)).toHaveCount(0);
});

test("a draft saved by the former 7-step form opens without errors", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await withSite(context, {
    site: siteRow("draft"),
    draft: padaria,
    completed: ["negocio", "marca", "secoes", "conteudo", "contato", "direcao", "endereco"],
  });
  await page.goto(at("contato"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(formSteps[4]?.question ?? "");
  // The answers are all there, ready to send.
  await expect(page.getByLabel("WhatsApp")).toHaveValue("(35) 99999-0000");
  await expect(page.getByRole("button", { name: "Enviar e ver as direções" })).toBeEnabled();
  expect(errors).toEqual([]);
});

/**
 * Words the client must no longer read. Exceptions, each for a reason:
 * - "verificação em duas etapas": the usual name of two-factor sign-in (Jakob), not the form;
 * - "Perguntas frequentes" and "pergunta" inside the FAQ section of a generated site: a section
 *   of the client's site, not a step of the form.
 */
const banned = [
  /\bsete\b/i,
  /\betapas?\b/i,
  /\bas \d perguntas\b/i,
  /\b\d+ perguntas\b/i,
  /\bpasso \d de 7\b/i,
];
const allowed = [/verificação em duas etapas/gi, /perguntas frequentes/gi];

function leftovers(text: string): string[] {
  let clean = text;
  for (const pattern of allowed) clean = clean.replace(pattern, "");
  return banned.flatMap((pattern) => clean.match(pattern) ?? []);
}

for (const path of ["/", "/ajuda", "/termos", "/privacidade", "/entrar", "/cadastro"]) {
  test(`no old step words on ${path}`, async ({ page }) => {
    await page.goto(path);
    const text = await page.locator("body").innerText();
    const meta = await page.evaluate(() =>
      [document.title, document.querySelector("meta[name=description]")?.getAttribute("content")]
        .filter(Boolean)
        .join(" "),
    );
    expect(leftovers(`${text} ${meta}`)).toEqual([]);
  });
}

test("no old step words in the form", async ({ page, context }) => {
  test.setTimeout(90_000);
  await withSite(context, { draft: padaria, completed: allBefore("contato") });
  for (const step of formSteps) {
    await page.goto(at(step.slug));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(step.question);
    expect(leftovers(await page.locator("body").innerText()), step.slug).toEqual([]);
  }
});
