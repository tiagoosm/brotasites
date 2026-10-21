import { describe, expect, it } from "vitest";
import {
  answeredContent,
  applyCategory,
  buildPreviewConfig,
  draftSections,
  PLACEHOLDER_NAME,
  setSectionContent,
  setTestimonials,
} from "../src/index.js";

const bakery = () => applyCategory({ business: { name: "Padaria do Zé" } }, "Padaria");
const section = (config: ReturnType<typeof buildPreviewConfig>, id: string) =>
  config.sections.find((s) => s.id === id);

describe("answeredContent", () => {
  it("drops blank answers so placeholders stay visible", () => {
    expect(answeredContent("sobre", { title: "  ", text: "Desde 1998." })).toEqual({
      text: "Desde 1998.",
    });
    expect(answeredContent("servicos", { items: [{ name: "" }, { name: "Pães" }] })).toEqual({
      items: [{ name: "Pães" }],
    });
    expect(answeredContent("servicos", { items: [{ name: " " }] })).toEqual({});
    expect(answeredContent("depoimentos", { items: [] })).toEqual({ items: [] });
    expect(answeredContent("hero", { cta: { label: "", action: "whatsapp" } })).toEqual({
      cta: { action: "whatsapp" },
    });
  });
});

describe("section content", () => {
  it("shows what the client typed and keeps placeholders elsewhere", () => {
    const draft = setSectionContent(bakery(), "sobre", { title: "Nossa história", text: "" });
    const about = section(buildPreviewConfig(draft), "sobre");
    expect(about?.content).toMatchObject({ title: "Nossa história" });
    expect((about?.content as { text?: string } | undefined)?.text).toMatch(/^Conte como/);
  });

  it("uses the client's services instead of the placeholders", () => {
    const draft = setSectionContent(bakery(), "servicos", {
      items: [{ name: "Pão de fermentação natural", description: "Todo dia às 6h." }],
    });
    expect(section(buildPreviewConfig(draft), "servicos")?.content).toMatchObject({
      items: [{ name: "Pão de fermentação natural", description: "Todo dia às 6h." }],
    });
  });

  it("the hero title follows the business name until the client writes one", () => {
    expect(section(buildPreviewConfig({}), "hero")?.content).toMatchObject({
      title: PLACEHOLDER_NAME,
    });
    const draft = setSectionContent(bakery(), "hero", { title: "Pão quentinho todo dia" });
    expect(section(buildPreviewConfig(draft), "hero")?.content).toMatchObject({
      title: "Pão quentinho todo dia",
    });
  });
});

describe("testimonials", () => {
  it("turn the section on with the first real one and off with none", () => {
    let draft = setTestimonials(bakery(), [{ name: "Maria", text: "Melhor pão da cidade." }]);
    expect(draftSections(draft).find((s) => s.id === "depoimentos")?.enabled).toBe(true);
    expect(section(buildPreviewConfig(draft), "depoimentos")?.enabled).toBe(true);
    draft = setTestimonials(draft, [{ name: "", text: "" }]);
    expect(draftSections(draft).find((s) => s.id === "depoimentos")?.enabled).toBe(false);
  });
});
