import { expect, type Page, test } from "@playwright/test";

// Question 6: contact, address, opening hours and social links.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
const site = (page: Page) => page.frameLocator('iframe[data-active="true"]');
const card = (page: Page, name: string) => page.getByRole("group", { name, exact: true });

test.beforeEach(async ({ page }) => {
  // A Wednesday, 10:00 in Brasília.
  await page.clock.setFixedTime(new Date("2026-10-21T10:00:00-03:00"));
  await page.addInitScript(() => {
    if (window.localStorage.getItem("brotasites:rascunho:v1")) return;
    window.localStorage.setItem(
      "brotasites:rascunho:v1",
      JSON.stringify({
        draft: {
          business: {
            name: "Padaria do Zé",
            category: "Padaria",
            contact: { address: { city: "Santa Rita do Sapucaí" } },
          },
        },
        completed: ["negocio", "modelo", "cores", "secoes", "conteudo"],
      }),
    );
  });
  await page.goto("/criar/contato");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Como os clientes chegam até você?",
  );
});

async function showPreview(page: Page) {
  if (isMobile(page)) await page.getByRole("button", { name: "Ver prévia" }).click();
}

test("question 6 tidies the contact details and shows them on the site", async ({ page }) => {
  const contact = card(page, "Contato");
  await contact.getByLabel("WhatsApp").fill("35999990000");
  await expect(contact.getByLabel("WhatsApp")).toHaveValue("(35) 99999-0000");
  await contact.getByLabel("E-mail (opcional)").fill("ze@padariadoze.com.br");

  const address = card(page, "Endereço");
  await expect(address.getByLabel("Cidade")).toHaveValue("Santa Rita do Sapucaí");
  await address.getByLabel("Rua e número").fill("Rua Direita, 120");
  await address.getByLabel("Estado").selectOption("MG");
  await address.getByLabel("CEP").fill("37540000");
  await expect(address.getByLabel("CEP")).toHaveValue("37540-000");

  await card(page, "Redes sociais").getByLabel("Instagram").fill("instagram.com/padariadoze");

  await showPreview(page);
  const contactSection = site(page).locator("#contato");
  await expect(contactSection).toContainText("(35) 99999-0000", { timeout: 15_000 });
  await expect(contactSection).toContainText("Rua Direita, 120");
  await expect(contactSection).toContainText("CEP 37540-000");
  await expect(
    contactSection.getByRole("link", { name: "@padariadoze", exact: true }),
  ).toHaveAttribute("href", "https://www.instagram.com/padariadoze");
});

test("a WhatsApp number that is too short is pointed out", async ({ page }) => {
  const whatsapp = card(page, "Contato").getByLabel("WhatsApp");
  await whatsapp.fill("3599");
  await expect(page.getByText("Confira o número com DDD")).toBeHidden();
  await whatsapp.blur();
  await expect(page.getByText("Confira o número com DDD, como (35) 99999-0000.")).toBeVisible();
  await expect(whatsapp).toHaveAttribute("aria-invalid", "true");
});

test("opening hours show the sign the site will display", async ({ page }) => {
  const hours = card(page, "Horários");
  await hours.getByLabel("Dias").fill("Seg a Sex");
  await hours.getByLabel("Horário", { exact: true }).fill("06:00 - 19:00");
  const sign = hours.getByRole("status");
  await expect(sign).toContainText("Aberto agora");
  await expect(sign).toContainText("Fecha às 19:00");

  await hours.getByRole("button", { name: "Adicionar horário" }).click();
  await page.keyboard.type("Sábado");
  await hours.getByLabel("Horário", { exact: true }).nth(1).fill("de manhã");
  await expect(hours.getByText(/Use horários como/)).toBeVisible();
  await expect(sign).toContainText("sem a placa de aberto ou fechado");

  await hours.getByLabel("Horário", { exact: true }).nth(1).fill("6h às 14h");
  await expect(hours.getByText(/Use horários como/)).toBeHidden();
  await expect(sign).toContainText("Aberto agora");

  // The hours table on the site lists the rows as typed.
  await showPreview(page);
  await expect(site(page).locator("#contato")).toContainText("6h às 14h", { timeout: 15_000 });
});
