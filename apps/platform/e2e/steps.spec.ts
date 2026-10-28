import { expect, test } from "@playwright/test";
import { allBefore, padaria, SITE, USER, withSite } from "./support/supabase";

// Steps 2 to 5: brand, sections, content with photos and consent, contact with hours.

const at = (slug: string) => `/criar/${SITE}/${slug}`;

test("brand: up to 2 feelings and 3 colors", async ({ page, context }) => {
  const state = await withSite(context, { draft: padaria, completed: allBefore("marca") });
  await page.goto(at("marca"));
  await page.getByText(/^Acolhedor:/).click();
  await page.getByText(/^Moderno:/).click();
  await expect(page.getByRole("checkbox", { name: /^Ousado:/ })).toBeDisabled();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Adicionar cor" }).click();
  await expect(page.getByRole("button", { name: "Adicionar cor" })).toHaveCount(0);
  await page.getByRole("button", { name: "Próximo: seções" }).click();
  await expect(page).toHaveURL(new RegExp(at("secoes")));
  await expect
    .poll(() => state.draft)
    .toMatchObject({ brand: { feelings: ["acolhedor", "moderno"] } });
});

test("sections: the family's come on by default", async ({ page, context }) => {
  const state = await withSite(context, { draft: padaria, completed: allBefore("secoes") });
  await page.goto(at("secoes"));
  await expect(page.getByRole("switch", { name: "Serviços ou produtos" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Galeria de fotos" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Depoimentos" })).not.toBeChecked();
  await page.getByRole("switch", { name: "Depoimentos" }).click();
  await page.getByRole("button", { name: "Próximo: conteúdo" }).click();
  await expect(page).toHaveURL(new RegExp(at("conteudo")));
  await expect.poll(() => state.draft.sections).toContain("depoimentos");
});

test("sections: psychology sites never show testimonials", async ({ page, context }) => {
  await withSite(context, {
    draft: { ...padaria, business: { ...padaria.business, category: "psicologia" } },
    completed: allBefore("secoes"),
  });
  await page.goto(at("secoes"));
  await expect(page.getByRole("switch", { name: "Depoimentos" })).toBeDisabled();
  await expect(page.getByText(/não mostram depoimentos/)).toBeVisible();
});

test("content: testimonials need authorization, photos need consent", async ({ page, context }) => {
  const state = await withSite(context, {
    draft: { ...padaria, sections: ["servicos", "depoimentos", "galeria", "contato"] },
    completed: allBefore("conteudo"),
  });
  await page.goto(at("conteudo"));
  const next = page.getByRole("button", { name: "Próximo: contato" });

  await page.getByLabel("Nome do cliente").fill("Maria");
  await page.getByLabel("Depoimento", { exact: true }).fill("O melhor pão da cidade.");
  await next.click();
  await expect(page.locator("#step-problem")).toHaveText(
    "Confirme que a pessoa autorizou o uso do depoimento.",
  );
  await page.getByText("Essa pessoa autorizou o uso do depoimento").click();

  await page.getByLabel("Enviar fotos").setInputFiles({
    name: "balcao.jpg",
    mimeType: "image/jpeg",
    buffer: (await import("./support/supabase")).photoBytes,
  });
  await expect(page.getByRole("button", { name: "Remover a foto 1" })).toBeVisible();
  expect(state.uploads[0]).toMatch(new RegExp(`^${USER.id}/${SITE}/[0-9a-f-]+\\.webp$`));
  await page.getByLabel("O que aparece na foto").fill("Balcão com pães");
  await page.getByText("Aparecem pessoas nesta foto").click();
  await next.click();
  await expect(page.locator("#step-problem")).toHaveText(
    "Confirme que as pessoas da foto autorizaram o uso.",
  );
  await page.getByText("As pessoas da foto autorizaram o uso da imagem.").click();
  await next.click();
  await expect(page).toHaveURL(new RegExp(at("contato")));
});

test("contact: one channel at least, a place, and structured hours", async ({ page, context }) => {
  const state = await withSite(context, {
    draft: { business: padaria.business, content: padaria.content },
    completed: allBefore("contato"),
  });
  await page.goto(at("contato"));
  const next = page.getByRole("button", { name: "Próximo: direção" });
  await next.click();
  await expect(page.locator("#step-problem")).toHaveText(
    "Informe pelo menos um contato: WhatsApp, telefone ou e-mail.",
  );

  await page.getByLabel("WhatsApp").fill("35999990000");
  await expect(page.getByLabel("WhatsApp")).toHaveValue("(35) 99999-0000");
  await page.getByText("Não tenho endereço fixo").click();
  await next.click();
  await expect(page.locator("#step-problem")).toHaveText(
    "Informe os bairros ou cidades que você atende.",
  );
  await page.getByLabel("Bairros ou cidades que você atende").fill("Centro, Jardim América");

  // Hours: the usual week in one tap, then a lunch break.
  await page.getByRole("button", { name: "Seg a Sáb" }).click();
  await expect(page.getByRole("checkbox", { name: "sábado" })).toBeChecked();
  await expect(page.getByText("Fechado: domingo.")).toBeVisible();
  await page.getByRole("button", { name: /Adicionar outro horário no mesmo dia/ }).click();
  await expect(page.getByLabel("Abre de novo")).toHaveValue("14:00");
  await page.getByLabel("Fecha").first().fill("12:00");

  await next.click();
  await expect(page).toHaveURL(new RegExp(at("direcao")));
  await expect
    .poll(() => state.draft.contact)
    .toMatchObject({
      whatsapp: "5535999990000",
      hasFixedAddress: false,
      serviceArea: ["Centro", "Jardim América"],
      openingHours: {
        mode: "schedule",
        rules: [
          {
            days: ["mon", "tue", "wed", "thu", "fri", "sat"],
            intervals: [
              { open: "08:00", close: "12:00" },
              { open: "14:00", close: "18:00" },
            ],
          },
        ],
      },
    });
});

test("contact: by appointment and 24 hours need no schedule", async ({ page, context }) => {
  const state = await withSite(context, {
    draft: { business: padaria.business, content: padaria.content },
    completed: allBefore("contato"),
  });
  await page.goto(at("contato"));
  await page.getByLabel("E-mail (opcional)").fill("ze@padariadoze.com.br");
  await page.getByLabel("Rua").fill("Rua das Flores");
  await page.getByText("Sob agendamento").click();
  await expect(page.getByLabel("Abre")).toHaveCount(0);
  await page.getByText("24 horas").click();
  await page.getByRole("button", { name: "Próximo: direção" }).click();
  await expect(page).toHaveURL(new RegExp(at("direcao")));
  await expect
    .poll(() => state.draft.contact)
    .toMatchObject({ openingHours: { mode: "always", rules: [] } });
});
