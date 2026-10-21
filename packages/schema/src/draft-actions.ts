import { findPalette } from "./categories.js";
import { sectionInfo } from "./design-options.js";
import { type DraftSection, defaultSections, type SiteDraft } from "./draft.js";
import type { OpeningHoursRow } from "./hours.js";
import type { SectionId } from "./sections.js";
import type { SiteConfig, Template } from "./site-config.js";

// Pure updates the form applies to the draft. Anything the client picks by hand marks the
// draft as customized, so changing the business type later does not undo it.

type Colors = SiteConfig["design"]["colors"];
type Style = NonNullable<SiteConfig["design"]["style"]>;

function withDesign(draft: SiteDraft, design: NonNullable<SiteDraft["design"]>): SiteDraft {
  return {
    ...draft,
    design: { ...draft.design, ...design },
    customized: { ...draft.customized, design: true },
  };
}

export function setTemplate(draft: SiteDraft, template: Template): SiteDraft {
  return withDesign(draft, { template });
}

export function setPalette(draft: SiteDraft, paletteId: string): SiteDraft {
  const palette = findPalette(paletteId);
  if (!palette) return draft;
  return withDesign(draft, {
    paletteId,
    colors: {
      primary: palette.primary,
      secondary: palette.secondary,
      background: palette.background,
      text: palette.text,
    },
  });
}

/** Custom colors: the draft no longer follows a ready-made palette. */
export function setColor(draft: SiteDraft, key: keyof Colors, value: string): SiteDraft {
  return withDesign(draft, {
    paletteId: undefined,
    colors: { ...draft.design?.colors, [key]: value },
  });
}

export function setFonts(draft: SiteDraft, heading: string, body: string): SiteDraft {
  return withDesign(draft, { fonts: { heading, body } } as NonNullable<SiteDraft["design"]>);
}

export function setStyle<K extends keyof Style>(
  draft: SiteDraft,
  key: K,
  value: Style[K],
): SiteDraft {
  return withDesign(draft, { style: { ...draft.design?.style, [key]: value } });
}

/** The draft's section list, falling back to the defaults for its business type. */
export function draftSections(draft: SiteDraft): DraftSection[] {
  return draft.sections?.length ? draft.sections : defaultSections(draft.business?.category);
}

const lockedIds = new Set(sectionInfo.filter((s) => s.locked).map((s) => s.id));

function withSections(draft: SiteDraft, sections: DraftSection[]): SiteDraft {
  return { ...draft, sections, customized: { ...draft.customized, sections: true } };
}

/** Turns a section on or off. Locked sections (the top) always stay on. */
export function toggleSection(draft: SiteDraft, id: SectionId, enabled: boolean): SiteDraft {
  if (lockedIds.has(id)) return draft;
  return withSections(
    draft,
    draftSections(draft).map((section) => (section.id === id ? { ...section, enabled } : section)),
  );
}

/** Moves a section up (-1) or down (+1). Locked sections stay first and nothing passes them. */
export function moveSection(draft: SiteDraft, id: SectionId, delta: -1 | 1): SiteDraft {
  const sections = [...draftSections(draft)];
  const from = sections.findIndex((section) => section.id === id);
  const to = from + delta;
  const target = sections[to];
  if (from < 0 || !target || lockedIds.has(id) || lockedIds.has(target.id)) return draft;
  const moving = sections[from] as DraftSection;
  sections[from] = target;
  sections[to] = moving;
  return withSections(draft, sections);
}

/** Merges answers into a section's content (e.g. its title or list of items). */
export function setSectionContent(
  draft: SiteDraft,
  id: SectionId,
  patch: Record<string, unknown>,
): SiteDraft {
  return {
    ...draft,
    sections: draftSections(draft).map((section) =>
      section.id === id ? { ...section, content: { ...section.content, ...patch } } : section,
    ),
  };
}

type Business = NonNullable<SiteDraft["business"]>;
type Contact = NonNullable<Business["contact"]>;

/** Phone, WhatsApp and e-mail. */
export function setContact(
  draft: SiteDraft,
  patch: Partial<Pick<Contact, "phone" | "whatsapp" | "email">>,
): SiteDraft {
  return {
    ...draft,
    business: { ...draft.business, contact: { ...draft.business?.contact, ...patch } },
  };
}

export function setAddress(draft: SiteDraft, patch: NonNullable<Contact["address"]>): SiteDraft {
  const contact = draft.business?.contact;
  return {
    ...draft,
    business: {
      ...draft.business,
      contact: { ...contact, address: { ...contact?.address, ...patch } },
    },
  };
}

export function setOpeningHours(draft: SiteDraft, rows: OpeningHoursRow[]): SiteDraft {
  return {
    ...draft,
    business: {
      ...draft.business,
      contact: { ...draft.business?.contact, openingHours: rows },
    },
  };
}

export function setSocial(draft: SiteDraft, patch: NonNullable<Business["social"]>): SiteDraft {
  return {
    ...draft,
    business: { ...draft.business, social: { ...draft.business?.social, ...patch } },
  };
}

export interface Testimonial {
  name: string;
  role?: string;
  text: string;
}

/**
 * Saves the testimonials. The section turns on with the first real one and off when none is
 * left, since it may only show testimonials the client actually provided.
 */
export function setTestimonials(draft: SiteDraft, items: Testimonial[]): SiteDraft {
  const hasReal = items.some((item) => item.name.trim() && item.text.trim());
  const next = setSectionContent(draft, "depoimentos", { items });
  return {
    ...next,
    sections: draftSections(next).map((section) =>
      section.id === "depoimentos" ? { ...section, enabled: hasReal } : section,
    ),
  };
}
