import { describe, expect, it } from "vitest";
import { codeVariantsEnabled, screenCodeVariant } from "../src/index.js";

const proposal = {
  section: "sobre",
  markup: "<section><h2>Oi</h2></section>",
  css: ".a{color:red}",
};

describe("restricted code layer", () => {
  it("is off by default", () => {
    expect(codeVariantsEnabled({})).toBe(false);
    expect(codeVariantsEnabled({ AI_CODE_VARIANTS: "false" })).toBe(false);
    expect(codeVariantsEnabled({ AI_CODE_VARIANTS: "1" })).toBe(false);
    expect(screenCodeVariant(proposal, {})).toMatchObject({
      accepted: false,
      reason: "switched-off",
    });
  });

  it("when on, refuses code outside the dialect and never accepts on its own", () => {
    const on = { AI_CODE_VARIANTS: "true" };
    expect(screenCodeVariant({ ...proposal, markup: "<script>x()</script>" }, on).reason).toBe(
      "dialect",
    );
    expect(screenCodeVariant(proposal, on)).toMatchObject({
      accepted: false,
      reason: "needs-human-review",
    });
  });
});
