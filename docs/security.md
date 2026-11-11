# Security (core requirement)

No system can guarantee "zero weaknesses". The goal is defense in layers, automated tests and an external review before selling.

## 1. Separate domains

**The rule:** the platform and the client sites are always on different registrable domains. Today the platform is `brotasites.com.br` and the client sites live on `brotasites.com` (`BASE_DOMAIN`). An abusive site then cannot sink the platform's reputation, and platform cookies never reach client sites. Platform cookies are limited to the exact host (never the parent domain), `secure` over HTTPS, `sameSite=Lax` (not `httpOnly`: decision of 2026-10-29, `docs/owner-steps.md`). Registering the base domain in the Public Suffix List is recommended (owner step). In development: `localhost` and `sites.localhost`.

Since E28 every address is read in one place, `apps/platform/src/lib/domains/hosts.ts` (and `BASE_DOMAIN`/`PLATFORM_URL` in the Worker's own variables), never written by hand elsewhere. A production build on Vercel (`VERCEL_ENV=production`, or `BROTASITES_STRICT_HOSTS=1` anywhere) **refuses to run** when `NEXT_PUBLIC_PLATFORM_URL` or `NEXT_PUBLIC_BASE_DOMAIN` is missing, when the platform's address is not HTTPS, when the platform and the sites share a registrable domain (the same, nested, or two names under one), or when the admin host is not under the platform's domain (`next.config.ts`, tested in `hosts.test.ts`). Local builds, CI and Vercel previews keep the development defaults.

- **The team's host** (E28): with `NEXT_PUBLIC_ADMIN_HOST` (`admin.brotasites.com.br`), the team's area lives only there. The proxy moves `/admin` from the platform there permanently (308) and answers 404 to `/api/admin/*` on the platform; the admin host serves only `/admin/*`, `/entrar`, `/auth/*`, `/api/admin/*`, `/api/auth/*`, `/api/account/me` and a `robots.txt` that disallows everything, with `x-robots-tag: noindex, nofollow` on every response; anything else goes back to the platform. The session cookie stays host-only, so the team's session is **separate**: signing in again on the admin host is expected (less surface), two-step verification (aal2) still applies, and signing in there returns to `/admin` (`voltar` is a path on the same host, never another host). The origin check (`guard.ts`) accepts the request's own host, the platform's address and the admin host, nothing else. Without the variable nothing changes. Links to the team's area use `adminUrl()`.
- **Redirects** (E28): `www.<platform>` and, in production, the old `brotasites.vercel.app` go to the platform's address permanently (308, path and query kept), except `/api/cron/*` and `/api/jobs/*` on the old address (Vercel's own calls). The Worker sends the bare sites domain and its `www` to the platform (301).
- **HSTS** (E28): `Strict-Transport-Security: max-age=31536000; includeSubDomains` on the platform's HTTPS responses in production (the proxy), never in development. The Worker sends it per address: with `includeSubDomains` on the sites domain and its subdomains, **without** it on a client's own domain (the client's other subdomains are not ours to decide), never over HTTP nor on the workers.dev testing address (before E28 the Worker sent the same header on every response). No `preload`: submitting the domains to the HSTS preload list is the owner's decision once everything is stable on HTTPS, since leaving the list takes months.

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
- Single-use, short-lived email links (confirmation, password reset, email change); never reveal whether an email exists.
- **Restricted recovery session (E30, `lib/auth/recovery.ts`):** the password-reset link does not sign the person in. Its session is recognised by its own sign-in method (the latest real `amr` entry is `recovery`, recorded by Supabase when the link is verified; to verify on the real project) and by a 15-minute `HttpOnly`, `SameSite=Lax` (and `Secure` over HTTPS) cookie, `brotasites_recovery`, holding that session's id (a stale cookie never restricts a later session). The proxy checks it on every request: only `/redefinir-senha`, `POST /api/account/password`, the `/auth/*` links and signing out work; protected pages (Meus sites, conta, criar, admin) lead back to the reset page, every other API answers 403, and a page load anywhere else, or the 15 minutes passing, signs it out (the router's background prefetches carry no marker that reaches the proxy, so they get the visitor's page without ending it; the reset page itself signs out when the person moves away inside the app). The header shows the visitor's view. Saving the new password signs out every session (`global`), clears the cookie and leads to `/entrar` ("Senha alterada. Entre com a nova senha."). It never raises the session's level: the team's area still needs `aal2`. Changing the password from `/conta` (signed in, with the current password) is unchanged and keeps the person signed in. There is no sign-in link by email (removed on 2026-11-05): signing in is with the email and password only.

Accounts (E15, as built):

- Sign-up with name, email, password and its confirmation, and the accepted terms (the version is recorded, append-only); the email is confirmed by link before the first sign-in. Sign-in by password; "esqueci a senha" by link.
- Password policy (E26, changed by the owner in E27 on 2026-11-09; one place, `lib/auth/passwords.ts`, used by the browser and the API): to create or change a password, the only requirement is 8 to 128 characters. Lowercase, uppercase, a number and a symbol are not required: they only raise the strength meter. The meter, in text: Fraca (under 8 characters, a common password such as "Senha@12345", one with the local part of the email or a part of the name with 4 letters or more, or 8 to 11 characters of one kind), Boa (two kinds, or 12 characters or more), Forte (12 or more with three kinds, or 16 or more with two). The repeated password is checked by the server too (`confirmPassword`). The same rule applies to resetting and to changing the password; older passwords still sign in. Risk for review: common passwords and passwords with the name or email are now accepted (shown as Fraca, never blocked); the length of 8 is the minimum NIST SP 800-63B allows, and its other half, a check against leaked passwords, is Supabase's leaked-password protection, still an owner step. The confirmed email is checked again by the server (approval) and the database (`request_directions`, `server_approve`).
- Every account request goes through the platform's routes (`/api/auth/*`, `/api/account/*`): Origin check (also for every `/api` write, in `src/proxy.ts`), Zod, rate limits per IP and per email in the database (`server_rate_limit`, hashed keys), and Cloudflare Turnstile checked by Supabase Auth itself, so bots that skip the pages are refused too.
- The same answer and about the same time for an existing and a new email (sign-up, sign-in, link, reset, resend); one message for a wrong email or password.
- The signed-in pages are refused on the server (`src/proxy.ts`, getClaims) before any page code; the routes check the user again with getUser.
- Session cookie host-only (no Domain), Secure over HTTPS, SameSite=Lax, readable by the browser client as Supabase's SSR design requires (decision of 2026-10-29: HttpOnly would need every data access moved to the server). A nonce CSP with 'strict-dynamic' on the signed-in and account pages keeps injected scripts from running there; account pages are `no-store` and `noindex`.
- Changing the email, creating a password and deleting the account need a sign-in from the last 10 minutes (the JWT's amr); changing the password needs the current one. Password and email changes sign out the other devices.
- The team's admin panel and the second factor (TOTP, aal2): **off for now, behind a temporary switch** (owner's decision of 2026-11-11, E33). The database's `is_admin()` decides: on the `admins` list, never in a password-reset (recovery) session, and with aal2 only while `public.team_settings.require_second_factor` is true. The switch is one row, RLS on, no client policy (only the owner changes it in the SQL editor); the interface reads it through `second_factor_required()` and, while it is off, shows the team a reminder at the top of the panel. Turn it back on with `update public.team_settings set require_second_factor = true;` (nothing else: the code step and the aal2 check come back at once). If the switch can't be read, it counts as on. What keeps protecting the panel with it off: the `admins` list, RLS, the origin check on POST, the separate admin host with its own session, `noindex`, the append-only decision log and the sign-in rate limits. Turn it back on before accepting real clients or charging.
- The team's sign-in (E33): on the admin host `/entrar` leads to `/entrar/equipe`, the team's own page (no sign-up, no client links). It uses the same `/api/auth/sign-in` route (rate limits, origin, captcha when on), goes back only to a page of `/admin`, and signs out at once an account that is not on the team, so no client session stays open on the team's host.
- Account deletion removes the sites (database, Storage, KV at once, R2 by the jobs) and keeps paid charges for the tax period.

Dashboard (E16, as built):

- `/meus-sites` ("Painel" until E26; `/painel` redirects there) is refused on the server without a session (proxy, then the page checks getUser again), read with the person's own session (RLS), `private, no-store` and `noindex`, out of the sitemap. Nothing admin-only reaches it (review notes, decision log, reviewer reports, catalog weights).
- Notices (`public.notifications`): made only by database triggers; clients read their own and can change only `read_at` (column grant, RLS, and a trigger that keeps the first read time); no insert or delete by clients; the sentence comes from a closed list of kinds, no stored text. Marking as read goes through `/api/notifications/read`: Origin, Zod (UUIDs or "all"), the person's session, a rate limit per IP and per account.
- The public pages are prerendered twice (visitor and signed in) and served by the proxy under the same address, with `private, no-cache`; the internal addresses answer 404. They hold no personal data (only which menu to show).

Header (E17, as built):

- One header everywhere. Who is signed in comes from the server: the signed-in pages read the session, name and team flag in their layout; the prerendered public pages ask `/api/account/me` (the person's own name, email and team flag, `no-store`) only when the profile menu opens. Names and emails are rendered as text (escaped), never as HTML, and never put in a URL. "Área da equipe" is only a link: `/admin` is still checked on the server and needs the second step (aal2).
- With the `/exemplo` page gone (it framed the example site), the platform's CSP no longer allows framing: `frame-ancestors 'none'` (was `'self'`) and `frame-src` only for Turnstile (was also `'self'` and the previews).

### Cost limits and team access (E24)

- Limits are enforced in the database, not only in the interface: round limit with a row lock, one open site with an advisory lock in a trigger, values sent by the server routes and validated (out of range is refused, `bad_limits`).
- `ai_calls`, `site_removals` and `account_site_slots` have RLS on and no client policy: the server writes them, the team reads aggregates through `security definer` functions that call `private.require_admin()` (`is_admin()`: the admin list, no recovery session, and aal2 while the E33 switch asks for it). The browser never holds a service key.
- The team's account detail is logged on each opening (`admin_decisions`, `view_account`), and every exception (extra round, extra site slot, postponed cleanup) is logged with who, when, the reason, and the values before and after.
- `ai_calls` stores no prompt and no client text; its site and account columns become null when they are deleted.
- The cleanup deletes only unpaid sites that wait on the client, in batches, idempotently; anything doubtful is skipped.

## 6. Payments

Publish only after a confirmed webhook, with idempotency; never trust the browser. No card data in our system. Webhook authentication as in the provider's documentation (to verify).

## 7. Client domains

Ownership verification of custom domains (Cloudflare for SaaS). Subdomains only with `a-z`, `0-9` and hyphen, no `xn--`, with a list of reserved names and of names that imitate banks, government bodies and brands. Quarantine before a cancelled subdomain can be reused.

Client domains (E25, `apps/platform/src/lib/domains/validate.ts`, `supabase/migrations/20261105000000_site_domains.sql`):

- **Format, on the server:** a full host in lowercase (common ways of writing it are tidied: spaces around, case, `https://`, a trailing slash or dot); refused with scheme paths, a port, spaces, `@`, a wildcard, an IP, non-ASCII or punycode (`xn--`) labels, more than 253 characters or a label over 63. It must have a public suffix (the Public Suffix List, ICANN section, kept in the repository).
- **Refused names:** `BASE_DOMAIN` and its subdomains, the platform's own hosts (its address, the previews', `brotasites.com`, `vercel.app`, `workers.dev`, `pages.dev`), test and reserved names (`localhost`, `.test`, `.example`, `.invalid`, `.local`, `example.com`...), the suffixes only government, justice, the armed forces and banks register in Brazil (`gov.br`, `jus.br`, `leg.br`, `mil.br`, `mp.br`, `def.br`, `b.br`), and names with the imitation words of `reserved.ts` (whole words, and the longer brands inside a name).
- **One domain per site, one site per domain:** unique indexes on the hosts in use and one per site, in the database; only a paid site can connect one; only its owner reads it (RLS) and only the server's functions write.
- **Ownership before serving:** a domain is written to KV only once the hosting says both the hostname and its certificate are active. Typing a domain never activates it.
- **Limits:** asking, checking and removing count per IP (60 an hour), per account (40 a day) and per site (30 a day), in the database limiter. Too many tries only wait.
- **No hanging domains:** removing, a failure after activation, or deleting the site take the domain out of KV and the hosting (`domain_purges` for deleted sites). The BrotaSites address never depends on the own domain.
- **Messages:** pt-BR, with what to do; never the hosting's own text, an internal code or another person's data. No personal data in URLs.

## 8. Accounts and supply chain

2FA on every account (GitHub, Vercel, Cloudflare, Supabase, Asaas, registrar) and a transfer lock on the domain (owner steps). Tokens with the least privilege. Separate environments (dev and production). Secret scanning with push protection. Pinned versions, dependency audit in CI, restricted install scripts. Generated sites have no runtime dependencies.

## 9. Data and LGPD

Collect the minimum: name, email, password (Supabase stores only a hash), optional WhatsApp, the accepted terms version; CPF/CNPJ and billing address only at payment (columns reserved, no screen yet). Privacy policy (legal text with a lawyer). The person downloads their data and deletes the account at /conta. Defined log retention: the account routes never log a password, a token or a full email. Backups with tested restores.

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
