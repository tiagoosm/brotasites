import { describe, expect, it } from "vitest";
import { safeNextPath } from "./supabase/env";

describe("safeNextPath", () => {
  it("keeps paths inside the platform", () => {
    expect(safeNextPath("/criar/123/marca")).toBe("/criar/123/marca");
    expect(safeNextPath("/painel?senha=alterada")).toBe("/painel?senha=alterada");
    expect(safeNextPath("/criar")).toBe("/criar");
    expect(safeNextPath("/conta#excluir")).toBe("/conta#excluir");
  });

  it("refuses every way out to another site (open redirect)", () => {
    for (const value of [
      "https://evil.com",
      "http://evil.com/criar",
      "//evil.com",
      "///evil.com",
      "/\\evil.com",
      "/\\/evil.com",
      "\\\\evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "/ /evil.com",
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,oi",
      "evil.com",
      `/${"a".repeat(400)}`,
      null,
      undefined,
      "",
    ]) {
      // The dashboard is where signing in leads when no safe page was asked for (E16).
      expect(safeNextPath(value), String(value)).toBe("/painel");
    }
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("//evil.com", "/conta")).toBe("/conta");
  });
});
