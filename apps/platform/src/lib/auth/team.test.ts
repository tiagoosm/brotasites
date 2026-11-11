import { describe, expect, it } from "vitest";
import { TEAM_HOME, teamNextPath } from "./team";

describe("the team's sign-in goes back only inside the team's area (E33)", () => {
  it("keeps pages of /admin", () => {
    expect(teamNextPath("/admin")).toBe("/admin");
    expect(teamNextPath("/admin/contas")).toBe("/admin/contas");
    expect(teamNextPath("/admin/sites/1?aba=2")).toBe("/admin/sites/1?aba=2");
  });

  it("turns anything else into /admin", () => {
    for (const value of [
      null,
      "",
      "/",
      "/meus-sites",
      "/administrador",
      "https://evil.example/admin",
      "//evil.example/admin",
      "/\\evil.example",
      "admin",
    ]) {
      expect(teamNextPath(value), String(value)).toBe(TEAM_HOME);
    }
  });
});
