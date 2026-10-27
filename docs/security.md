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
