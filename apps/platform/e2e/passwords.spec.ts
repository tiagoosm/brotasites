import { expect, type Page, test } from "@playwright/test";
import {
  BASE,
  createUser,
  lastMail,
  linkOf,
  ownIp,
  PASSWORD,
  signInWithPassword,
  uniqueEmail,
} from "./support/accounts";

// Strong passwords (E26): the five rules with a live checklist and the meter, the repeated
// password, focus on the first error, pasting, Caps Lock, the email typo suggestion, and the
// same rules when resetting and changing. An older, weaker password still signs in.

test.beforeEach(async ({ context }) => {
  await ownIp(context);
});

const password = (page: Page) => page.getByLabel("Senha", { exact: true });
const repeat = (page: Page) => page.getByLabel("Repita a senha");
const rule = (page: Page, text: string) =>
  page.getByRole("list", { name: "A senha precisa ter" }).getByRole("listitem").filter({
    hasText: text,
  });

test("the checklist and the meter follow the typing, in text", async ({ page }) => {
  await page.goto("/cadastro");
  await expect(page.getByText("Força: —", { exact: true })).toBeVisible();
  await password(page).pressSequentially("cafe");
  await expect(rule(page, "Uma letra minúscula")).toContainText("Atendido");
  await expect(rule(page, "Uma letra maiúscula")).toContainText("Falta");
  await expect(page.getByText("Força: Fraca", { exact: true })).toBeVisible();
  await password(page).fill("Cafe-forte9");
  for (const text of ["10 caracteres", "minúscula", "maiúscula", "Um número", "Um símbolo"]) {
    await expect(rule(page, text)).toContainText("Atendido");
  }
  await expect(page.getByText("Força: Boa", { exact: true })).toBeVisible();
  await password(page).fill("Cafe-forte-2026");
  await expect(page.getByText("Força: Forte", { exact: true })).toBeVisible();
});

test("sending with errors lists them at the top and focuses the first field", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Zé");
  await page.getByLabel("E-mail").fill(uniqueEmail("erros"));
  await password(page).fill("cafeforte");
  await repeat(page).fill("cafeforte");
  // The button is never disabled: it shows what to fix.
  const send = page.getByRole("button", { name: "Criar conta" });
  await expect(send).toBeEnabled();
  await send.click();
  const summary = page.getByRole("alert").filter({ hasText: "Confira" });
  await expect(summary).toContainText("Confira 2 campos:");
  await expect(summary.getByRole("link", { name: "Senha" })).toBeVisible();
  await expect(password(page)).toBeFocused();
  await expect(page.getByText(/^Use pelo menos 10 caracteres e inclua/)).toBeVisible();
  await summary.getByRole("link", { name: "Termos" }).click();
  await expect(page.getByRole("checkbox")).toBeFocused();
});

test("the repeated password: pasted, compared once finished, and checked by the server", async ({
  page,
  request,
}) => {
  await page.goto("/cadastro");
  await password(page).fill("Cafe-forte-2026");
  await repeat(page).pressSequentially("Cafe-f");
  // Still typing: nothing said yet.
  await expect(page.getByText("As senhas não são iguais.")).toHaveCount(0);
  await repeat(page).blur();
  await expect(page.getByText("As senhas não são iguais.")).toBeVisible();
  // Pasting is allowed (password managers).
  await repeat(page).fill("");
  await repeat(page).focus();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "Cafe-forte-2026");
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await page.keyboard.insertText("Cafe-forte-2026");
  await expect(repeat(page)).toHaveValue("Cafe-forte-2026");
  await expect(page.getByText("As senhas são iguais.")).toBeVisible();

  const answer = await request.post("/api/auth/sign-up", {
    headers: { origin: BASE, "x-forwarded-for": "198.51.100.26" },
    data: {
      fullName: "Zé",
      email: uniqueEmail("diferente"),
      password: "Cafe-forte-2026",
      confirmPassword: "Cafe-forte-2025",
      acceptTerms: true,
    },
  });
  expect(answer.status()).toBe(400);
  expect((await answer.json()).fields).toEqual({ confirmPassword: "As senhas não são iguais." });
});

test("Caps Lock is pointed out, never blocked", async ({ page }) => {
  await page.goto("/cadastro");
  // Headless browsers do not toggle Caps Lock: the key events carry it, as a real one would.
  const key = (capsLock: boolean, key: string) =>
    password(page).evaluate(
      (input, { capsLock, key }) => {
        for (const type of ["keydown", "keyup"]) {
          input.dispatchEvent(
            new KeyboardEvent(type, { key, modifierCapsLock: capsLock, bubbles: true }),
          );
        }
      },
      { capsLock, key },
    );
  await password(page).focus();
  await key(true, "A");
  await expect(page.getByText("Caps Lock está ligado.")).toBeVisible();
  await password(page).fill("Cafe-forte-2026");
  await expect(password(page)).toHaveValue("Cafe-forte-2026");
  await key(false, "b");
  await expect(page.getByText("Caps Lock está ligado.")).toHaveCount(0);
});

test("a typo in a common email provider gets a suggestion to accept", async ({ page }) => {
  await page.goto("/cadastro");
  const email = page.getByLabel("E-mail");
  await expect(email).toHaveAttribute("autocapitalize", "none");
  await expect(email).toHaveAttribute("spellcheck", "false");
  await expect(page.getByLabel("Seu nome")).toHaveAttribute("autocomplete", "name");
  await expect(password(page)).toHaveAttribute("autocomplete", "new-password");
  await expect(repeat(page)).toHaveAttribute("autocomplete", "new-password");
  await email.fill("ze.padaria@gmial.com");
  await email.blur();
  const accept = page.getByRole("button", { name: "ze.padaria@gmail.com" });
  await expect(accept).toBeVisible();
  await accept.click();
  await expect(email).toHaveValue("ze.padaria@gmail.com");
  await expect(accept).toHaveCount(0);
  // Name and email are checked on leaving the field, not on every key.
  await email.fill("ze@");
  await expect(page.getByText("Escreva um e-mail válido, como voce@exemplo.com.")).toHaveCount(0);
  await email.blur();
  await expect(page.getByText("Escreva um e-mail válido, como voce@exemplo.com.")).toBeVisible();
});

test("resetting the password follows the same rules", async ({ page, request }) => {
  const email = uniqueEmail("regras-redefinir");
  await createUser(request, { email });
  await page.goto("/esqueci-senha");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await page.goto(linkOf(await lastMail(request, email, "recovery")));
  await page.getByLabel("Nova senha", { exact: true }).fill("cafecomleite99");
  await page.getByLabel("Repita a nova senha").fill("cafecomleite99");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(
    page.getByText("Inclua uma letra maiúscula e um símbolo, como ! @ # ?."),
  ).toBeVisible();
  await expect(page.getByLabel("Nova senha", { exact: true })).toBeFocused();
  await page.getByLabel("Nova senha", { exact: true }).fill("Cafe-com-leite-99");
  await page.getByLabel("Repita a nova senha").fill("Cafe-com-leite-99");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page).not.toHaveURL(/redefinir-senha/);
});

test("changing the password in the account follows the same rules", async ({ page, request }) => {
  const email = uniqueEmail("regras-trocar");
  await createUser(request, { email });
  await signInWithPassword(page, email, PASSWORD, "/conta");
  await expect(page).toHaveURL(/\/conta$/);
  await page.getByLabel("Senha atual").fill(PASSWORD);
  await page.getByLabel("Nova senha", { exact: true }).fill("Padaria-do-Ze-1");
  await page.getByLabel("Repita a nova senha").fill("Padaria-do-Ze-1");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  // The account's name is "Zé da Padaria".
  await expect(page.getByText("Não use o seu nome na senha.")).toBeVisible();
  await page.getByLabel("Nova senha", { exact: true }).fill("Bolo-de-fuba-2026");
  await page.getByLabel("Repita a nova senha").fill("Bolo-de-fuba-2025");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("As senhas não são iguais.")).toBeVisible();
  await page.getByLabel("Repita a nova senha").fill("Bolo-de-fuba-2026");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("Senha trocada.", { exact: false })).toBeVisible();
});

test("an older, weaker password still signs in", async ({ page, request }) => {
  const email = uniqueEmail("senha-antiga");
  await createUser(request, { email, password: "senhaantiga1" });
  await signInWithPassword(page, email, "senhaantiga1", "/conta");
  await expect(page).toHaveURL(/\/conta$/);
});
