import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import {
  allBefore,
  allSteps,
  padaria,
  SITE,
  SUPABASE,
  signIn,
  siteRow,
  threeDirections,
  withSite,
} from "./support/supabase";
import { findSmallTargetsWhileScrolling } from "./support/targets";

// The measurable part of docs/ux-laws.md (E22), on the main screens at 360 and 1280px. The rest
// of the laws are a checklist in that document.

type Setup = (page: Page) => Promise<void>;

const site =
  (status: string, step?: string): Setup =>
  async (page) => {
    await withSite(page.context(), {
      site: siteRow(status, {
        subdomain: "padaria-do-ze",
        approved_direction: ["awaiting_approval", "live"].includes(status)
          ? (threeDirections[0]?.id ?? null)
          : null,
      }),
      draft: padaria,
      completed: step ? allBefore(step) : allSteps,
      directions: threeDirections,
    });
  };

const board: Setup = async (page) => {
  const id = randomUUID();
  const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const row = (status: string, name: string) => ({
    id: randomUUID(),
    status,
    subdomain: null,
    status_message: null,
    created_at: days(10),
    updated_at: days(1),
    approved_at: null,
    published_at: null,
    site_configs: { name, completed: ["negocio"] },
    site_events: [],
  });
  await page.request.post(`${SUPABASE}/__test/dashboard`, {
    data: {
      userId: id,
      fullName: "Zé da Padaria",
      sites: [row("draft", "Padaria do Zé"), row("awaiting_direction_choice", "Studio Lume")],
    },
  });
  await signIn(page.context(), { user: { id, email: `ux-${id.slice(0, 8)}@padariadoze.com.br` } });
};

const screens: [string, string, Setup?][] = [
  ["início", "/"],
  ["entrar", "/entrar"],
  ["cadastro", "/cadastro"],
  ["esqueci a senha", "/esqueci-senha"],
  ["página não encontrada", "/nao-existe"],
  ["meus sites", "/meus-sites", board],
  ["conta", "/conta", board],
  ["passo 1", `/criar/${SITE}/negocio`, site("draft", "negocio")],
  ["passo 3", `/criar/${SITE}/secoes`, site("draft", "secoes")],
  ["passo 4", `/criar/${SITE}/conteudo`, site("draft", "conteudo")],
  ["passo 5 (enviar)", `/criar/${SITE}/contato`, site("draft", "contato")],
  ["publicar", `/meus-sites/${SITE}/publicar`, site("awaiting_approval")],
  ["escolha das direções", `/meus-sites/${SITE}`, site("awaiting_direction_choice")],
  ["site pronto", `/meus-sites/${SITE}`, site("awaiting_approval")],
  ["site no ar", `/meus-sites/${SITE}`, site("live")],
];

/** Primary actions (filled leaf buttons and the create-site button), grouped by the block they sit in. */
function primariesByRegion(page: Page) {
  return page.evaluate(() => {
    const selector =
      "[data-slot=button][data-variant=default], a.bg-primary, button.bg-primary, [data-create-site]";
    const regions = new Map<Element, string[]>();
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height || element.closest("[aria-hidden='true'], [hidden]")) continue;
      const region =
        element.closest("li, form, section, article, [role=dialog], header, footer, main") ??
        document.body;
      regions.set(region, [...(regions.get(region) ?? []), (element.textContent ?? "").trim()]);
    }
    return [...regions.values()].filter((labels) => labels.length > 1);
  });
}

for (const width of [360, 1280]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: width < 768 ? 760 : 900 }, reducedMotion: "reduce" });

    for (const [name, path, setup] of screens) {
      test(`${name}: 44px targets, no sideways scroll, one highlight per block`, async ({
        page,
      }, info) => {
        test.skip(info.project.name !== "desktop", "the sizes are set here");
        test.setTimeout(60_000);
        await setup?.(page);
        await page.goto(path);
        await page.waitForTimeout(800);
        // Fitts: every target has its own 44 x 44px area.
        expect(await findSmallTargetsWhileScrolling(page)).toEqual([]);
        // Nothing wider than the screen.
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        // Von Restorff and Hick: no block offers two highlighted actions.
        await page.evaluate(() => window.scrollTo(0, 0));
        expect(await primariesByRegion(page)).toEqual([]);
      });
    }
  });
}

test("Hick: the header has at most 5 links and the profile menu at most 5 items", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the bar's links live in the phone menu");
  await board(page);
  await page.goto("/meus-sites");
  const nav = page.getByRole("banner").getByRole("navigation", { name: "Principal" });
  expect(await nav.getByRole("link").count()).toBeLessThanOrEqual(5);
  await page.getByRole("button", { name: /^Menu da conta/ }).click();
  expect(await page.getByRole("menuitem").count()).toBeLessThanOrEqual(5);
});

test("Jakob and proximity: every field has a visible label, and errors sit under their field", async ({
  page,
}) => {
  for (const path of ["/entrar", "/cadastro", "/esqueci-senha"]) {
    await page.goto(path);
    const unlabeled = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLInputElement>("main input, main select, main textarea")]
        .filter((field) => !["hidden", "checkbox", "radio"].includes(field.type))
        .filter((field) => field.getBoundingClientRect().height > 0)
        .filter((field) => {
          const label = field.labels?.[0];
          return !label || label.getBoundingClientRect().height === 0;
        })
        .map((field) => field.name || field.id),
    );
    expect(unlabeled, path).toEqual([]);
  }
  await page.goto("/cadastro");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.locator("main [aria-invalid='true']").first()).toBeVisible();
  const far = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main [aria-invalid='true']")].flatMap((field) => {
      // The error is the field's first description; later ones (a password's checklist, E26)
      // may sit further down.
      const ids = (field.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
      const errors = ids
        .slice(0, 1)
        .map((id) => document.getElementById(id))
        .filter((el) => el?.textContent);
      if (errors.length === 0) return [`${field.id}: no error tied to it`];
      // A checkbox's field is its row with the label beside it.
      const anchor =
        field instanceof HTMLInputElement && field.type === "checkbox"
          ? (field.parentElement ?? field)
          : field;
      const box = anchor.getBoundingClientRect();
      return errors
        .map((error) => (error as HTMLElement).getBoundingClientRect())
        .filter((e) => e.top - box.bottom > 48 || e.bottom < box.top - 48)
        .map(() => `${field.id}: error far from the field`);
    }),
  );
  expect(await page.locator("main [aria-invalid='true']").count()).toBeGreaterThan(0);
  expect(far).toEqual([]);
});

test("Doherty: the main buttons answer in under 400ms, even on a slow phone and network", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "CPU throttling is a Chromium feature");
  await site("draft", "negocio")(page);
  await page.goto(`/criar/${SITE}/negocio`);
  await page.waitForLoadState("networkidle");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // The next step's page takes 1.5s to arrive.
  await page.route(`**/criar/${SITE}/marca**`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fallback();
  });
  const next = page.getByRole("button", { name: /^Próximo/ });
  // Timed inside the page, from the click to the button saying it is on its way.
  await next.evaluate((button) => {
    const w = window as unknown as { answeredIn?: number };
    let clickedAt = 0;
    button.addEventListener(
      "click",
      () => {
        clickedAt = performance.now();
      },
      { capture: true, once: true },
    );
    new MutationObserver((_, observer) => {
      if (button.getAttribute("aria-busy") === "true" && clickedAt) {
        w.answeredIn = performance.now() - clickedAt;
        observer.disconnect();
      }
    }).observe(button, { attributes: true });
  });
  await next.click();
  await expect(next).toHaveAttribute("aria-busy", "true", { timeout: 2000 });
  const answeredIn = await page.evaluate(
    () => (window as unknown as { answeredIn?: number }).answeredIn,
  );
  expect(answeredIn).toBeLessThan(400);
  await expect(page).toHaveURL(/\/marca$/, { timeout: 10_000 });
});

test("Gradient de meta: the form always shows how far along it is", async ({ page }) => {
  await site("draft", "conteudo")(page);
  await page.goto(`/criar/${SITE}/conteudo`);
  await expect(
    page
      .getByText(/Passo\s*4\s*de\s*5/i)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test("Zeigarnik: an unfinished site waits on Meus sites, with where it stopped", async ({
  page,
}) => {
  await board(page);
  await page.goto("/meus-sites");
  const pending = page.getByRole("list", { name: "Seus sites" });
  await expect(pending.getByText(/Continue de onde parou/)).toBeVisible();
  await expect(pending.getByRole("link", { name: /Continuar/ })).toHaveAttribute(
    "href",
    /\/criar\/.+\/marca$/,
  );
});

test("Murphy: an unknown address answers 404 in Portuguese, with a way back", async ({ page }) => {
  const response = await page.goto("/nao-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Página não encontrada");
  await expect(page.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Ir para Meus sites" })).toHaveAttribute(
    "href",
    "/meus-sites",
  );
});
