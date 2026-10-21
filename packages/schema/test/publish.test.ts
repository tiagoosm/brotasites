import { describe, expect, it } from "vitest";
import {
  applyCategory,
  buildFinalConfig,
  isReservedSubdomain,
  publishProblems,
  type SiteDraft,
  setAddress,
  setContact,
  setSectionContent,
  toggleSection,
} from "../src/index.js";

/** A bakery with every answer the default sections need. */
function readyDraft(): SiteDraft {
  let draft = applyCategory({ business: { name: "Padaria do Zé" } }, "Padaria");
  draft = setAddress(draft, { city: "Santa Rita do Sapucaí" });
  draft = setContact(draft, { whatsapp: "5535999990000" });
  draft = setSectionContent(draft, "sobre", { text: "Desde 1998 na mesma esquina." });
  draft = setSectionContent(draft, "servicos", {
    items: [{ name: "Pão francês", description: "" }],
  });
  draft = setSectionContent(draft, "faq", {
    items: [{ question: "Vocês entregam?", answer: "Sim, no centro." }],
  });
  draft = toggleSection(draft, "galeria", false);
  return { ...draft, site: { subdomain: "padaria-do-ze" } };
}

describe("publishing", () => {
  it("builds the final config from a complete draft", () => {
    const result = buildFinalConfig(readyDraft());
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.config.site.subdomain).toBe("padaria-do-ze");
    const hero = result.config.sections.find((s) => s.id === "hero");
    // The example subtitle never reaches a real site.
    expect(hero?.content).not.toHaveProperty("subtitle");
    expect(hero?.content).toMatchObject({ title: "Padaria do Zé" });
  });

  it("never publishes example text for the client's facts", () => {
    let draft = readyDraft();
    draft = setSectionContent(draft, "sobre", { text: "" });
    draft = setSectionContent(draft, "servicos", { items: [{ name: " " }] });
    draft = toggleSection(draft, "galeria", true);
    const steps = publishProblems(draft).map((p) => p.step);
    expect(steps).toEqual(["conteudo", "conteudo", "contato"]);
    expect(buildFinalConfig(draft).ok).toBe(false);
  });

  it("asks for WhatsApp while buttons lead to it", () => {
    let draft = setContact(readyDraft(), { whatsapp: "" });
    expect(publishProblems(draft)).toEqual([
      { step: "contato", message: "Informe o WhatsApp. Os botões do site levam para ele." },
    ]);
    draft = setSectionContent(draft, "hero", { cta: { label: "Ver mapa", action: "scroll" } });
    draft = setSectionContent(draft, "cta-final", { cta: { label: "Ver mapa", action: "scroll" } });
    expect(publishProblems(draft)).toEqual([]);
  });

  it("points to the right question for each problem", () => {
    const problems = publishProblems({});
    expect(problems.map((p) => p.step)).toContain("negocio");
    expect(buildFinalConfig({ ...readyDraft(), site: {} })).toEqual({
      ok: false,
      problems: [{ step: "endereco", message: "Escolha o endereço do site." }],
    });
  });

  it("keeps platform addresses reserved", () => {
    expect(isReservedSubdomain("painel")).toBe(true);
    expect(buildFinalConfig({ ...readyDraft(), site: { subdomain: "www" } }).ok).toBe(false);
    expect(isReservedSubdomain("padaria-do-ze")).toBe(false);
  });
});

describe("reserved addresses in the database", () => {
  it("match the list in the schema", async () => {
    const { readFile } = await import("node:fs/promises");
    const sql = await readFile(
      new URL("../../../supabase/migrations/20261021180000_publication.sql", import.meta.url),
      "utf8",
    );
    const list = sql.match(/p_subdomain = any \(array\[([\s\S]*?)\]\)/)?.[1] ?? "";
    const words = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const { reservedSubdomains } = await import("../src/index.js");
    expect(words).toEqual([...reservedSubdomains]);
  });
});
