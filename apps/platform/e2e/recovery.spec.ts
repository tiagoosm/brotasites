import { expect, type Page, test } from "@playwright/test";
import {
  createUser,
  lastMail,
  linkOf,
  ownIp,
  PASSWORD,
  signInWithPassword,
  uniqueEmail,
} from "./support/accounts";
import { SUPABASE } from "./support/supabase";

// The "Esqueci a senha" link opens a restricted recovery session (E30, lib/auth/recovery.ts):
// only the reset page works, the header is a visitor's, leaving ends it, saving ends every
// session and leads to sign in, and it never opens the team's area.

test.beforeEach(async ({ context }) => {
  await ownIp(context);
});

const NEW_PASSWORD = "Cafe-com-leite-2026";

async function openResetLink(page: Page, request: Parameters<typeof createUser>[0], tag: string) {
  const email = uniqueEmail(tag);
  const user = await createUser(request, { email });
  await page.goto("/esqueci-senha");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  const mail = await lastMail(request, email, "recovery");
  await page.goto(linkOf(mail));
  await expect(page).toHaveURL(/\/redefinir-senha$/);
  return { email, user, mail };
}

const profileButton = (page: Page) =>
  page.getByRole("banner").getByRole("button", { name: /^Menu da conta/ });

test("the reset page is a visitor's, and nothing else opens while the reset is pending", async ({
  page,
  request,
}) => {
  const { email } = await openResetLink(page, request, "recuperar");
  await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();
  // No profile menu, no "Criar meu site", and none of the visitor's buttons on this screen.
  await expect(profileButton(page)).toHaveCount(0);
  for (const name of ["Criar meu site", "Entrar", "Criar conta"]) {
    await expect(page.getByRole("banner").getByRole("link", { name, exact: true })).toHaveCount(0);
  }
  // Protected pages lead back to the reset page.
  for (const path of ["/meus-sites", "/conta", "/criar", "/admin"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/redefinir-senha$/);
  }
  // The API refuses it.
  const me = await page.request.get("/api/account/me");
  expect(me.status()).toBe(403);
  const sites = await page.request.post("/api/sites", {
    headers: { origin: "http://localhost:3100" },
    data: {},
  });
  expect(sites.status()).toBe(403);

  // Saving ends every session and leads to sign in with the new password.
  await page.getByLabel("Nova senha", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Repita a nova senha").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page).toHaveURL(/\/entrar\?senha=alterada$/);
  await expect(page.getByText("Senha alterada. Entre com a nova senha.")).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "brotasites_recovery")).toBe(false);
  await page.goto("/meus-sites");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fmeus-sites$/);
  // The new password works.
  await signInWithPassword(page, email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/meus-sites$/);
  await expect(profileButton(page)).toBeVisible();
});

test("leaving the reset page ends the recovery session", async ({ page, request }) => {
  await openResetLink(page, request, "recuperar-sair");
  const marker = (await page.context().cookies()).find((c) => c.name === "brotasites_recovery");
  expect(marker?.httpOnly).toBe(true);
  expect(marker?.sameSite).toBe("Lax");
  await page.goto("/ajuda");
  // A visitor again: the session and its marker are gone.
  await expect(profileButton(page)).toHaveCount(0);
  const isPhone = (page.viewportSize()?.width ?? 0) < 768;
  if (!isPhone) {
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Entrar", exact: true }),
    ).toBeVisible();
  }
  expect((await page.context().cookies()).some((c) => c.name === "brotasites_recovery")).toBe(
    false,
  );
  await page.goto("/meus-sites");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fmeus-sites$/);
  // Back on the reset address there is nothing to reset with.
  await page.goto("/redefinir-senha");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Link expirado");
});

test("moving away inside the app ends the recovery session too", async ({ page, request }) => {
  await openResetLink(page, request, "recuperar-link");
  await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  const isPhone = (page.viewportSize()?.width ?? 0) < 768;
  if (isPhone) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Ajuda" }).click();
  } else {
    await page.getByRole("banner").getByRole("link", { name: "Ajuda" }).click();
  }
  await expect(page).toHaveURL(/\/ajuda$/);
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((cookie) => cookie.name.startsWith("sb-")),
    )
    .toBe(false);
  await page.goto("/meus-sites");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fmeus-sites$/);
});

test("the link works once", async ({ page, request }) => {
  const { mail } = await openResetLink(page, request, "recuperar-duas");
  await page.context().clearCookies();
  await page.goto(linkOf(mail));
  await expect(page).toHaveURL(/\/entrar\?erro=link/);
  await expect(
    page.getByText("Esse link expirou ou já foi usado.", { exact: false }),
  ).toBeVisible();
});

test("recovering a team account never opens the team's area", async ({ page, request }) => {
  // With the team's second step off (E33, the fake's default, as in production now): the list
  // alone would let a team session in, never a recovery one. The database refuses it too
  // (supabase/tests/accounts.sql, both positions of the switch).
  const { user } = await openResetLink(page, request, "recuperar-equipe");
  await request.post(`${SUPABASE}/__test/team`, { data: { userId: user.id } });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/redefinir-senha$/);
  expect((await page.request.get("/api/admin/queue")).status()).toBe(403);
});

test("changing the password in the account keeps the person signed in, as before", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("trocar-logado");
  await createUser(request, { email });
  await signInWithPassword(page, email, PASSWORD, "/conta");
  await expect(page).toHaveURL(/\/conta$/);
  await page.getByLabel("Senha atual").fill(PASSWORD);
  await page.getByLabel("Nova senha", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Repita a nova senha").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("Senha trocada.", { exact: false })).toBeVisible();
  await page.goto("/meus-sites");
  await expect(page).toHaveURL(/\/meus-sites$/);
});
