# Security (core requirement)

No system can guarantee "zero weaknesses". The goal is defense in layers, automated tests and an external review before selling.

## 1. Separate domains

Client sites live on a base domain (`BASE_DOMAIN`) different from the platform's. An abusive site then cannot sink the platform's reputation, and platform cookies never reach client sites. Platform cookies are limited to the exact host (never the parent domain), `httpOnly`, `secure`, `sameSite`. Registering the base domain in the Public Suffix List is recommended (owner step). In development use `sites.localhost`.

## 2. Generated sites

- All text escaped at generation. No free HTML in any field.
- Links accept only `https`, `wa.me`, `tel:` and `mailto:`.
- Headers applied by the Worker to every site: restrictive CSP (`default-src 'none'`; `img-src 'self'`; `style-src 'self'`; `font-src 'self'`; scripts only from the site itself or by hash; `frame-ancestors 'none'`; `base-uri 'none'`; `form-action 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, a restrictive `Permissions-Policy`, HSTS.
- No external requests. No cookies.

## 3. Images (pipeline)

Accept JPG, PNG and WebP, validated by content, not by extension. SVG uploaded by the client is refused. Every image is re-encoded on the server: EXIF removed (GPS included), disguised files neutralized, format standardized. Responsive sizes (about 480, 800, 1280 and 1920 px) in a modern format with a fallback. Limits: 10 MB per file, 12 images in the gallery. Warn when a photo is small or blurry. Originals stay in a private bucket; only derivatives go to public hosting. Alt text suggested by the AI and editable by the client. A photo with a minor's face requires the authorization confirmation.

## 4. AI

See `ai-and-reviewer.md`: delimited data, no tools and no secrets, closed JSON, numbers and contacts checked against the input, limits and budget.

## 5. Platform

- RLS enabled on every Supabase table, deny-all by default, explicit policies per owner.
- Every server action checks ownership of the resource (prevents IDOR). Zod validation on the server. CSRF protection.
- Rate limits on sign-in, form, AI and upload. Bot protection on sign-up.
- The Supabase service key only on the server, never in the browser.
- Security headers and CSP on the platform too.
- Single-use, short-lived magic links; never reveal whether an email exists.

## 6. Payments

Publish only after a confirmed webhook, with idempotency; never trust the browser. No card data in our system. Webhook authentication as in the provider's documentation (to verify).

## 7. Client domains

Ownership verification of custom domains (Cloudflare for SaaS). Subdomains only with `a-z`, `0-9` and hyphen, no `xn--`, with a list of reserved names and of names that imitate banks, government bodies and brands. Quarantine before a cancelled subdomain can be reused.

## 8. Accounts and supply chain

2FA on every account (GitHub, Vercel, Cloudflare, Supabase, Asaas, registrar) and a transfer lock on the domain (owner steps). Tokens with the least privilege. Separate environments (dev and production). Secret scanning with push protection. Pinned versions, dependency audit in CI, restricted install scripts. Generated sites have no runtime dependencies.

## 9. Data and LGPD

Collect the minimum. Privacy policy and deletion on request (legal text with a lawyer). Defined log retention. Backups with tested restores.

## 10. Security tests in CI

- A corpus of malicious input (XSS, injected HTML, `javascript:`, SVG as an image, polyglots) in every form field, checking that the output is escaped.
- A corpus of prompt injection against the AI.
- User A cannot read or change anything of user B (RLS and API).
- CSP and headers checked on the Worker's responses.
- Rate limits working.
- External pentest before opening sales (owner step).

## Implementation (E7)

- **Image pipeline:** `packages/generator/src/image-pipeline.ts`, `cleanImage()`.
  - The format is read from the bytes. JPEG, PNG and WebP pass; SVG, GIF, HTML and anything else are refused.
  - Limits: 10 MB and 40 megapixels (decompression bombs are refused before decoding).
  - Each photo is decoded and encoded again as WebP, at most 2000 px, turned upright. All metadata (EXIF, GPS) is dropped, and anything appended to the file does not survive.
  - It warns about small (under 1200 px, shown smaller by the variants) and blurry photos. Refusals and warnings are in pt-BR.
  - Tested with real and hostile files: SVG with `onload`, HTML renamed to `.jpg`, a JPEG header over other content, a polyglot with a script after the image data, EXIF with GPS, a 48-megapixel bomb.
  - It is wired into the upload flow in E10. Today the form still shrinks photos in the browser and stores them in the public `site-images` bucket used by the 1.1 product. Moving originals to a private bucket is part of E10.
- **Minors:** an image may say `showsMinor`; then `minorConsent: true` is required (schema 1.2).
- **Text:** `cleanText()` (schema 1.2) removes control characters and bidirectional overrides from every string of a 1.2 config when it is read. All text is escaped by Astro at build time, and the JSON-LD block escapes `<`. `packages/templates/test/xss.test.ts` builds a site with script, event-handler, title-breaking and template-injection payloads in every text field and checks that none of them becomes markup.
- **Links:** every link of a 1.2 site goes through `isSafeHref()`, which allows only https, `tel:` with digits, `mailto:` and in-page anchors. Anything else (`javascript:`, `data:`, `http:`) becomes `#`.
- **Variant dialect:** `packages/reviewer/src/dialect.ts` refuses, in a variant's markup or CSS:
  - scripts, `on*` attributes, inline `style`, `javascript:` and `data:` URLs, external resources, forms, iframes and other embeds, client-side components and raw HTML;
  - `@import`, `url()`, `@keyframes`, `transition`, `animation`, `@font-face` and legacy CSS hooks.

  Every variant in the catalog is checked in CI. The restricted code layer is the switch `AI_CODE_VARIANTS` (off) plus an entry point that refuses everything while it is off.
- **Headers:** `apps/sites-worker/src/headers.ts`.
  - Strict CSP for 1.2 sites: `default-src 'none'`, self-only images, styles, fonts and scripts, nothing framed or framing, no forms, no connections, `upgrade-insecure-requests`. The generator marks their files with R2 metadata `csp: strict`.
  - 1.1 sites, which inline their stylesheet and small scripts, get the same policy plus `'unsafe-inline'` for style and script, until they are rebuilt as 1.2.
  - Every response also gets `Permissions-Policy` (every device feature off), `nosniff`, `Referrer-Policy`, `X-Frame-Options`, COOP, CORP and HSTS.

Still to come: the prompt-injection corpus (E8), RLS and rate-limit tests and the private bucket (E10), and the external pentest (owner).
