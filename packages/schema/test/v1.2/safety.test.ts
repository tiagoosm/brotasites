import { describe, expect, it } from "vitest";
import { cleanText, isSafeHref } from "../../src/v1.2/index.js";

describe("cleanText", () => {
  it("removes control characters and bidirectional overrides", () => {
    expect(cleanText("Padaria\u0000 do Zé\u0007")).toBe("Padaria do Zé");
    expect(cleanText("contato‮gnp.exe")).toBe("contatognp.exe");
    expect(cleanText("linha 1\nlinha 2")).toBe("linha 1\nlinha 2");
  });
});

describe("isSafeHref", () => {
  it.each([
    "https://wa.me/5535999990000",
    "https://www.google.com/maps/search/?api=1&query=Padaria",
    "tel:+553535550000",
    "mailto:contato@padariadoze.com.br",
    "#contato",
  ])("accepts %s", (href) => expect(isSafeHref(href)).toBe(true));

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://example.com",
    "//evil.example",
    "vbscript:msgbox(1)",
    'https://ok.example/"onmouseover="alert(1)',
    "tel:+55<script>",
    "mailto:a@b.com?bcc=x@y.com\nSubject",
  ])("refuses %s", (href) => expect(isSafeHref(href)).toBe(false));
});
