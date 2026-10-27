import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkAstroVariant, checkVariant } from "../src/index.js";

const variantsDir = new URL("../../templates/src/v12/variants/", import.meta.url);
const files = readdirSync(variantsDir).filter((file) => file.endsWith(".astro"));

describe("our variants", () => {
  it("exist", () => {
    expect(files.length).toBeGreaterThanOrEqual(34);
  });

  it.each(files)("%s is in the dialect", (file) => {
    expect(checkAstroVariant(readFileSync(new URL(file, variantsDir), "utf8"))).toEqual([]);
  });
});

describe("the dialect refuses", () => {
  const markup = (html: string) =>
    checkVariant({ markup: html, css: "" }).map((issue) => issue.rule);
  const css = (code: string) => checkVariant({ markup: "", css: code }).map((issue) => issue.rule);

  it.each([
    ["<script>alert(1)</script>", "script"],
    ['<SCRIPT src="x.js"></SCRIPT>', "script"],
    ['<img src="a.jpg" onerror="alert(1)">', "event-handler"],
    ['<div onmouseover = "x()">', "event-handler"],
    ['<div style="color:red">', "inline-style"],
    ['<a href="javascript:alert(1)">', "javascript-url"],
    ['<a href="JaVaScRiPt :alert(1)">', "javascript-url"],
    ['<img src="data:image/svg+xml,<svg onload=alert(1)>">', "data-url"],
    ['<img src="https://tracker.example/pixel.gif">', "external-resource"],
    ['<img src="//cdn.example/x.png">', "external-resource"],
    ['<iframe src="/x"></iframe>', "forbidden-element"],
    ['<form action="/x">', "forbidden-element"],
    ['<link rel="stylesheet" href="/x.css">', "forbidden-element"],
    ["<Counter client:load />", "client-directive"],
    ["<div set:html={x} />", "set-html"],
  ])("markup %s", (html, rule) => {
    expect(markup(html)).toContain(rule);
  });

  it.each([
    ['@import "https://evil.example/x.css";', "import"],
    ["@keyframes spin { to { rotate: 1turn } }", "keyframes"],
    [".a { transition: opacity 1s }", "transition"],
    [".a{transition-duration:1s}", "transition"],
    [".a { animation: spin 1s }", "animation"],
    [".a { background: url(https://evil.example/x.png) }", "url"],
    ['.a { background: url("data:image/png;base64,AAAA") }', "url"],
    [".a { width: expression(alert(1)) }", "expression"],
    ['@font-face { font-family: X; src: local("X") }', "font-face"],
  ])("CSS %s", (code, rule) => {
    expect(css(code)).toContain(rule);
  });

  it("ignores comments but never lets them hide code", () => {
    expect(css("/* transition: none */ .a { color: red }")).toEqual([]);
    expect(markup("<!-- <script> --><p>ok</p>")).toEqual([]);
    expect(css("/* */ @import url(x)")).toContain("import");
  });
});
