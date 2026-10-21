import { expect, type Page, test } from "@playwright/test";

// Sign-in by magic link. Supabase points at a fake project in e2e (playwright.config.ts) and
// the email request is intercepted, so no real email is ever sent.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1280;

function answerOtp(page: Page, status: number, body: object) {
  return page.route("**/auth/v1/otp**", (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

test("the form invites to sign in without requiring it", async ({ page }) => {
  await page.goto("/criar/negocio");
  const invite = isMobile(page)
    ? page.getByRole("link", { name: "Entrar", exact: true })
    : page.getByRole("link", { name: /Entrar para salvar na sua conta/ });
  await expect(invite).toBeVisible();
  await expect(invite).toHaveAttribute("href", "/entrar?voltar=%2Fcriar%2Fnegocio");
  await expect(page.getByRole("status").first()).toContainText(/Salvo/i);
});

test("sending the magic link", async ({ page }) => {
  let sent: { email?: string; redirect?: string } = {};
  await page.route("**/auth/v1/otp**", async (route) => {
    const body = route.request().postDataJSON() as { email?: string };
    sent = {
      email: body.email,
      redirect: new URL(route.request().url()).searchParams.get("redirect_to") ?? "",
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/entrar?voltar=%2Fcriar%2Fcores");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entre para guardar o seu site");

  await page.getByLabel("Seu e-mail").fill("ze@padaria");
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Escreva um e-mail válido, como voce@exemplo.com.",
  );

  await page.getByLabel("Seu e-mail").fill("ze@padariadoze.com.br");
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confira o seu e-mail");
  await expect(page.getByText("ze@padariadoze.com.br")).toBeVisible();
  expect(sent.email).toBe("ze@padariadoze.com.br");
  // The link comes back to the confirm route and then to where the person was.
  expect(sent.redirect).toMatch(/\/auth\/confirm\?next=%2Fcriar%2Fcores$/);
});

test("too many requests are explained", async ({ page }) => {
  await answerOtp(page, 429, { code: "over_email_send_rate_limit", msg: "rate limit" });
  await page.goto("/entrar");
  await page.getByLabel("Seu e-mail").fill("ze@padariadoze.com.br");
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Muitos pedidos seguidos. Espere um minuto e tente de novo.",
  );
});

test("an expired or broken link sends the person back with an explanation", async ({ page }) => {
  await page.goto("/auth/confirm?next=%2Fcriar%2Fmodelo");
  await expect(page).toHaveURL(/\/entrar\?erro=link&voltar=%2Fcriar%2Fmodelo$/);
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Esse link expirou ou já foi usado. Peça um novo abaixo.",
  );
});

test("continuing without signing in never leaves the platform", async ({ page }) => {
  await page.goto("/entrar?voltar=https%3A%2F%2Fexemplo.com");
  await expect(page.getByRole("link", { name: "Continuar sem entrar" })).toHaveAttribute(
    "href",
    "/criar/negocio",
  );
  await page.goto("/entrar?voltar=%2Fcriar%2Fcores");
  await expect(page.getByRole("link", { name: "Continuar sem entrar" })).toHaveAttribute(
    "href",
    "/criar/cores",
  );
});
