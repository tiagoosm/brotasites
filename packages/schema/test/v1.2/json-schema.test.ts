import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { siteConfigJsonSchema } from "../../src/v1.2/index.js";

describe("JSON Schema", () => {
  it("matches docs/site-config.schema.json (run `pnpm --filter @brotasites/schema json-schema`)", () => {
    const file = new URL("../../../../docs/site-config.schema.json", import.meta.url);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(siteConfigJsonSchema());
  });
});
