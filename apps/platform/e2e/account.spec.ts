import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
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
import { fakeSupabase, SITE, SUPABASE, signIn } from "./support/supabase";

// "Perfil e segurança" (/conta, E15): profile, email change, a copy of the data, deleting the account, and the
// confirmed-email rule, with real round trips to the fake Supabase.

test.beforeEach(async ({ context }) => {
  await ownIp(context);
});

test("editing the name and the WhatsApp", async ({ page, request }) => {
  const email = uniqueEmail("perfil");
  await createUser(request, { email });
  await signInWithPassword(page, email, PASSWORD, "/conta");
  await expect(page).toHaveURL(/\/conta$/);
  await page.getByLabel("WhatsApp (opcional)").fill("35 9999");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Escreva o número com DDD, como (35) 99999-0000.")).toBeVisible();
  await page.getByLabel("WhatsApp (opcional)").fill("(35) 99999-0000");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Dados salvos.")).toBeVisible();
  // The server wrote the profile with the person's session (RLS); the fake keeps the update.
  const saved = await (await request.get(`${SUPABASE}/__test/profile?email=${email}`)).json();
  expect(saved).toEqual({ full_name: "Zé da Padaria", phone: "+5535999990000" });
});

test("changing the email needs the new address to confirm", async ({ page, request }) => {
  const email = uniqueEmail("antigo");
  const next = uniqueEmail("novo");
  await createUser(request, { email });
  await signInWithPassword(page, email, PASSWORD, "/conta");
  await page.getByLabel("Novo e-mail").fill(next);
  await page.getByRole("button", { name: "Trocar e-mail" }).click();
  await expect(page.getByText(`Enviamos um link para ${next}.`)).toBeVisible();
  await page.goto(linkOf(await lastMail(request, next, "email_change")));
  await expect(page).toHaveURL(/\/conta\?email=alterado$/);
  await expect(page.getByText("E-mail alterado.")).toBeVisible();
  await expect(page.getByText(`E-mail atual: ${next}`)).toBeVisible();
});

test("a sensitive change asks for a recent sign-in", async ({ page, context }) => {
  // A session cookie made by hand has no recent sign-in (no amr).
  await fakeSupabase(context, await signIn(context));
  // The account API is the real one (fakeSupabase answers every other /api call).
  await page.route("**/api/account/**", (route) => route.continue());
  await page.route(`${SUPABASE}/rest/v1/profiles**`, (route) =>
    route.fulfill({
      json: { full_name: "Zé", phone: null, terms_version: "2026-10-draft", has_password: true },
    }),
  );
  await page.goto("/conta");
  await page.getByLabel(/Para confirmar, escreva o seu e-mail/).fill("ze@padariadoze.com.br");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(
    page.getByRole("main").getByRole("alert").filter({ hasText: "confirme que é você" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar de novo" })).toHaveAttribute(
    "href",
    "/entrar?voltar=%2Fconta%23excluir",
  );
});

test("downloading the data: only the person's, no secrets", async ({ page, request }) => {
  const mine = uniqueEmail("dados-a");
  const theirs = uniqueEmail("dados-b");
  await createUser(request, { email: mine });
  await createUser(request, { email: theirs });
  await signInWithPassword(page, mine, PASSWORD, "/conta");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar meus dados (.json)" }).click();
  const file = await (await download).path();
  const { readFileSync } = await import("node:fs");
  const text = readFileSync(file, "utf8");
  const data = JSON.parse(text) as { account: { email: string }; profile: { full_name: string } };
  expect(data.account.email).toBe(mine);
  expect(data.profile.full_name).toBe("Zé da Padaria");
  expect(text).not.toContain(theirs);
  // "has_password" is the profile's own flag; no password, token or key goes out.
  for (const secret of [PASSWORD, "sb_secret", "preview_token", "refresh_token", "access_token"]) {
    expect(text, secret).not.toContain(secret);
  }
  expect(text).not.toMatch(/"password"\s*:/);
});

test("deleting the account removes the sites and signs out", async ({ page, request }) => {
  const email = uniqueEmail("excluir");
  const user = await createUser(request, { email });
  await signInWithPassword(page, email, PASSWORD, "/conta");
  await page.getByLabel(/Para confirmar, escreva o seu e-mail/).fill("outro@padariadoze.com.br");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(
    page.getByRole("region", { name: "Excluir minha conta" }).getByRole("alert"),
  ).toHaveText("Escreva o e-mail desta conta para confirmar.");

  const before = Date.now();
  await page.getByLabel(/Para confirmar, escreva o seu e-mail/).fill(email);
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(page).toHaveURL(/\/\?conta=excluida$/);

  // The database removed the sites (server_delete_account) and the auth user went last.
  const calls = (
    (await (await request.get(`${SUPABASE}/__test/calls`)).json()) as {
      method: string;
      path: string;
      at: number;
    }[]
  )
    .filter((call) => call.at >= before)
    .map((call) => `${call.method} ${call.path}`);
  expect(calls).toContain("POST /rest/v1/rpc/server_delete_account");
  expect(calls).toContain(`DELETE /auth/v1/admin/users/${user.id}`);
  expect(calls.indexOf("POST /rest/v1/rpc/server_delete_account")).toBeLessThan(
    calls.indexOf(`DELETE /auth/v1/admin/users/${user.id}`),
  );
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fpainel$/);
  await signInWithPassword(page, email);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
});

test("without a confirmed email: the warning, and no payment on the server", async ({
  page,
  context,
  request,
}) => {
  await fakeSupabase(context, await signIn(context, { confirmed: false }));
  await page.goto("/painel");
  await expect(page.getByRole("complementary", { name: "Confirmação do e-mail" })).toContainText(
    "Confirme o seu e-mail.",
  );
  const cookies = await context.cookies();
  const response = await request.post(`/api/sites/${SITE}/approve`, {
    headers: {
      origin: BASE,
      cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
    data: {},
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error).toContain("Confirme o seu e-mail");
});

test("the account pages pass axe", async ({ page, request }) => {
  const email = uniqueEmail("axe");
  await createUser(request, { email });
  // Contrast is checked on the settled page, not halfway through a fade.
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/entrar", "/cadastro", "/esqueci-senha", "/redefinir-senha"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => `${path}: ${v.id} ${v.nodes.map((n) => n.target).join(" | ")}`),
    ).toEqual([]);
  }
  await signInWithPassword(page, email, PASSWORD, "/conta");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Perfil e segurança");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations.map((v) => `/conta: ${v.id}`)).toEqual([]);
});
