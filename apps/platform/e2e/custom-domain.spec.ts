import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { fakeSupabase, padaria, SITE, signIn, siteRow, withSite } from "./support/supabase";
import { findSmallTargetsWhileScrolling } from "./support/targets";

// The client's own domain (E25), with the simulated hosting: connecting, the DNS steps,
// "Verificar agora", refusals, the main address, removing, and who may use it.

const page_ = `/meus-sites/${SITE}`;
const live = () =>
  siteRow("live", {
    subdomain: "padaria-do-ze",
    approved_direction: "d0000000-0000-4000-8000-000000000000",
  });

test("a published site connects its domain, sees the steps, verifies it and picks the main address", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { site: live(), draft: padaria });
  await page.goto(page_);
  const section = page.getByRole("region", { name: "Usar o seu próprio domínio" });
  await expect(section).toContainText("Opcional e incluído no preço");
  await section.getByLabel("Seu domínio").fill("PadariaDoZe.com.br");
  await section.getByRole("button", { name: "Conectar domínio" }).click();

  // The www is connected; the root redirects to it at the registrar.
  await expect(section.getByText("www.padariadoze.com.br").first()).toBeVisible();
  await expect(section).toContainText("Aguardando configuração");
  await expect(section.getByRole("heading", { name: "Como configurar" })).toBeVisible();
  await expect(section).toContainText(
    "ative no registrador o redirecionamento de padariadoze.com.br para https://www.padariadoze.com.br",
  );
  await expect(section.getByText("clientes.sites.localhost")).toBeVisible();
  await expect(section.getByRole("button", { name: /^Copiar/ })).toHaveCount(4);

  await section.getByRole("button", { name: "Verificar agora" }).click();
  await expect(section).toContainText("Ativo");
  await expect(section.getByRole("status")).toHaveText("Tudo certo: o domínio está ativo.");
  expect(state.domain?.status).toBe("active");

  // The BrotaSites address becomes the main one; the own domain will lead to it.
  const brotasites = section.getByRole("radio", { name: "padaria-do-ze.sites.localhost" });
  await brotasites.click();
  await expect(brotasites).toBeChecked();
  await expect(section.getByRole("status")).toHaveText(
    "Endereço principal atualizado. O outro leva a ele.",
  );
  expect(state.domain?.primary).toBe(false);
});

test("a domain still waiting says so, and a refused one says what to do", async ({
  page,
  context,
}) => {
  await withSite(context, { site: live(), draft: padaria });
  await page.goto(page_);
  const section = page.getByRole("region", { name: "Usar o seu próprio domínio" });
  await section.getByLabel("Seu domínio").fill("pendente.padariadoze.com.br");
  await section.getByRole("button", { name: "Conectar domínio" }).click();
  await section.getByRole("button", { name: "Verificar agora" }).click();
  await expect(section).toContainText("Verificando");
  await expect(section).toContainText("conferimos sozinhos todos os dias por 7 dias");
});

test("refusals come with the right message, and a domain another site uses is refused", async ({
  page,
  context,
}) => {
  await withSite(context, {
    site: live(),
    draft: padaria,
    takenDomains: ["www.oficinanova.com.br"],
  });
  await page.goto(page_);
  const section = page.getByRole("region", { name: "Usar o seu próprio domínio" });
  const field = section.getByLabel("Seu domínio");
  const connect = section.getByRole("button", { name: "Conectar domínio" });
  for (const [typed, message] of [
    ["padaria.sites.localhost", "Esse domínio é da BrotaSites. Use o domínio do seu negócio."],
    [
      "banco-do-povo.com.br",
      "Esse domínio parece de um banco, de um órgão público ou de outra marca, e não pode ser conectado.",
    ],
    ["192.168.0.1", "Use um domínio, como seunegocio.com.br, e não um número de IP."],
    ["xn--padariadoz-k7a.com.br", "Domínios com acento ou letras especiais ainda não são aceitos."],
    ["oficinanova.com.br", "Esse domínio já está conectado a outro site."],
  ] as const) {
    await field.fill(typed);
    await connect.click();
    await expect(section.getByRole("alert")).toHaveText(message);
  }
  // The error sits right under the field (proximity).
  const fieldBox = await field.boundingBox();
  const alertBox = await section.getByRole("alert").boundingBox();
  expect((alertBox?.y ?? 0) - ((fieldBox?.y ?? 0) + (fieldBox?.height ?? 0))).toBeLessThan(48);
});

test("removing asks first, and the site stays at its BrotaSites address", async ({
  page,
  context,
}) => {
  const state = await withSite(context, {
    site: live(),
    draft: padaria,
    domain: {
      host: "www.padariadoze.com.br",
      aliasHost: "padariadoze.com.br",
      status: "active",
      primary: true,
      records: [],
      failure: null,
    },
  });
  await page.goto(page_);
  const section = page.getByRole("region", { name: "Usar o seu próprio domínio" });
  await section.getByRole("button", { name: "Remover domínio" }).click();
  await expect(section).toContainText(
    "Desconectar www.padariadoze.com.br? O site continua no endereço da BrotaSites.",
  );
  await section.getByRole("button", { name: "Cancelar" }).click();
  expect(state.domain).not.toBeNull();
  await section.getByRole("button", { name: "Remover domínio" }).click();
  await section.getByRole("button", { name: "Sim, remover" }).click();
  await expect(section.getByRole("status")).toHaveText("Domínio desconectado.");
  await expect(section.getByLabel("Seu domínio")).toBeVisible();
  expect(state.domain).toBeNull();
});

test("an unpaid site has no domain flow, only a note on Publicar; the route refuses it", async ({
  page,
  context,
}) => {
  const state = await withSite(context, {
    site: siteRow("awaiting_approval", {
      subdomain: "padaria-do-ze",
      approved_direction: "d0000000-0000-4000-8000-000000000000",
    }),
    draft: padaria,
  });
  await page.goto(page_);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Usar o seu próprio domínio" })).toHaveCount(0);
  const refused = await page.evaluate(async (site) => {
    const response = await fetch(`/api/sites/${site}/domain`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host: "padariadoze.com.br" }),
    });
    return { status: response.status, body: await response.json() };
  }, SITE);
  expect(refused).toEqual({
    status: 409,
    body: { error: "O domínio próprio fica disponível depois que o site for publicado." },
  });

  // On Publicar, the domain is only a note in the draft, for later.
  await page.goto(`${page_}/publicar`);
  await page.getByLabel("Seu domínio, se tiver").fill("padariadoze.com.br");
  await expect
    .poll(() => (state.draft.site as { customDomain?: string })?.customDomain)
    .toBe("padariadoze.com.br");
});

test("another account never reaches the domain of a site that is not theirs", async ({
  page,
  context,
}) => {
  const user = await signIn(context, {
    user: { id: "2c0a7b5e-9d2f-4f61-8b3a-5e7d9c2a4f11", email: "outra@conta.com.br" },
  });
  await fakeSupabase(context, user, { site: null });
  await page.goto(page_);
  await expect(page.getByRole("region", { name: "Usar o seu próprio domínio" })).toHaveCount(0);
  const status = await page.evaluate(
    async (site) => (await fetch(`/api/sites/${site}/domain`)).status,
    SITE,
  );
  expect(status).toBe(404);
});

test("the domain section passes axe, with 44px targets and no sideways scroll at 360px", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await withSite(context, {
    site: live(),
    draft: padaria,
    domain: {
      host: "www.padariadoze.com.br",
      aliasHost: "padariadoze.com.br",
      status: "pending",
      primary: true,
      failure: null,
      records: [
        {
          type: "CNAME",
          name: "www.padariadoze.com.br",
          value: "clientes.sites.localhost",
          purpose: "route",
        },
        {
          type: "TXT",
          name: "_cf-custom-hostname.www.padariadoze.com.br",
          value: "0e2d5a7f-1548-4f27-8c05-b577cb14f4ec",
          purpose: "ownership",
        },
      ],
    },
  });
  await page.goto(page_);
  const section = page.getByRole("region", { name: "Usar o seu próprio domínio" });
  await expect(section.getByRole("heading", { name: "Como configurar" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).include("#dominio").analyze();
  expect(axe.violations).toEqual([]);
  expect(await findSmallTargetsWhileScrolling(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
