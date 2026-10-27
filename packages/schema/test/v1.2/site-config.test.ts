import { describe, expect, it } from "vitest";
import { parseSiteConfig } from "../../src/v1.2/index.js";
import { example, issuesAfter } from "./helpers.js";

type Sections = ReturnType<typeof example>["sections"];

function sectionOf<Id extends Sections[number]["id"]>(sections: Sections, id: Id) {
  const found = sections.find((item) => item.id === id);
  if (!found) throw new Error(`No ${id} section in the example`);
  return found as Extract<Sections[number], { id: Id }>;
}

describe("site config 1.2", () => {
  it("accepts the example", () => {
    const result = parseSiteConfig(example());
    expect(result.error?.issues).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it("fills the default timezone", () => {
    const config = example();
    delete config.site.timezone;
    expect(parseSiteConfig(config).data?.site.timezone).toBe("America/Sao_Paulo");
  });

  it("refuses unknown fields", () => {
    expect(
      issuesAfter((c) => {
        (c.integrations as Record<string, unknown>).googleMapsEmbed = true;
      }),
    ).toEqual(["integrations"]);
    expect(
      issuesAfter((c) => {
        (c.design as Record<string, unknown>).template = "classico";
      }),
    ).toEqual(["design"]);
  });

  describe("site", () => {
    it.each([
      ["xn--padaria-9za", "punycode"],
      ["padaria--ze", "double hyphen"],
      ["-padaria", "leading hyphen"],
      ["Padaria", "uppercase"],
      ["ab", "too short"],
      ["padaria_do_ze", "underscore"],
      ["admin", "reserved"],
      ["pix-do-ze", "imitation word"],
      ["banco-central", "imitation word"],
      ["receita-federal-ze", "government body"],
    ])("refuses the subdomain %s (%s)", (subdomain) => {
      expect(issuesAfter((c) => (c.site.subdomain = subdomain))).toContain("site.subdomain");
    });

    it("keeps ordinary words that are only reserved alone", () => {
      expect(issuesAfter((c) => (c.site.subdomain = "receita-da-vovo"))).toEqual([]);
      expect(issuesAfter((c) => (c.site.subdomain = "receita"))).toEqual(["site.subdomain"]);
    });

    it("checks the custom domain format", () => {
      expect(issuesAfter((c) => (c.site.customDomain = "padariadoze.com.br"))).toEqual([]);
      for (const domain of ["https://padariadoze.com.br", "padariadoze", "padaria doze.com"]) {
        expect(issuesAfter((c) => (c.site.customDomain = domain))).toEqual(["site.customDomain"]);
      }
    });
  });

  describe("business", () => {
    it("checks the name length", () => {
      expect(issuesAfter((c) => (c.business.name = "Z"))).toEqual(["business.name"]);
      expect(issuesAfter((c) => (c.business.name = "Z".repeat(81)))).toEqual(["business.name"]);
    });

    it("refuses a founded year in the future or before 1900", () => {
      const next = new Date().getFullYear() + 1;
      expect(issuesAfter((c) => (c.business.foundedYear = next))).toEqual(["business.foundedYear"]);
      expect(issuesAfter((c) => (c.business.foundedYear = 1899))).toEqual(["business.foundedYear"]);
    });

    it("refuses an unknown category and a family that does not match", () => {
      expect(issuesAfter((c) => (c.business.category = "cassino"))).toEqual(["business.category"]);
      expect(issuesAfter((c) => (c.business.family = "beauty"))).toEqual(["business.family"]);
    });

    it("accepts any family for the Outro category", () => {
      expect(
        issuesAfter((c) => {
          c.business.category = "outro";
          c.business.family = "retail";
        }),
      ).toEqual([]);
    });

    it("requires the professional registration for regulated health", () => {
      const health = (c: ReturnType<typeof example>) => {
        c.business.category = "dentista";
        c.business.family = "health";
      };
      expect(issuesAfter(health)).toEqual(["business.registration"]);
      expect(
        issuesAfter((c) => {
          health(c);
          c.business.registration = { council: "CRO-MG", number: "12345" };
        }),
      ).toEqual([]);
    });

    it("blocks testimonials for psychology", () => {
      expect(
        issuesAfter((c) => {
          c.business.category = "psicologia";
          c.business.family = "health";
          c.business.registration = { council: "CRP-04", number: "12345" };
          const testimonials = sectionOf(c.sections, "depoimentos");
          testimonials.enabled = true;
          testimonials.content.items = [
            { name: "Ana", text: "Atendimento atencioso.", authorized: true },
          ];
        }),
      ).toEqual(["sections"]);
    });
  });

  describe("contact", () => {
    it("requires at least one channel", () => {
      expect(
        issuesAfter((c) => {
          c.business.contact = {};
          c.integrations.whatsappFloatingButton = false;
          c.navigation.ctaLabel = "Ver serviços";
          for (const item of c.sections) {
            if (item.id === "hero" || item.id === "cta-final") {
              item.content.cta = { label: "Ver serviços", action: "section", section: "servicos" };
            }
          }
        }),
      ).toEqual(["business.contact"]);
    });

    it.each([
      ["35999990000", "no country code"],
      ["1135999990000", "another country"],
      ["+5535999990000", "not digits only"],
      ["55359999900001", "too long"],
    ])("refuses the WhatsApp %s (%s)", (whatsapp) => {
      expect(issuesAfter((c) => (c.business.contact.whatsapp = whatsapp))).toEqual([
        "business.contact.whatsapp",
      ]);
    });

    it("checks the phone and email", () => {
      expect(issuesAfter((c) => (c.business.contact.phone = "(35) 3555-0000"))).toEqual([
        "business.contact.phone",
      ]);
      expect(issuesAfter((c) => (c.business.contact.email = "contato@"))).toEqual([
        "business.contact.email",
      ]);
    });

    it("needs the WhatsApp for the floating button and the matching channel for buttons", () => {
      expect(issuesAfter((c) => delete c.business.contact.whatsapp)).toEqual([
        "sections.0.content.cta.action",
        "sections.6.content.cta.action",
        "integrations.whatsappFloatingButton",
      ]);
    });

    it("checks the Instagram username", () => {
      expect(issuesAfter((c) => (c.business.social.instagram = "@padariadoze"))).toEqual([
        "business.social.instagram",
      ]);
    });
  });

  describe("address", () => {
    it("requires the street with a fixed address", () => {
      expect(issuesAfter((c) => delete c.business.address.street)).toEqual([
        "business.address.street",
      ]);
    });

    it("always requires the city and a valid state", () => {
      expect(issuesAfter((c) => (c.business.address.city = ""))).toEqual(["business.address.city"]);
      expect(issuesAfter((c) => (c.business.address.state = "XX" as "MG"))).toEqual([
        "business.address.state",
      ]);
    });

    it("requires a service area without a fixed address", () => {
      const noAddress = (c: ReturnType<typeof example>) => {
        c.business.address = { hasFixedAddress: false, city: "Santa Rita do Sapucaí", state: "MG" };
        sectionOf(c.sections, "contato").content.showMapLink = false;
      };
      expect(issuesAfter(noAddress)).toEqual(["business.serviceArea"]);
      expect(
        issuesAfter((c) => {
          noAddress(c);
          c.business.serviceArea = ["Centro", "Fernandes"];
        }),
      ).toEqual([]);
    });

    it("needs a fixed address for the Como chegar button", () => {
      expect(
        issuesAfter((c) => {
          c.business.address = {
            hasFixedAddress: false,
            city: "Santa Rita do Sapucaí",
            state: "MG",
          };
          c.business.serviceArea = ["Centro"];
        }),
      ).toEqual(["sections.7.content.showMapLink"]);
    });
  });

  describe("sections", () => {
    it("refuses testimonials enabled with no item", () => {
      expect(issuesAfter((c) => (sectionOf(c.sections, "depoimentos").enabled = true))).toEqual([
        "sections.4.content.items",
      ]);
    });

    it("refuses a testimonial that is not authorized", () => {
      expect(
        issuesAfter((c) => {
          const testimonials = sectionOf(c.sections, "depoimentos");
          testimonials.enabled = true;
          testimonials.content.items = [
            { name: "Ana", text: "O melhor pão da cidade.", authorized: false as true },
          ];
        }),
      ).toEqual(["sections.4.content.items.0.authorized"]);
    });

    it("applies minimums only to enabled sections", () => {
      const steps = [{ title: "Peça", text: "Chame no WhatsApp." }];
      const howItWorks = (enabled: boolean) => (c: ReturnType<typeof example>) => {
        c.sections.push({
          id: "como-funciona",
          enabled,
          content: { title: "Como funciona", steps },
        });
      };
      expect(issuesAfter(howItWorks(false))).toEqual([]);
      expect(issuesAfter(howItWorks(true))).toEqual(["sections.8.content.steps"]);
    });

    it("limits highlights to 3 to 8 items from the icon set", () => {
      const item = { title: "Fermentação natural", icon: "bread" as const };
      const highlights = (count: number) => (c: ReturnType<typeof example>) => {
        c.sections.push({
          id: "diferenciais",
          enabled: true,
          content: { title: "Por que a gente", items: Array.from({ length: count }, () => item) },
        });
      };
      expect(issuesAfter(highlights(2))).toEqual(["sections.8.content.items"]);
      expect(issuesAfter(highlights(3))).toEqual([]);
      expect(issuesAfter(highlights(9))).toEqual(["sections.8.content.items"]);
      expect(
        issuesAfter((c) => {
          highlights(3)(c);
          const last = c.sections[8];
          if (last?.id === "diferenciais")
            last.content.items[0] = { title: "x", icon: "rocket" as "bread" };
        }),
      ).toEqual(["sections.8.content.items.0.icon"]);
    });

    it("refuses repeated sections and a page that does not start with the hero", () => {
      expect(
        issuesAfter((c) => {
          c.sections.push({ ...sectionOf(c.sections, "faq") });
        }),
      ).toEqual(["sections"]);
      expect(issuesAfter((c) => c.sections.reverse())).toContain("sections.0");
    });

    it("refuses the removed contact form and any URL in buttons", () => {
      expect(
        issuesAfter((c) => {
          (sectionOf(c.sections, "contato").content as Record<string, unknown>).showForm = true;
        }),
      ).toEqual(["sections.7.content"]);
      expect(
        issuesAfter((c) => {
          const hero = sectionOf(c.sections, "hero");
          (hero.content.cta as Record<string, unknown>).target = "https://example.com";
        }),
      ).toEqual(["sections.0.content.cta"]);
    });

    it("needs a target for buttons that scroll to a section", () => {
      expect(
        issuesAfter((c) => {
          sectionOf(c.sections, "hero").content.cta = { label: "Ver", action: "section" };
        }),
      ).toEqual(["sections.0.content.cta.section"]);
    });
  });

  describe("brand", () => {
    it.each([["#FFF"], ["B45309"], ["#B4530G"], ["rgb(180, 83, 9)"]])(
      "refuses the color %s",
      (color) => {
        expect(issuesAfter((c) => (c.brand.brandColors = [color]))).toEqual([
          "brand.brandColors.0",
        ]);
      },
    );

    it("allows up to 3 colors and 2 distinct feelings", () => {
      expect(
        issuesAfter((c) => (c.brand.brandColors = ["#000000", "#111111", "#222222", "#333333"])),
      ).toEqual(["brand.brandColors"]);
      expect(issuesAfter((c) => (c.brand.feelings = ["acolhedor", "moderno", "ousado"]))).toEqual([
        "brand.feelings",
      ]);
      expect(issuesAfter((c) => (c.brand.feelings = ["moderno", "moderno"]))).toEqual([
        "brand.feelings",
      ]);
    });
  });

  describe("design", () => {
    it("requires AA contrast in the palette", () => {
      expect(
        issuesAfter((c) => {
          if (c.design.identity) c.design.identity.palette.textMuted = "#D6D3D1";
        }),
      ).toEqual(["design.identity.palette.textMuted"]);
    });

    it("accepts color overrides only with AA contrast", () => {
      expect(issuesAfter((c) => (c.design.overrides.colors = { primary: "#9A3412" }))).toEqual([]);
      expect(issuesAfter((c) => (c.design.overrides.colors = { primary: "#FDBA74" }))).toEqual([
        "design.overrides.colors",
      ]);
    });

    it("locks the identity on approval", () => {
      expect(issuesAfter((c) => (c.design.lockedFields = ["personality"]))).toEqual([
        "design.lockedFields",
      ]);
      expect(issuesAfter((c) => (c.design.identity = null))).toEqual([
        "design.approvedDirectionId",
      ]);
    });

    it("accepts a draft with no identity yet", () => {
      expect(
        issuesAfter((c) => {
          c.design.identity = null;
          c.design.directionStatus = "draft";
          c.design.approvedDirectionId = null;
          c.design.lockedFields = [];
        }),
      ).toEqual([]);
    });

    it("refuses a catalog id that is not an id", () => {
      expect(
        issuesAfter((c) => {
          if (c.design.identity) c.design.identity.heroVariant = "https://example.com/hero";
        }),
      ).toEqual(["design.identity.heroVariant"]);
    });
  });

  describe("seo, navigation and ai", () => {
    it("checks the lengths", () => {
      expect(issuesAfter((c) => (c.seo.title = "x".repeat(71)))).toEqual(["seo.title"]);
      expect(issuesAfter((c) => (c.seo.description = "x".repeat(161)))).toEqual([
        "seo.description",
      ]);
      expect(issuesAfter((c) => (c.navigation.ctaLabel = "x".repeat(31)))).toEqual([
        "navigation.ctaLabel",
      ]);
    });

    it("only accepts field paths in the AI lists", () => {
      expect(issuesAfter((c) => (c.ai.userEditedFields = ["business.tagline"]))).toEqual([]);
      expect(issuesAfter((c) => (c.ai.userEditedFields = ["<script>"]))).toEqual([
        "ai.userEditedFields.0",
      ]);
    });
  });
});

describe("photos of minors", () => {
  it("need the guardians' authorization", () => {
    expect(
      issuesAfter((c) => {
        const hero = c.sections.find((s) => s.id === "hero");
        if (hero?.id === "hero" && hero.content.image) hero.content.image.showsMinor = true;
      }),
    ).toEqual(["sections.0.content.image.minorConsent"]);
    expect(
      issuesAfter((c) => {
        const hero = c.sections.find((s) => s.id === "hero");
        if (hero?.id === "hero" && hero.content.image) {
          hero.content.image.showsMinor = true;
          hero.content.image.minorConsent = true;
        }
      }),
    ).toEqual([]);
  });
});
