import type { Divider, SectionTone } from "@brotasites/catalog";
import type { WeekSchedule } from "@brotasites/schema/hours";
import type { Section, SiteConfig } from "@brotasites/schema/v1.2";
import type { Theme } from "../lib/theme";

// Props every section variant receives. Variants are HTML and CSS only: motion comes from
// data-anim attributes, never from their own scripts, keyframes or transitions.

export interface VariantProps<Id extends Section["id"] = Section["id"]> {
  config: SiteConfig;
  theme: Theme;
  content: Extract<Section, { id: Id }>["content"];
  tone: SectionTone;
  previousTone: SectionTone;
  divider: Divider;
  /** Position among the sections, to vary ornaments. */
  index: number;
  week?: WeekSchedule | null;
}
