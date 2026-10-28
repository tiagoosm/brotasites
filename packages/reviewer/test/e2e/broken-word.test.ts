import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkInBrowser } from "../../src/index.js";

// A title too large for its column breaks a word anywhere in a browser without Portuguese
// hyphenation ("Forn" / "o"). The check flags it; a break at the word's own hyphen is fine.

function page(title: string, width: string): string {
  const dir = mkdtempSync(join(tmpdir(), "brotasites-broken-word-"));
  writeFileSync(
    join(dir, "index.html"),
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Teste</title>
<style>body{margin:0;font:16px/1.5 sans-serif} h1{width:${width};margin:1rem;font-size:48px;overflow-wrap:anywhere}</style>
</head><body><main><section id="abertura"><h1>${title}</h1></section></main></body></html>`,
  );
  return dir;
}

describe("broken words", () => {
  it("flags a word broken in the middle of a large title", async () => {
    const result = await checkInBrowser(page("Pizzaria Forno a Lenha", "9rem"));
    const broken = result.findings.filter((finding) => finding.check === "broken-word");
    expect(broken.map((finding) => finding.message)).toEqual([
      expect.stringContaining('Palavra quebrada no meio: "Pizzaria".'),
    ]);
  });

  it("accepts words that fit and breaks at a hyphen", async () => {
    const result = await checkInBrowser(page("Pé-de-moleque e bolo", "16rem"));
    expect(result.findings.filter((finding) => finding.check === "broken-word")).toEqual([]);
  });
});
