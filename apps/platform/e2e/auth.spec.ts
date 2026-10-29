import { expect, test } from "@playwright/test";
import {
  BASE,
  createUser,
  lastMail,
  linkOf,
  mails,
  ownIp,
  PASSWORD,
  signInWithPassword,
  uniqueEmail,
} from "./support/accounts";

// Accounts (E15): sign-up with email confirmation, sign-in by password or by link, the same
// answers for any email, resending and resetting, all against the fake Supabase.

test.beforeEach(async ({ context }) => {
  await ownIp(context);
});

test("signing up, confirming the email and landing on the form", async ({ page, request }) => {
  const email = uniqueEmail("cadastro");
  await page.goto("/cadastro?voltar=%2Fconta");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Crie a sua conta");

  // The rules show next to each field.
  await page.getByLabel("Seu nome").fill("Zé da Padaria");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("1234567890");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Essa senha é muito comum. Escolha outra.").last()).toBeVisible();
  await expect(
    page.getByText("Para criar a conta, aceite os Termos e a Política de Privacidade."),
  ).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await expect(page.getByText("Forte", { exact: true })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confira o seu e-mail");

  // Not confirmed yet: no sign-in with the password.
  const mail = await lastMail(request, email, "signup");
  await signInWithPassword(page, email);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Confirme o seu e-mail antes de entrar",
  );
  await expect(page.getByRole("button", { name: /Reenviar e-mail de confirmação/ })).toBeDisabled();

  // The link confirms and signs in, back to where the person was going.
  await page.goto(linkOf(mail));
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Perfil e segurança");
  await expect(page.getByLabel("Seu nome")).toHaveValue("Zé da Padaria");
  // The link works once.
  await page.context().clearCookies();
  await page.goto(linkOf(mail));
  await expect(page).toHaveURL(/\/entrar\?erro=link/);
});

test("the same answer for an email with and without an account", async ({ page, request }) => {
  const taken = uniqueEmail("existe");
  await createUser(request, { email: taken });
  const signUp = async (email: string) => {
    const started = Date.now();
    const response = await request.post("/api/auth/sign-up", {
      headers: { origin: BASE, "x-forwarded-for": `203.0.113.${email.length}` },
      data: { fullName: "Zé", email, password: PASSWORD, acceptTerms: true },
    });
    return { status: response.status(), body: await response.json(), ms: Date.now() - started };
  };
  const existing = await signUp(taken);
  const fresh = await signUp(uniqueEmail("novo"));
  expect(existing.status).toBe(200);
  expect(existing.body).toEqual(fresh.body);
  expect(existing.ms).toBeGreaterThanOrEqual(750);
  expect(fresh.ms).toBeGreaterThanOrEqual(750);
  // Nothing is sent to the existing account.
  expect(await mails(request, taken)).toEqual([]);

  // Sign-in: one message for a wrong password and for an unknown email.
  await signInWithPassword(page, taken, "senha-errada-123");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
  await signInWithPassword(page, uniqueEmail("ninguem"), "senha-errada-123");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("E-mail ou senha incorretos.");

  // Link and "forgot password": same screen for both.
  for (const email of [taken, uniqueEmail("ninguem")]) {
    await page.goto("/esqueci-senha");
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confira o seu e-mail");
  }
  expect((await mails(request, taken)).map((mail) => mail.type)).toEqual(["recovery"]);
});

test("signing in with the password and with a link", async ({ page, request }) => {
  const email = uniqueEmail("entrar");
  await createUser(request, { email });
  await signInWithPassword(page, email, PASSWORD, "/conta");
  await expect(page).toHaveURL(/\/conta$/);

  await page.context().clearCookies();
  await page.goto("/entrar?voltar=%2Fconta");
  await page.getByRole("button", { name: "Entrar com um link no e-mail" }).click();
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confira o seu e-mail");
  await page.goto(linkOf(await lastMail(request, email, "magiclink")));
  await expect(page).toHaveURL(/\/conta$/);
});

test("without a page to go back to, signing in and confirming lead to the dashboard", async ({
  page,
  request,
}) => {
  // The password.
  const email = uniqueEmail("painel");
  await createUser(request, { email });
  await signInWithPassword(page, email);
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole("heading", { level: 2, name: "Seus sites" })).toBeVisible();
  // Signed in, the sign-in and sign-up pages lead to the dashboard, on the server.
  await page.goto("/entrar");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/cadastro");
  await expect(page).toHaveURL(/\/painel$/);
  // The public pages show the account's menu, already in the server's HTML (no flicker).
  const home = await page.context().request.get("/");
  const html = await home.text();
  expect(html).toContain(">Painel<");
  expect(html).toContain(">Perfil e segurança<");
  expect(html).not.toContain(">Entrar<");
  // Two pages under one address: never stored once for everyone by a shared cache.
  expect(home.headers()["cache-control"]).toBe("private, no-cache");

  // Confirming a new account's email.
  await page.context().clearCookies();
  const fresh = uniqueEmail("painel-novo");
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Zé");
  await page.getByLabel("E-mail").fill(fresh);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confira o seu e-mail");
  await page.goto(linkOf(await lastMail(request, fresh, "signup")));
  await expect(page).toHaveURL(/\/painel$/);

  // Signed out, the public pages offer to sign in, and the internal addresses do not exist.
  await page.context().clearCookies();
  const visitor = await (await page.context().request.get("/")).text();
  expect(visitor).toContain(">Entrar<");
  expect(visitor).not.toContain(">Painel<");
  expect((await page.context().request.get("/logado")).status()).toBe(404);
  expect((await page.context().request.get("/visitante/ajuda")).status()).toBe(404);
});

test("a page asked for still comes first: voltar=/criar opens the form", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("voltar");
  await createUser(request, { email });
  await signInWithPassword(page, email, PASSWORD, "/criar");
  await expect(page).toHaveURL(/\/criar(\/|$)/);
});

test("resending the confirmation waits a minute between emails", async ({ page, request }) => {
  await page.clock.install();
  const email = uniqueEmail("reenvio");
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Zé");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  const resend = page.getByRole("button", { name: /Reenviar e-mail de confirmação/ });
  await expect(resend).toBeDisabled();
  await expect(resend).toContainText("(60 s)");
  await page.clock.runFor(61_000);
  await expect(resend).toBeEnabled();
  await resend.click();
  await expect(
    page.getByText("Se houver uma conta esperando confirmação, enviamos um novo link."),
  ).toBeVisible();
  await expect(resend).toBeDisabled();
  await expect
    .poll(async () => (await mails(request, email)).filter((m) => m.type === "signup").length)
    .toBe(2);
});

test("too many sign-ups for one email are refused", async ({ request }) => {
  const email = uniqueEmail("limite");
  const statuses: number[] = [];
  for (let i = 0; i < 4; i++) {
    const response = await request.post("/api/auth/sign-up", {
      headers: { origin: BASE, "x-forwarded-for": `192.0.2.${i}` },
      data: { fullName: "Zé", email, password: PASSWORD, acceptTerms: true },
    });
    statuses.push(response.status());
  }
  // Three per email per hour.
  expect(statuses).toEqual([200, 200, 200, 429]);
});

test("forgot and reset the password", async ({ page, request }) => {
  const email = uniqueEmail("redefinir");
  await createUser(request, { email });
  await page.goto("/esqueci-senha");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await page.goto(linkOf(await lastMail(request, email, "recovery")));
  await expect(page).toHaveURL(/\/redefinir-senha$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Crie uma nova senha");
  await page.getByLabel("Nova senha", { exact: true }).fill("Cafe-com-leite-99");
  await page.getByLabel("Repita a nova senha").fill("Cafe-com-leite-98");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("As duas senhas não são iguais.")).toBeVisible();
  await page.getByLabel("Repita a nova senha").fill("Cafe-com-leite-99");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page).toHaveURL(/\/painel\?senha=alterada$/);

  await page.context().clearCookies();
  await signInWithPassword(page, email, "Cafe-com-leite-99", "/conta");
  await expect(page).toHaveURL(/\/conta$/);

  // Without the link's session the page says the link expired.
  await page.context().clearCookies();
  await page.goto("/redefinir-senha");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Link expirado");
});

test("an expired or broken link sends the person back with an explanation", async ({ page }) => {
  await page.goto("/auth/confirm?next=%2Fcriar%2Fmodelo");
  await expect(page).toHaveURL(/\/entrar\?erro=link&voltar=%2Fcriar%2Fmodelo$/);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Esse link expirou ou já foi usado. Entre de novo abaixo.",
  );
});
