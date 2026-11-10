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

// Passwords (E26, owner's change in E27): 8 characters is the only requirement; lowercase,
// uppercase, a number and a symbol only raise the strength meter. A live checklist and the
// meter, the repeated password, focus on the first error, pasting, Caps Lock, the email typo
// suggestion, and the same rule when resetting and changing. An older password still signs in.

test.beforeEach(async ({ context }) => {
  await ownIp(context);
});

const password = (page: Page) => page.getByLabel("Senha", { exact: true });
const repeat = (page: Page) => page.getByLabel("Repita a senha");
const requirement = (page: Page) =>
  page.getByRole("list", { name: "A senha precisa ter" }).getByRole("listitem");

test("the minimum always, the strength only while typing, no optional hints (E30)", async ({
  page,
}) => {
  await page.goto("/cadastro");
  // Empty: no strength, no bar, only the one requirement.
  await expect(page.getByText(/^Força:/)).toHaveCount(0);
  await expect(page.getByText("Mínimo:", { exact: true })).toBeVisible();
  await expect(page.getByText(/Mais forte com|Para ficar mais forte/)).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Deixa a senha mais forte" })).toHaveCount(0);
  await password(page).pressSequentially("cafe");
  await expect(requirement(page)).toHaveCount(1);
  await expect(requirement(page)).toContainText("Ainda não: 8 caracteres");
  await expect(page.getByText("Força: Fraca", { exact: true })).toBeVisible();
  // Eight lowercase letters are enough to sign up: weak, never blocked.
  await password(page).fill("cafezinho");
  await expect(requirement(page)).toContainText("Feito: 8 caracteres");
  // The kinds of character still count for the strength, unseen.
  await password(page).fill("Cafe-forte9");
  await expect(page.getByText("Força: Boa", { exact: true })).toBeVisible();
  await password(page).fill("");
  await expect(page.getByText(/^Força:/)).toHaveCount(0);
  await password(page).fill("Cafe-forte9");
  await password(page).fill("Cafe-forte-2026");
  await expect(page.getByText("Força: Forte", { exact: true })).toBeVisible();
});

test("sending with errors shows each one once, under its field, and focuses the first", async ({
  page,
}) => {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Zé");
  await page.getByLabel("E-mail").fill(uniqueEmail("erros"));
  await password(page).fill("cafe12");
  await repeat(page).fill("cafe12");
  // The button is never disabled: it shows what to fix.
  const send = page.getByRole("button", { name: "Criar conta" });
  await expect(send).toBeEnabled();
  await send.click();
  // E29: no summary at the top repeating the fields' errors.
  await expect(page.getByText(/^Confira \d+ campos?:/)).toHaveCount(0);
  await expect(password(page)).toBeFocused();
  // Each error once, tied to its field and announced.
  const short = page.getByText("Use pelo menos 8 caracteres.");
  await expect(short).toHaveCount(1);
  await expect(short).toHaveAttribute("role", "alert");
  const describedBy = (await password(page).getAttribute("aria-describedby")) ?? "";
  expect(describedBy.split(" ")).toContain(await short.getAttribute("id"));
  const terms = page.getByText("Para criar a conta, aceite os Termos e a Política de Privacidade.");
  await expect(terms).toHaveCount(1);
  await expect(page.getByRole("checkbox")).toHaveAttribute("aria-invalid", "true");
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

test("a password of 8 plain letters is accepted, shown as weak", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Zé");
  await page.getByLabel("E-mail").fill(uniqueEmail("simples"));
  await password(page).fill("cafezinho");
  await repeat(page).fill("cafezinho");
  await expect(page.getByText("Força: Fraca", { exact: true })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confira o seu e-mail");
});

test("resetting the password follows the same rule", async ({ page, request }) => {
  const email = uniqueEmail("regras-redefinir");
  await createUser(request, { email });
  await page.goto("/esqueci-senha");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await page.goto(linkOf(await lastMail(request, email, "recovery")));
  await page.getByLabel("Nova senha", { exact: true }).fill("cafe99");
  await page.getByLabel("Repita a nova senha").fill("cafe99");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("Use pelo menos 8 caracteres.").last()).toBeVisible();
  await expect(page.getByLabel("Nova senha", { exact: true })).toBeFocused();
  await page.getByLabel("Nova senha", { exact: true }).fill("Cafe-com-leite-99");
  await page.getByLabel("Repita a nova senha").fill("Cafe-com-leite-99");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page).not.toHaveURL(/redefinir-senha/);
});

test("changing the password in the account follows the same rule", async ({ page, request }) => {
  const email = uniqueEmail("regras-trocar");
  await createUser(request, { email });
  await signInWithPassword(page, email, PASSWORD, "/conta");
  await expect(page).toHaveURL(/\/conta$/);
  await page.getByLabel("Senha atual").fill(PASSWORD);
  await page.getByLabel("Nova senha", { exact: true }).fill("bolo");
  await page.getByLabel("Repita a nova senha").fill("bolo");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("Use pelo menos 8 caracteres.").last()).toBeVisible();
  // The account's name is "Zé da Padaria": the name only makes the password weak.
  await page.getByLabel("Nova senha", { exact: true }).fill("Padaria-do-Ze-1");
  await expect(page.getByText("Força: Fraca", { exact: true })).toBeVisible();
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
