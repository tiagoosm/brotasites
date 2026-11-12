import { describe, expect, it } from "vitest";
import { GENERATION_VARIABLES, generationReady, generationStatus } from "./generation";

const full = Object.fromEntries(GENERATION_VARIABLES.map((name) => [name, "set"]));

describe("whether site generation is set up (E34)", () => {
  it("never refuses in development and tests", () => {
    expect(generationStatus({})).toEqual({
      enforced: false,
      missing: [...GENERATION_VARIABLES],
      ready: true,
    });
    expect(generationReady({ VERCEL_ENV: "preview" })).toBe(true);
  });

  it("in production, refuses until every variable is present, and names only what is missing", () => {
    const status = generationStatus({ VERCEL_ENV: "production", NEXT_PUBLIC_BASE_DOMAIN: "x" });
    expect(status.enforced).toBe(true);
    expect(status.ready).toBe(false);
    expect(status.missing).toContain("TRIGGER_SECRET_KEY");
    expect(status.missing).not.toContain("NEXT_PUBLIC_BASE_DOMAIN");
    // An empty or blank value counts as missing.
    expect(
      generationStatus({ ...full, VERCEL_ENV: "production", TRIGGER_SECRET_KEY: "  " }).missing,
    ).toEqual(["TRIGGER_SECRET_KEY"]);
    expect(generationReady({ ...full, VERCEL_ENV: "production" })).toBe(true);
  });

  it("the strict flag applies the production rule elsewhere (tests)", () => {
    expect(generationReady({ BROTASITES_STRICT_GENERATION: "1" })).toBe(false);
    expect(generationReady({ ...full, BROTASITES_STRICT_GENERATION: "1" })).toBe(true);
  });

  it("only ever returns names, never values", () => {
    const status = generationStatus({
      VERCEL_ENV: "production",
      TRIGGER_SECRET_KEY: "tr_prod_secret_value",
    });
    expect(JSON.stringify(status)).not.toContain("tr_prod_secret_value");
  });
});
