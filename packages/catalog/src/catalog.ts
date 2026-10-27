import { dividers } from "./dividers.js";
import { fontPairs } from "./fonts.js";
import { markStyles } from "./marks.js";
import { motionPresets } from "./motion.js";
import { ornamentSets } from "./ornaments.js";
import { patterns } from "./patterns.js";
import { rhythms } from "./rhythm.js";
import { typeScales } from "./scale.js";
import { shapes } from "./shapes.js";
import { imageTreatments } from "./treatments.js";

// Every id the catalog knows, per identity field of schema 1.2, so the engine and the API can
// check a stored identity. Hero and section variants join in E6.

export const catalogIds = {
  fontPair: fontPairs.map((item) => item.id),
  scale: typeScales.map((item) => item.id),
  shape: shapes.map((item) => item.id),
  ornamentSet: ornamentSets.map((item) => item.id),
  pattern: patterns.map((item) => item.id),
  imageTreatment: imageTreatments.map((item) => item.id),
  dividerStyle: dividers.map((item) => item.id),
  markStyle: [...markStyles],
  rhythm: rhythms.map((item) => item.id),
  motionPreset: motionPresets.map((item) => item.id),
} satisfies Record<string, string[]>;

export type CatalogField = keyof typeof catalogIds;

export function isCatalogId(field: CatalogField, id: string): boolean {
  return (catalogIds[field] as string[]).includes(id);
}
