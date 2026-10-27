import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PREVIEW_URL } from "../playwright.config";

// The preview server on its own: what it accepts, what it refuses and who may frame it.

const example = readFileSync(
  new URL("../../../docs/legacy/site-config.example.v1.1.json", import.meta.url),
  "utf8",
);

test.describe("preview server", () => {
  test.skip(({ isMobile }) => isMobile, "Server checks do not depend on the viewport");

  test("renders a posted draft and only lets the platform frame it", async ({ request }) => {
    const config = JSON.parse(example);
    config.business.name = "Ateliê Lume";
    const response = await request.post(`${PREVIEW_URL}/render`, {
      form: { config: JSON.stringify(config), scroll: "0", animate: "0" },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-security-policy"]).toBe(
      "frame-ancestors http://localhost:3100",
    );
    expect(response.headers()["cache-control"]).toBe("no-store");
    const html = await response.text();
    expect(html).toContain("Ateliê Lume");
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain('name="robots" content="noindex"');
  });

  test("refuses drafts that are not valid", async ({ request }) => {
    const broken = await request.post(`${PREVIEW_URL}/render`, { form: { config: "{" } });
    expect(broken.status()).toBe(400);
    const invalid = await request.post(`${PREVIEW_URL}/render`, {
      form: { config: JSON.stringify({ schemaVersion: "9" }) },
    });
    expect(invalid.status()).toBe(422);
  });

  test("never renders link buttons that run scripts", async ({ request }) => {
    const config = JSON.parse(example);
    config.sections[0].content.cta = {
      label: "Clique",
      action: "link",
      target: "javascript:alert(1)",
    };
    const response = await request.post(`${PREVIEW_URL}/render`, {
      form: { config: JSON.stringify(config) },
    });
    expect(response.status()).toBe(422);
  });
});
