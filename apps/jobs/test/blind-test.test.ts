import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AiDirector, SimulatedModelClient } from "@brotasites/ai";
import { SimulatedReviewerAgent } from "@brotasites/reviewer";
import {
  brandAnswersSchema,
  businessAnswersSchema,
  contactAnswersSchema,
  contentAnswersSchema,
} from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import { anonymizeHtml, assembleKit } from "../src/blind-test/assemble.js";
import { briefOf, draftOf, KIT_BUSINESSES, kitBusinesses } from "../src/blind-test/businesses.js";
import { generateSites, isFinished, kitBase } from "../src/blind-test/generate.js";
import { binomialTail, parseAnswers, scoreAnswers } from "../src/blind-test/score.js";

describe("blind test businesses", () => {
  it("turns each of the 10 businesses into answers every form step accepts", () => {
    const businesses = kitBusinesses();
    expect(businesses).toHaveLength(10);
    expect(new Set(businesses.map((b) => b.facts.family))).toEqual(
      new Set(["food", "beauty", "events-creative"]),
    );
    for (const { facts } of businesses) {
      const draft = draftOf(facts);
      expect(businessAnswersSchema.safeParse(draft.business).success).toBe(true);
      expect(brandAnswersSchema.safeParse(draft.brand).success).toBe(true);
      expect(contentAnswersSchema.safeParse(draft.content).success).toBe(true);
      expect(contactAnswersSchema.safeParse(draft.contact).success).toBe(true);
    }
  });

  it("gives the designer the same facts and the shared rules", () => {
    const [padaria] = kitBusinesses(["Padaria do Zé"]);
    if (!padaria) throw new Error("missing");
    const brief = briefOf(padaria);
    expect(brief).toContain("# Padaria do Zé");
    expect(brief).toContain("Rua das Flores, 123, Centro");
    expect(brief).toContain("(35) 99999-0000");
    expect(brief).toContain("segunda, terça, quarta, quinta, sexta: 06:00 às 19:00");
    expect(brief).toContain("Não invente depoimentos");
    expect(brief).toContain("Sem fotos");
  });
});

describe("anonymizing", () => {
  it("removes what tells who made the page and keeps it from search engines", () => {
    const html = anonymizeHtml(
      `<html><head><meta name="generator" content="Astro v7"><link rel="canonical" href="https://x.sites.localhost/"><!-- built --></head><body><h1 data-astro-cid-abc>Oi</h1><script type="application/ld+json">{"@type":"Bakery","url":"https://x.sites.localhost","name":"X"}</script></body></html>`,
    );
    expect(html).not.toMatch(/generator|canonical|built|astro|sites\.localhost/i);
    expect(html).toContain("<h1 data-s-cid-abc>");
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(JSON.parse(html.match(/<script[^>]*>(.*?)<\/script>/)?.[1] ?? "")).toEqual({
      "@type": "Bakery",
      name: "X",
    });
  });
});

function fakeKit() {
  const kitDir = mkdtempSync(join(tmpdir(), "brotasites-kit-"));
  const names: Record<string, string> = {};
  for (const business of kitBusinesses().slice(0, 3)) {
    names[business.slug] = business.facts.name;
    const generated = join(kitDir, "generated", business.slug);
    mkdirSync(join(generated, "_astro"), { recursive: true });
    const base = kitBase(business.slug);
    writeFileSync(
      join(generated, "index.html"),
      `<html><head><meta name="generator" content="Astro"><link rel="stylesheet" href="${base}_astro/Page.astro_astro_type_script.css"></head><body><a href="${base}#contato">Contato</a></body></html>`,
    );
    writeFileSync(
      join(generated, "_astro", "Page.astro_astro_type_script.css"),
      `@font-face{src:url(${base}fonts/a.woff2)}[data-astro-cid-x]{color:red}`,
    );
    const hand = join(kitDir, "hand", business.slug);
    mkdirSync(hand, { recursive: true });
    writeFileSync(
      join(hand, "index.html"),
      "<html><head></head><body><h1>Feito à mão</h1></body></html>",
    );
  }
  return { kitDir, names };
}

describe("assembling the kit", () => {
  it("numbers the sites at random, hides their origin and keeps the key apart", async () => {
    const { kitDir, names } = fakeKit();
    const { key, missing, warnings } = await assembleKit({ kitDir, seed: "teste", names });
    expect(missing).toEqual([]);
    expect(warnings).toEqual([]);
    expect(key.pairs).toHaveLength(3);
    const sites = key.pairs.flatMap((pair) => [pair.a.site, pair.b.site]).sort();
    expect(sites).toEqual(["01", "02", "03", "04", "05", "06"]);
    for (const pair of key.pairs) {
      expect(new Set([pair.a.origin, pair.b.origin])).toEqual(new Set(["brotasites", "hand"]));
    }

    const participants = join(kitDir, "participantes");
    expect(readdirSync(participants).sort()).toEqual([
      "ficha.html",
      "index.html",
      "par-01.html",
      "par-02.html",
      "par-03.html",
      "sites",
    ]);
    const generated = key.pairs[0]?.a.origin === "brotasites" ? key.pairs[0].a : key.pairs[0]?.b;
    const siteDir = join(participants, "sites", generated?.site ?? "");
    const html = readFileSync(join(siteDir, "index.html"), "utf8");
    expect(html).toContain('href="./arquivos/Page-type_script.css"');
    expect(html).toContain('href="./#contato"');
    const css = readFileSync(join(siteDir, "arquivos", "Page-type_script.css"), "utf8");
    expect(css).toBe("@font-face{src:url(../fonts/a.woff2)}[data-s-cid-x]{color:red}");
    for (const page of readdirSync(participants).filter((file) => file.endsWith(".html"))) {
      expect(readFileSync(join(participants, page), "utf8")).not.toMatch(/brota|astro/i);
    }
    expect(JSON.parse(readFileSync(join(kitDir, "chave", "chave.json"), "utf8"))).toEqual(key);

    // The same seed draws the same kit.
    const again = await assembleKit({ kitDir, seed: "teste", names });
    expect(again.key).toEqual(key);
  });

  it("lists the hand-made sites still missing and warns about absolute paths", async () => {
    const { kitDir, names } = fakeKit();
    const [first] = Object.keys(names);
    writeFileSync(
      join(kitDir, "hand", first ?? "", "index.html"),
      '<html><head></head><body><img src="/foto.jpg" alt=""></body></html>',
    );
    names["sem-par"] = "Sem par";
    const result = await assembleKit({ kitDir, seed: "x", names });
    expect(result.missing).toEqual(["generated/sem-par/index.html", "hand/sem-par/index.html"]);
    expect(result.key.pairs).toHaveLength(3);
    expect(result.warnings).toEqual([expect.stringContaining('caminho começando com "/"')]);
  });
});

describe("scoring", () => {
  it("computes the one-sided binomial tail", () => {
    expect(binomialTail(0, 10)).toBe(1);
    expect(binomialTail(10, 10)).toBeCloseTo(1 / 1024, 10);
    expect(binomialTail(8, 10)).toBeCloseTo(56 / 1024, 10);
    expect(binomialTail(11, 10)).toBe(0);
  });

  it("reads the spreadsheet and reports bad rows in Portuguese", () => {
    const { answers, errors } = parseAnswers(
      "participante;perfil;par;ia;prefere\nAna;designer;1;a;B\nBia;cliente;1;A;B\nCaio;negocio;2;C;A\n\n",
    );
    expect(answers).toEqual([
      { participant: "Ana", profile: "designer", pair: 1, ai: "A", prefers: "B" },
    ]);
    expect(errors).toEqual([
      "Linha 3: perfil deve ser negocio, designer ou outro.",
      "Linha 4: ia e prefere devem ser A ou B.",
    ]);
  });

  it("meets the target when people guess at chance and prefer the generated sites", () => {
    const key = {
      version: 1 as const,
      seed: "s",
      pairs: [1, 2].map((pair) => ({
        pair,
        slug: `n${pair}`,
        name: `Negócio ${pair}`,
        a: { site: `0${pair}`, origin: "brotasites" as const },
        b: { site: `1${pair}`, origin: "hand" as const },
      })),
    };
    const answers = ["p1", "p2", "p3", "p4"].flatMap((participant, index) =>
      [1, 2].map((pair) => ({
        participant,
        profile: "negocio" as const,
        pair,
        ai: (index % 2 === 0 ? "A" : "B") as "A" | "B",
        prefers: (index < 3 ? "A" : "B") as "A" | "B",
      })),
    );
    const score = scoreAnswers(key, answers);
    expect(score.participants).toBe(4);
    expect(score.overall.accuracy).toBe(0.5);
    expect(score.overall.preferenceShare).toBe(0.75);
    expect(score.pairsWon).toBe(2);
    expect(score.passed).toBe(true);

    const spotted = answers.map((answer) => ({ ...answer, ai: "A" as const }));
    const caught = scoreAnswers(key, [...spotted, ...spotted]);
    expect(caught.overall.accuracy).toBe(1);
    expect(caught.atChance).toBe(false);
    expect(caught.passed).toBe(false);
  });
});

describe("generating the BrotaSites half", { timeout: 240_000 }, () => {
  it("runs a business through the real pipeline into the kit folder", async () => {
    const out = mkdtempSync(join(tmpdir(), "brotasites-kit-gen-"));
    const sites = await generateSites({
      out,
      businesses: kitBusinesses([KIT_BUSINESSES[0]]),
      deps: (store) => ({
        ai: new AiDirector({
          model: new SimulatedModelClient(),
          registry: store.registry,
          cache: store.cache,
        }),
        agent: new SimulatedReviewerAgent(),
        screenshot: async () => [],
        browserChecks: async () => ({ findings: [], screenshots: [] }),
      }),
    });
    expect(sites).toEqual([
      expect.objectContaining({
        slug: "padaria-do-ze",
        direction: "fiel-a-marca",
        modelId: "simulated",
        findings: [],
      }),
    ]);
    expect(sites.every(isFinished)).toBe(true);
    const html = readFileSync(join(out, "generated", "padaria-do-ze", "index.html"), "utf8");
    expect(html).toContain("Padaria do Zé");
    expect(html).toContain(kitBase("padaria-do-ze"));
    expect(readFileSync(join(out, "briefs", "padaria-do-ze.md"), "utf8")).toContain(
      "# Padaria do Zé",
    );
  });
});
