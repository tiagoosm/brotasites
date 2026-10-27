import { contrastIssues } from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import {
  applyOverrides,
  approveDirection,
  drawDirections,
  editIdentity,
  effectivePalette,
  LockError,
} from "../src/index.js";
import { businesses, fixtureVariants } from "./fixtures.js";

const direction = drawDirections(
  { ...(businesses[0] as (typeof businesses)[number]), round: 0 },
  fixtureVariants,
).directions[0];
if (!direction) throw new Error("no direction");

const draft = {
  seed: "s",
  round: 0,
  identity: null,
  directionStatus: "draft" as const,
  approvedDirectionId: null,
  lockedFields: [],
  overrides: {},
};

describe("identity lock", () => {
  const approved = approveDirection(draft, direction);

  it("freezes the identity and locks every field", () => {
    expect(approved.directionStatus).toBe("approved");
    expect(approved.approvedDirectionId).toBe("fiel-a-marca");
    expect(approved.identity).toEqual(direction.identity);
    expect(approved.identity).not.toBe(direction.identity);
    expect(approved.lockedFields).toContain("heroVariant");
    expect(approved.lockedFields).toContain("palette");
  });

  it("refuses changes to locked fields", () => {
    expect(() => editIdentity(approved, { heroVariant: "hero-bento" })).toThrow(LockError);
    expect(() => editIdentity(approved, { palette: direction.identity.palette })).toThrow(
      LockError,
    );
  });

  it("accepts colors that keep AA and refuses the rest", () => {
    const darker = applyOverrides(approved, { colors: { primary: "#7C2D12" } });
    expect(effectivePalette(darker)?.primary).toBe("#7C2D12");
    expect(() => applyOverrides(approved, { colors: { textMuted: "#E7E5E4" } })).toThrow(LockError);
  });

  it("repairs colors that break AA when asked", () => {
    const repaired = applyOverrides(
      approved,
      { colors: { textMuted: "#E7E5E4" } },
      { repair: true },
    );
    const palette = effectivePalette(repaired);
    if (!palette) throw new Error("no palette");
    expect(contrastIssues(palette)).toEqual([]);
  });

  it("accepts only font pairs that suit the personality", () => {
    expect(applyOverrides(approved, { fontPair: "young-serif-dm-sans" }).overrides.fontPair).toBe(
      "young-serif-dm-sans",
    );
    expect(() => applyOverrides(approved, { fontPair: "baloo-manrope" })).toThrow(LockError);
  });

  it("allows no overrides before approval", () => {
    expect(() => applyOverrides(draft, { fontPair: "fraunces-manrope" })).toThrow(LockError);
  });
});
