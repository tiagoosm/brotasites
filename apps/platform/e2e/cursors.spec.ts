import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import {
  allSteps,
  padaria,
  SITE,
  SUPABASE,
  signIn,
  siteRow,
  threeDirections,
  withSite,
} from "./support/supabase";

// The right cursor on every interactive element (E26, globals.css): the hand on what acts on a
// click, the text bar on text fields, "not allowed" on what is blocked and "progress" on what is
// working. No interactive element may keep the default arrow.

const publicPages = ["/", "/ajuda", "/entrar", "/cadastro"];
const signedInPages = [
  "/painel",
  `/meus-sites/${SITE}`,
  `/criar/${SITE}/negocio`,
  `/criar/${SITE}/marca`,
  "/conta",
];

interface Wrong {
  element: string;
  expected: string;
  cursor: string;
}

/** Every visible interactive element whose cursor is not the one it should have. */
function wrongCursors(page: Page): Promise<Wrong[]> {
  return page.evaluate(() => {
    const selector = [
      "a[href]",
      "button",
      "summary",
      "select",
      "textarea",
      "input:not([type=hidden])",
      "[role=button]",
      "[role=menuitem]",
      "[role=tab]",
      "[role=switch]",
      "[role=checkbox]",
      "[role=radio]",
      "label:has(> input[type=checkbox])",
      "label:has(> input[type=radio])",
      "label:has(> input[type=file])",
    ].join(",");
    const textTypes = ["text", "email", "password", "search", "tel", "url", "number", ""];
    const wrong: Wrong[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      // Hidden, or visually hidden inside its label (the label carries the cursor).
      const box = element.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1 || !element.checkVisibility()) continue;
      const busy = element.closest('[aria-busy="true"]');
      const blocked =
        element.matches(':disabled, [aria-disabled="true"], [data-disabled]') ||
        (element.matches("label") && element.querySelector(":disabled") !== null);
      const isText =
        element.matches("textarea") ||
        (element.matches("input") &&
          textTypes.includes((element.getAttribute("type") ?? "").toLowerCase()));
      const expected = busy ? "progress" : blocked ? "not-allowed" : isText ? "text" : "pointer";
      const cursor = getComputedStyle(element).cursor;
      if (cursor !== expected) {
        const name = (element.getAttribute("aria-label") || element.textContent || "")
          .trim()
          .slice(0, 30);
        wrong.push({ element: `${element.tagName.toLowerCase()} "${name}"`, expected, cursor });
      }
    }
    return wrong;
  });
}

for (const path of [...publicPages, ...signedInPages]) {
  test(`every interactive element on ${path} has the right cursor`, async ({ page, context }) => {
    if (signedInPages.includes(path)) {
      await withSite(context, {
        site: siteRow("awaiting_direction_choice"),
        draft: padaria,
        completed: allSteps,
        directions: threeDirections,
      });
    }
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await wrongCursors(page)).toEqual([]);
  });
}

test("a working button shows progress, and a blocked one says why and shows it", async ({
  page,
  context,
  request,
}) => {
  // Signed out, a sending button (aria-busy) shows the progress cursor.
  await page.goto("/entrar");
  const submit = page.getByRole("button", { name: "Entrar", exact: true });
  await submit.evaluate((button) => button.setAttribute("aria-busy", "true"));
  await expect(submit).toHaveCSS("cursor", "progress");

  const id = randomUUID();
  const open = randomUUID();
  const now = new Date().toISOString();
  await request.post(`${SUPABASE}/__test/dashboard`, {
    data: {
      userId: id,
      fullName: "Zé da Padaria",
      sites: [
        {
          id: open,
          status: "draft",
          subdomain: null,
          status_message: null,
          created_at: now,
          updated_at: now,
          approved_at: null,
          published_at: null,
          last_activity_at: now,
          keep_until: null,
          site_configs: { name: "Padaria do Zé", completed: ["negocio"] },
          site_events: [],
        },
      ],
      slots: { open: 1, allowed: 1, openSiteId: open },
    },
  });
  await signIn(context, { user: { id, email: `cursor-${id.slice(0, 8)}@padariadoze.com.br` } });
  await page.goto("/painel");
  // One unpaid site at a time (E24): "Criar outro site" is blocked, with the reason in text.
  const blocked = page.getByRole("button", { name: "Criar outro site" });
  await expect(blocked).toBeDisabled();
  await expect(blocked).toHaveCSS("cursor", "not-allowed");
  const reason = await blocked.getAttribute("aria-describedby");
  expect(reason).toBeTruthy();
  await expect(page.locator(`#${reason}`)).not.toBeEmpty();
});
