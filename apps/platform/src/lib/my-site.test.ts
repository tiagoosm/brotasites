import { describe, expect, it } from "vitest";
import { siteUrl } from "./my-site";

describe("site address", () => {
  it("uses the client's subdomain in production", () => {
    expect(siteUrl("padaria-do-ze", "")).toBe("https://padaria-do-ze.brotasites.com");
  });

  it("opens by path on the test address while there is no domain", () => {
    expect(siteUrl("padaria-do-ze", "https://brotasites-sites.conta.workers.dev")).toBe(
      "https://brotasites-sites.conta.workers.dev/padaria-do-ze/",
    );
  });
});
