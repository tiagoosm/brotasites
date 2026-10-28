import { describe, expect, it } from "vitest";
import { checkConfig } from "../src/index.js";
import { fixture } from "./helpers.js";

const checks = (input: unknown) => checkConfig(input).findings.map((finding) => finding.check);

describe("checkConfig", () => {
  it("passes the fixture", () => {
    expect(checkConfig(fixture()).findings).toEqual([]);
  });

  it("reports schema problems and low contrast on the client's colors", () => {
    const broken = fixture() as Record<string, unknown>;
    delete broken.business;
    expect(checks(broken)).toContain("schema");
    const colors = fixture();
    colors.design.overrides = { colors: { text: "#EEEEEE" } };
    const result = checkConfig(colors);
    expect(result.findings[0]).toMatchObject({ check: "contrast", fix: { type: "repair-colors" } });
  });

  it("reports an empty about section and text cut at the limit", () => {
    const config = fixture();
    const sobre = config.sections.find((s) => s.id === "sobre");
    if (sobre?.id === "sobre") sobre.content.text = "";
    expect(checks(config)).toEqual(["empty-section"]);
    if (sobre?.id === "sobre") sobre.content.text = "a".repeat(800);
    expect(checks(config)).toEqual(["cut-off-text"]);
  });
});
