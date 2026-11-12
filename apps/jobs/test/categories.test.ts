import { AiDirector, playbookFor, SimulatedModelClient } from "@brotasites/ai";
import {
  categories,
  categoryNotOpen,
  type FormDraft,
  familyInfo,
  formToSiteConfig,
  sectionIds,
  siteConfigSchema,
} from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import { MemoryStore, needsHumanReview } from "../src/index.js";

// E38: every launch wave is open. Each category must work end to end in simulated mode: a
// playbook, the family's sections, three directions, a valid config and the AI's copy. The
// rules of regulated categories stay on.

function draftFor(category: (typeof categories)[number]): FormDraft {
  return {
    business: {
      name: `Negócio de ${category.label}`,
      category: category.id,
      city: "Santa Rita do Sapucaí",
      state: "MG",
      description: `Atendemos com cuidado na cidade, em ${category.label.toLowerCase()}, desde 2010.`,
    },
    brand: { logoAsset: null, brandColors: ["#2F5D45"], feelings: ["acolhedor"] },
    content: {
      services: [{ name: "Atendimento", description: "Com hora marcada." }],
      testimonials: [{ name: "Ana", text: "Fui muito bem atendida.", authorized: true }],
    },
    contact: {
      whatsapp: "5535999990000",
      hasFixedAddress: false,
      serviceArea: ["Centro"],
      openingHours: { mode: "byAppointment", rules: [] },
      ...(familyInfo[category.family].requiresRegistration
        ? { registration: { council: "CRP", number: "06/123456" } }
        : {}),
    },
  };
}

describe("every category works end to end (E38)", { timeout: 240_000 }, () => {
  const store = new MemoryStore();
  const ai = new AiDirector({
    model: new SimulatedModelClient(),
    registry: store.registry,
    cache: store.cache,
  });

  for (const category of categories) {
    it(`${category.id} (${category.family}, wave ${category.wave}, ${category.review})`, async () => {
      expect(categoryNotOpen(category.id)).toBeNull();
      const family = familyInfo[category.family];
      expect(family.defaultSections.length).toBeGreaterThan(0);
      for (const id of family.defaultSections) expect(sectionIds).toContain(id);
      expect(playbookFor(category.family).text.length).toBeGreaterThan(100);

      const draft = draftFor(category);
      const result = await ai.generateDirections({
        siteId: `site-${category.id}`,
        input: {
          name: draft.business?.name ?? "",
          city: "Santa Rita do Sapucaí",
          category: category.id,
          family: category.family,
          feelings: ["acolhedor"],
          brandColors: ["#2F5D45"],
          hasLogo: false,
          photos: "none",
          round: 0,
        },
        weights: await store.catalogWeights(),
      });
      expect(result.directions).toHaveLength(3);

      const direction = result.directions[0];
      if (!direction) throw new Error("no direction");
      const parsed = siteConfigSchema.safeParse(
        formToSiteConfig(draft, {
          identity: direction.identity,
          availableAssets: new Set(),
          round: 0,
          seed: result.seed,
        }),
      );
      if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues.slice(0, 3)));
      const config = parsed.data;

      // Regulated health: the registration goes to the site (its footer).
      if (family.requiresRegistration) expect(config.business.registration).toBeDefined();
      // Psychology: never testimonials, even when the client wrote some.
      const testimonials = config.sections.find((section) => section.id === "depoimentos");
      if (category.id === "psicologia") expect(testimonials?.enabled ?? false).toBe(false);

      const copy = await ai.writeCopy(config, { siteId: `site-${category.id}`, accountId: "a" });
      expect(siteConfigSchema.safeParse(copy.config).success).toBe(true);

      // Reinforced and mandatory review always wait for a person, even with REVIEW_SKIP_HUMAN.
      expect(needsHumanReview(category.id, true)).toBe(category.review !== "standard");
      expect(needsHumanReview(category.id, false)).toBe(true);
    });
  }

  it("keeps 'outro' and unknown categories with a person", () => {
    expect(needsHumanReview("outro", true)).toBe(true);
    expect(needsHumanReview(undefined, true)).toBe(true);
  });
});
