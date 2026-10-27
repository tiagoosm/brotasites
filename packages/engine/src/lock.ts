import { compatibleFontPairs, enforceContrast } from "@brotasites/catalog";
import {
  contrastIssues,
  type Identity,
  identityFields,
  type Palette,
  type SiteConfig,
} from "@brotasites/schema/v1.2";
import type { Direction } from "./directions.js";

// Freezing and locking. Approving a direction copies its identity into the site and locks every
// identity field; afterwards only the client's overrides change the look: colors that keep AA
// and font pairs that suit the personality. Messages are user-facing (pt-BR).

type Design = SiteConfig["design"];

export class LockError extends Error {}

/** The site's design after the client approves a direction: identity frozen, all locked. */
export function approveDirection(design: Design, direction: Direction): Design {
  return {
    ...design,
    identity: structuredClone(direction.identity),
    directionStatus: "approved",
    approvedDirectionId: direction.id,
    lockedFields: [...identityFields],
    overrides: {},
  };
}

/** Changes to the identity itself: refused for every locked field. */
export function editIdentity(design: Design, patch: Partial<Identity>): Design {
  if (!design.identity) throw new LockError("Escolha uma direção antes de mudar a identidade.");
  const locked = Object.keys(patch).filter((field) =>
    (design.lockedFields as string[]).includes(field),
  );
  if (locked.length > 0) {
    throw new LockError("A identidade visual já foi aprovada e não pode mudar.");
  }
  return { ...design, identity: { ...design.identity, ...patch } };
}

/**
 * The client's adjustments after approval. Colors are kept only when the palette still passes
 * AA; with `repair`, colors that break it are pulled to the nearest passing ones instead.
 */
export function applyOverrides(
  design: Design,
  overrides: { colors?: Partial<Palette>; fontPair?: string },
  options: { repair?: boolean } = {},
): Design {
  const identity = design.identity;
  if (!identity || design.directionStatus !== "approved") {
    throw new LockError("Os ajustes só valem depois de aprovar uma direção.");
  }
  const next = { ...design.overrides };
  if (overrides.fontPair !== undefined) {
    const allowed = compatibleFontPairs(identity.personality).map((pair) => pair.id);
    if (!allowed.includes(overrides.fontPair)) {
      throw new LockError("Esse par de fontes não combina com a identidade aprovada.");
    }
    next.fontPair = overrides.fontPair;
  }
  if (overrides.colors) {
    const merged = { ...identity.palette, ...next.colors, ...overrides.colors };
    if (contrastIssues(merged).length > 0) {
      if (!options.repair) {
        throw new LockError(
          "Essas cores deixam o texto difícil de ler. Escolha cores com mais contraste.",
        );
      }
      const repaired = enforceContrast(merged);
      next.colors = Object.fromEntries(
        Object.entries(repaired).filter(
          ([role, hex]) => identity.palette[role as keyof Palette] !== hex,
        ),
      );
    } else {
      next.colors = { ...next.colors, ...overrides.colors };
    }
  }
  return { ...design, overrides: next };
}

/** The palette the site is built with: the identity's, with the client's colors on top. */
export function effectivePalette(design: Design): Palette | null {
  if (!design.identity) return null;
  return { ...design.identity.palette, ...design.overrides.colors };
}
