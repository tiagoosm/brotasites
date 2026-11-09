import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { allSteps, padaria, SITE, SUPABASE, signIn, siteRow, withSite } from "./support/supabase";

// Loading without freezing (E26, Doherty: every click shows a change within 100ms). With a slow
// network (800ms on the account pages) and a 4× slower CPU: the top bar or the page's skeleton
// shows within 150ms, the header and the footer stay on screen, and the page arrives without
// jumping. Fast pages never flash a skeleton; with reduced motion nothing moves.

const SLOW = 800;

/** Delays the documents and data of the pages matching `pattern`. */
async function slowDown(page: Page, pattern: RegExp, delay = SLOW) {
  await page.route(pattern, async (route) => {
    if (route.request().resourceType() === "document" || route.request().url().includes("_rsc")) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await route.continue();
  });
}

async function slowCpu(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

/**
 * Clicks and reports how long until the first sign of loading (the bar or a skeleton), whether
 * the header and footer stayed, and the layout shift summed until the page settled.
 */
async function clickAndWatch(page: Page, click: () => Promise<void>, settled: () => Promise<void>) {
  await page.evaluate(() => {
    const store = window as unknown as {
      firstSign: number | null;
      clickedAt: number;
      shift: number;
      lostShell: boolean;
    };
    store.firstSign = null;
    store.shift = 0;
    store.lostShell = false;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!entry.hadRecentInput) store.shift += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: false });
    const watch = () => {
      const bar = document.querySelector('[data-navigation-progress="loading"]');
      const skeleton = document.querySelector(".skeleton-screen");
      if (store.firstSign === null && (bar || skeleton)) {
        store.firstSign = performance.now() - store.clickedAt;
      }
      if (!document.querySelector("header") || !document.querySelector("footer")) {
        store.lostShell = true;
      }
      requestAnimationFrame(watch);
    };
    document.addEventListener(
      "click",
      () => {
        store.clickedAt = performance.now();
        requestAnimationFrame(watch);
      },
      { capture: true, once: true },
    );
  });
  await click();
  await settled();
  return page.evaluate(() => {
    const store = window as unknown as {
      firstSign: number | null;
      shift: number;
      lostShell: boolean;
    };
    return { firstSign: store.firstSign, shift: store.shift, lostShell: store.lostShell };
  });
}

async function board(request: APIRequestContext, sites: unknown[] = []) {
  const id = randomUUID();
  await request.post(`${SUPABASE}/__test/dashboard`, {
    data: { userId: id, fullName: "Zé da Padaria", sites },
  });
  return { id, email: `carregando-${id.slice(0, 8)}@padariadoze.com.br` };
}

const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

test.describe("a slow page answers at once", () => {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads the fixtures from this pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "the header's links are on the desktop");
  });

  test("Entrar ou cadastre-se: the bar at once, the shell stays, no jump", async ({ page }) => {
    await page.goto("/ajuda");
    await page.waitForLoadState("networkidle");
    // The pointer reaches the link first, as a person's does: its page's frame loads (prefetch
    // by intent), so the click shows the page's skeleton while the rest arrives.
    await page.getByRole("banner").getByRole("link", { name: "Entrar ou cadastre-se" }).hover();
    await page.waitForTimeout(800);
    await slowDown(page, /\/entrar(\?|$)/);
    await slowCpu(page);
    const result = await clickAndWatch(
      page,
      () => page.getByRole("banner").getByRole("link", { name: "Entrar ou cadastre-se" }).click(),
      async () => {
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entre na sua conta");
        await page.waitForTimeout(300);
      },
    );
    expect(result.firstSign).not.toBeNull();
    expect(result.firstSign ?? Number.POSITIVE_INFINITY).toBeLessThan(150);
    expect(result.lostShell).toBe(false);
    expect(result.shift).toBeLessThan(0.02);
  });

  test("Meus sites → a site, and the profile menu: the bar at once", async ({
    page,
    context,
    request,
  }) => {
    const site = {
      id: randomUUID(),
      status: "live",
      subdomain: "padaria-do-ze",
      status_message: null,
      created_at: days(9),
      updated_at: days(1),
      approved_at: days(3),
      published_at: days(2),
      site_configs: { name: "Padaria do Zé", completed: allSteps },
      site_events: [],
    };
    const who = await board(request, [site]);
    await signIn(context, { user: who });
    await page.goto("/meus-sites");
    await page.waitForLoadState("networkidle");
    await slowDown(page, /\/meus-sites\/[0-9a-f-]{36}/);
    await slowCpu(page);
    const toSite = await clickAndWatch(
      page,
      () => page.getByRole("link", { name: /^Detalhes de Padaria do Zé/ }).click(),
      async () => {
        await expect(page).toHaveURL(new RegExp(`/meus-sites/${site.id}`));
        await page.waitForTimeout(300);
      },
    );
    expect(toSite.firstSign ?? Number.POSITIVE_INFINITY).toBeLessThan(150);
    expect(toSite.lostShell).toBe(false);

    await page.goto("/meus-sites");
    await page.waitForLoadState("networkidle");
    await slowDown(page, /\/conta(\?|$)/);
    await page.getByRole("button", { name: /^Menu da conta/ }).click();
    const toAccount = await clickAndWatch(
      page,
      () => page.getByRole("menuitem", { name: "Perfil e segurança" }).click(),
      async () => {
        await expect(page).toHaveURL(/\/conta$/);
        await page.waitForTimeout(300);
      },
    );
    expect(toAccount.firstSign ?? Number.POSITIVE_INFINITY).toBeLessThan(150);
    expect(toAccount.lostShell).toBe(false);
  });

  test("a step of the form to the next: the bar at once", async ({ page, context }) => {
    await withSite(context, { site: siteRow("draft"), draft: padaria, completed: [] });
    await page.goto(`/criar/${SITE}/negocio`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await slowDown(page, /\/criar\/[^/]+\/marca(\?|$)/);
    await slowCpu(page);
    const result = await clickAndWatch(
      page,
      () => page.getByRole("button", { name: /^Próximo: marca/ }).click(),
      async () => {
        await expect(page).toHaveURL(/\/marca$/);
        await page.waitForTimeout(300);
      },
    );
    expect(result.firstSign ?? Number.POSITIVE_INFINITY).toBeLessThan(150);
    expect(result.lostShell).toBe(false);
  });

  test("while it loads, the skeleton passes axe and is announced once", async ({ page }) => {
    await page.goto("/ajuda");
    await page.waitForLoadState("networkidle");
    await page.getByRole("banner").getByRole("link", { name: "Entrar ou cadastre-se" }).hover();
    await page.waitForTimeout(800);
    await slowDown(page, /\/entrar(\?|$)/, 4000);
    await page.getByRole("banner").getByRole("link", { name: "Entrar ou cadastre-se" }).click();
    const skeleton = page.locator(".skeleton-screen");
    await expect(skeleton).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Carregando…" })).toHaveCount(1);
    await expect(skeleton).toHaveAttribute("aria-busy", "true");
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});

test("a fast page never flashes a skeleton", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the header's links are on the desktop");
  await page.goto("/ajuda");
  await page.waitForLoadState("networkidle");
  // Warm: the pointer reaches the link first (prefetch by intent), then the click.
  const link = page.getByRole("banner").getByRole("link", { name: "Entrar ou cadastre-se" });
  await link.hover();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const store = window as unknown as { seen: number };
    store.seen = 0;
    const watch = () => {
      for (const element of document.querySelectorAll(".skeleton-screen")) {
        store.seen = Math.max(store.seen, Number(getComputedStyle(element).opacity));
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await link.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entre na sua conta");
  const seen = await page.evaluate(() => (window as unknown as { seen: number }).seen);
  expect(seen).toBeLessThan(0.5);
});

test("with reduced motion the bar and the skeleton do not move", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "the header's links are on the desktop");
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/ajuda");
  await page.waitForLoadState("networkidle");
  await page.getByRole("banner").getByRole("link", { name: "Entrar ou cadastre-se" }).hover();
  await page.waitForTimeout(800);
  await slowDown(page, /\/entrar(\?|$)/, 4000);
  await page.getByRole("banner").getByRole("link", { name: "Entrar ou cadastre-se" }).click();
  await expect(page.locator(".skeleton-screen")).toBeVisible();
  const moving = await page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target as Element | null;
        return (
          target?.closest(".skeleton-screen, .navigation-progress") &&
          animation.playState === "running" &&
          (animation.effect?.getComputedTiming().duration as number) > 1
        );
      }).length,
  );
  expect(moving).toBe(0);
  expect(
    await page
      .locator(".navigation-progress")
      .evaluate((bar) => getComputedStyle(bar).transitionDuration),
  ).not.toMatch(/[1-9]s/);
  await context.close();
});
