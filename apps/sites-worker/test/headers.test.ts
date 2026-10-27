import { describe, expect, it } from "vitest";
import { LEGACY_CSP, PAGE_CSP, policyFor, STRICT_CSP, securityHeaders } from "../src/headers";

describe("content security policies", () => {
  it("strict: only the site's own files, no inline code, nothing embedded", () => {
    for (const directive of [
      "default-src 'none'",
      "img-src 'self'",
      "style-src 'self'",
      "font-src 'self'",
      "script-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "object-src 'none'",
      "connect-src 'none'",
    ]) {
      expect(STRICT_CSP).toContain(directive);
    }
    expect(STRICT_CSP).not.toContain("unsafe");
    expect(STRICT_CSP).not.toMatch(/https?:|data:|\*/);
  });

  it("legacy only relaxes inline style and script, for 1.1 sites", () => {
    const relaxed = LEGACY_CSP.split("; ").filter((directive) => !STRICT_CSP.includes(directive));
    expect(relaxed).toEqual([
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
    ]);
  });

  it("the Worker's own pages run no script", () => {
    expect(PAGE_CSP).toContain("script-src 'none'");
  });

  it("files marked strict get the strict policy; anything else the legacy one", () => {
    expect(policyFor({ csp: "strict" })).toBe("strict");
    expect(policyFor(undefined)).toBe("legacy");
    expect(policyFor({ csp: "other" })).toBe("legacy");
  });
});

describe("other headers", () => {
  it("turn off sniffing, framing, device features and plain HTTP", () => {
    const headers = securityHeaders("strict");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toMatch(/max-age=31536000/);
    expect(headers["permissions-policy"]).toContain("geolocation=()");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  });
});
