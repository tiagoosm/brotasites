import { describe, expect, it } from "vitest";
import { formatBRL, pricing, publishPrice } from "./pricing";

describe("pricing", () => {
  it("formats prices in reais", () => {
    expect(formatBRL(297).replace(/\s/g, " ")).toBe("R$ 297");
  });

  it("charges the regular price while there is no launch price", () => {
    expect(pricing.launchPrice).toBeNull();
    expect(publishPrice()).toBe(297);
  });

  it("keeps the legal texts marked until they are reviewed", () => {
    expect(pricing.legalReviewed).toBe(false);
  });
});
