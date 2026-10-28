import { expect, test } from "@playwright/test";

// The price section and every answer that mentions price read from src/config/pricing.ts.

test("the home page shows the one-time price and what it includes", async ({ page }) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: "Quanto custa" });
  await expect(section).toContainText("Criar, editar, ver as direções e o site pronto é grátis.");
  await expect(section).toContainText(/R\$\s297/);
  await expect(section).toContainText("pagamento único");
  await expect(section).toContainText("12 meses de hospedagem");
  await expect(section).toContainText("Ajustes pelo painel nos primeiros 30 dias");
  await expect(section).toContainText(/R\$\s99 por ano/);
  await expect(section).toContainText(/\+ R\$\s97 para conectar/);
  // The guarantee stays marked until it is reviewed by a lawyer.
  await expect(section).toContainText("Texto pendente de revisão jurídica");
  await expect(section).not.toContainText("freelancer");
});

test("help answers about price, changes and leaving agree with the price section", async ({
  page,
}) => {
  await page.goto("/ajuda#quanto-custa");
  await expect(page.getByRole("region", { name: "Quanto custa?" })).toContainText(/R\$\s297/);
  for (const question of ["Posso mudar o site depois de publicar?", "E se eu não quiser mais?"]) {
    await page.getByRole("button", { name: question }).click();
  }
  await expect(
    page.getByRole("region", { name: "Posso mudar o site depois de publicar?" }),
  ).toContainText("30 dias");
  await expect(page.getByRole("region", { name: "E se eu não quiser mais?" })).toContainText(
    "pendente de revisão jurídica",
  );
  await page.goto("/termos#preco");
  await expect(page.getByRole("region", { name: "Preço, renovação e reembolso" })).toContainText(
    "pendente de revisão jurídica",
  );
});
