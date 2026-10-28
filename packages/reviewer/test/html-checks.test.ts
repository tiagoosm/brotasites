import { describe, expect, it } from "vitest";
import { checkBuild, WEIGHT_BUDGET } from "../src/index.js";
import { cleanFiles, cleanHtml, fakeDist } from "./helpers.js";

const checks = (html: string, files: Record<string, string | Buffer> = cleanFiles) =>
  checkBuild(fakeDist(html, files)).map((finding) => finding.check);

describe("checkBuild", () => {
  it("passes a clean page", () => {
    expect(checkBuild(fakeDist(cleanHtml, cleanFiles))).toEqual([]);
  });

  it("refuses scripts, handlers, frames and javascript: links as security findings", () => {
    const html = cleanHtml.replace(
      "</main>",
      '<script>x()</script><img src="/_astro/hero.webp" alt="" onerror="x()"><iframe src="/x"></iframe><a href="javascript:x()">a</a></main>',
    );
    const findings = checkBuild(fakeDist(html, cleanFiles));
    expect(findings.map((f) => f.check)).toEqual(
      expect.arrayContaining(["inline-script", "event-handler", "forbidden-tag", "unsafe-link"]),
    );
    expect(findings.every((f) => f.security)).toBe(true);
  });

  it("refuses anything loaded from outside, in the page or in the CSS", () => {
    expect(
      checks(cleanHtml.replace("</main>", '<img src="https://x.com/a.png" alt="a"></main>')),
    ).toContain("external-request");
    expect(
      checks(cleanHtml, {
        ...cleanFiles,
        "_astro/site.css": "@import url(https://fonts.googleapis.com/css);",
      }),
    ).toContain("external-request");
    expect(
      checks(
        cleanHtml.replace(
          "</main>",
          '<img srcset="//cdn.x/a.png 2x" src="/_astro/hero.webp" alt="a"></main>',
        ),
      ),
    ).toContain("external-request");
  });

  it("finds missing files, missing alt text, dead anchors and inline styles", () => {
    expect(checks(cleanHtml, { ...cleanFiles, "_astro/hero.webp": "" }).length).toBe(0);
    const { "_astro/hero.webp": _, ...withoutHero } = cleanFiles;
    expect(checks(cleanHtml, withoutHero)).toEqual(["broken-resource"]);
    expect(checks(cleanHtml.replace(' alt="Pães no balcão"', ""))).toEqual(["image-alt"]);
    expect(checks(cleanHtml.replace('href="#contato"', 'href="#horarios"'))).toEqual([
      "broken-anchor",
    ]);
    expect(checks(cleanHtml.replace("<main>", '<main style="color:red">'))).toEqual([
      "inline-style",
    ]);
  });

  it("keeps the page and its script within budget", () => {
    expect(
      checks(cleanHtml, {
        ...cleanFiles,
        "_astro/hero.webp": Buffer.alloc(WEIGHT_BUDGET.totalBytes),
      }),
    ).toEqual(expect.arrayContaining(["page-weight", "heavy-image"]));
    const bigScript = Array.from({ length: 4000 }, (_, i) => `const v${i}=${Math.random()};`).join(
      "",
    );
    expect(checks(cleanHtml, { ...cleanFiles, "_astro/motion.js": bigScript })).toContain(
      "script-weight",
    );
  });
});
