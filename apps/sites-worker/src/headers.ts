// Security headers of client sites (docs/security.md, item 2), applied by the Worker to every
// response. Two content security policies:
// - strict: 1.2 sites, built with no inline style or script (packages/templates/src/v12). The
//   generator marks their files with the R2 custom metadata `csp: "strict"`.
// - legacy: 1.1 ("classico") sites, which inline their stylesheet and small scripts. They keep
//   'unsafe-inline' until they are rebuilt as 1.2 (E10); everything else is as strict.

const common = [
  "default-src 'none'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "upgrade-insecure-requests",
];

export const STRICT_CSP = [...common, "style-src 'self'", "script-src 'self'"].join("; ");

export const LEGACY_CSP = [
  ...common,
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
].join("; ");

/** For the Worker's own small pages (not found, test home), styled inline. */
export const PAGE_CSP = [...common, "style-src 'unsafe-inline'", "script-src 'none'"].join("; ");

export type CspPolicy = "strict" | "legacy" | "page";

const policies: Record<CspPolicy, string> = {
  strict: STRICT_CSP,
  legacy: LEGACY_CSP,
  page: PAGE_CSP,
};

/** Sites ask nothing of the visitor's device: every powerful feature is off. */
export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=()",
  "browsing-topics=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "publickey-credentials-get=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

export function securityHeaders(policy: CspPolicy): Record<string, string> {
  return {
    "content-security-policy": policies[policy],
    "permissions-policy": PERMISSIONS_POLICY,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
  };
}

/** The policy for a stored file, from its R2 custom metadata. */
export function policyFor(metadata: Record<string, string> | undefined): CspPolicy {
  return metadata?.csp === "strict" ? "strict" : "legacy";
}
