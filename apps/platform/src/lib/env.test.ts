import { describe, expect, it } from "vitest";
import { safeNextPath } from "./supabase/env";

describe("safeNextPath", () => {
  it("keeps paths inside the platform", () => {
    expect(safeNextPath("/criar/123/marca")).toBe("/criar/123/marca");
    for (const value of ["https://exemplo.com", "//exemplo.com", "/\\exemplo.com", null, ""]) {
      expect(safeNextPath(value)).toBe("/criar");
    }
  });
});
