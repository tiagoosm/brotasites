import { test } from "@playwright/test";

const sizes: [number, number][] = [
  [1440, 900],
  [1366, 650],
  [390, 844],
];
test("shots", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const g = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (n: number) {
      const v = g.call(this, n);
      return typeof v === "string" && /swiftshader/i.test(v) ? "Test GPU" : v;
    };
  });
  for (const p of ["entrar", "cadastro"])
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/" + p);
      if (p === "cadastro") {
        await page.getByLabel("Senha", { exact: true }).fill("Cafe-forte");
      }
      await page.waitForTimeout(3500);
      await page.screenshot({
        path:
          "/tmp/claude-0/-home-user-brotasites/245080da-37d7-593a-b65b-4d401382a097/scratchpad/e27/" +
          (process.env.TAG ?? "antes") +
          "-" +
          p +
          "-" +
          w +
          "x" +
          h +
          ".png",
      });
    }
});
