# Build plan

Check each step when done. One branch (`step-N-name`) and one pull request per step, with a short summary at the end of each step.

Decision of 2026-10-27: the owner no longer approves each task. A step's pull request is merged once CI is green, and work goes on to the next step. Where a step says ASK THE OWNER, the recommended option is taken and recorded under "Decisions to review" in `docs/owner-steps.md`; the owner can reverse it. Accounts, purchases and paid actions still belong to the owner.

This plan comes from the owner's master file (2026-10-27) and is adapted to the code that already exists: the platform, form, sign-in, Supabase tables with RLS tests, the v1.1 schema, the Astro template, the generator and the sites Worker are built. Each step says what it reuses and what it replaces.

- [x] E1 Repository baseline, quality and security basics
- [x] E2 Schema 1.2 (Zod), example and tests
- [x] E3 Catalog and design grammar (tokens, typography, ornaments)
- [x] E4 Identity engine (3 directions, AA contrast, diversity, fingerprint)
- [x] E5 Base Astro template + default motion + Motion Lab
- [x] E6 Variant factory: food, beauty, events and creatives (with a taste calibration)
- [x] E7 Image pipeline and content security
- [x] E8 AI layer: art director, copy, playbooks, evaluations
- [x] E9 Reviewer: deterministic checks + reviewer agent
- [x] E10 Platform: sign-in, form, queue, status, directions, finished site
- [x] E11 Admin review panel and catalog promotion cycle
- [x] E12 Hosting: Worker, R2, KV, publishing, suspension, export
- [x] E13 Final verification, blind test kit, owner steps
- [x] E14 "Experimente aqui" demo on the home page: removed (owner decision 2026-10-29)
- [x] E15 Accounts: sign-up with password and email confirmation, sign-in, account page, security
- [x] E16 Account dashboard: home after signing in, pending actions, site status, in-site notices
- [x] E17 One header everywhere, the profile menu, and a home page without the demo
- [x] E18 Home page motion and navigation: one create-site button, repeating entrances, smooth section links, the turning price glow, an organic stem, the vine everywhere

## Steps in detail

### E1 Baseline

Already in place: pnpm + Turborepo monorepo, strict TypeScript, Biome, Vitest, Playwright, `.gitignore`, `.env.example`, README, CI (lint, types, unit tests, build, e2e). Add: dependency audit and secret scanning in CI, Dependabot, pnpm set to not run install scripts without approval (if the pinned pnpm supports it), the empty `packages/` for catalog, engine, ai and reviewer with their tooling, and `docs/owner-steps.md` kept up to date. Criterion: `pnpm lint && pnpm test && pnpm build` pass from a clean clone.

### E2 Schema 1.2

Implement in `packages/schema` as described in `docs/schema-1.2.md`. Schema 1.2 lives in `packages/schema/src/v1.2` (import `@brotasites/schema/v1.2`) next to v1.1, which the live form, templates and generator keep using until they move in E5 and E10; v1.1 is removed then. `docs/site-config.example.json` becomes the 1.2 example (Padaria do Zé, fictional, with structured opening hours); the v1.1 example moves to `docs/legacy/site-config.example.v1.1.json` and its readers (generator, templates, platform example build) point there. Tests: the example is valid; one invalid case for each rule (hex, subdomain with `xn--`, reserved name, WhatsApp, overlapping hours, no contact channel, testimonials enabled with no item, no address and no service area). Also export a JSON Schema generated from Zod. Keep a v1.1 to v1.2 converter only if it is simple (it is not: v1.1 has free-text hours and no identity, so what happens to existing v1.1 drafts is decided in E10). Criterion: every rule in the document is covered.

### E3 Catalog and grammar

In `packages/catalog`, implement the tokens described in `docs/art-direction.md`: 5 personalities, font pairs (local woff2, license checked and recorded in `THIRD_PARTY_LICENSES.md`), type scales, OKLCH palette generation with AA contrast, shapes, dividers (inline SVG: the sites' CSP blocks data: URIs in masks), patterns, original SVG ornaments, CSS photo treatments, seeded gradient-with-grain backgrounds. ASK THE OWNER: show the list of fonts with checked licenses for approval (taken under the 2026-10-27 rule: see "Decisions to review" in `docs/owner-steps.md`).

### E4 Engine

In `packages/engine`: seeded PRNG (hash of name + city + category + round), 3 directions ("Fiel à marca", "Evolução", "Contraste"), diversity checks across the 3, design fingerprint and a uniqueness registry interface (minimum distance between sites of the same family and city; in-memory now, Supabase table in E10), identity freezing, field locking. `EngineProvider` interface (this step) and `AiProvider` (E8). Tests: 30 fictional businesses (10 per family), determinism (same input, same output), AA on every palette, diversity, minimum distance.

### E5 Template and motion

Rework the Astro template in `packages/templates` around the schema 1.2 sections and a variant structure (each variant declares family, personality, photo requirements, states). Implement the default motion from `docs/default-motion.md`, with `data-anim` attributes, minimal JS and presets in CSS variables. Build the Motion Lab (internal route, outside the client site build) listing every behavior, with a reduced-motion switch. Budget: at most 8 KB gzip of JS. Criterion: content visible without JS; Lighthouse above 95 on an example page.

### E6 Variant factory

As in `docs/art-direction.md`. Order: food, beauty, events and creatives. FIRST CALIBRATION STOP: before mass production, deliver 1 hero, 1 "sobre" and 1 "serviços" for the food family, rendered at 360 and 1280 px in the 4 states (good photo, weak photo, no photo, long text), and ASK THE OWNER whether the taste is right. Only then produce the rest. Targets for this round per family: 4 heroes; for the other sections, 3 variants shared across families (sobre, servicos, como-funciona, diferenciais, galeria, depoimentos, faq, cta-final, contato). Each variant: HTML + CSS with no JavaScript of its own, only motion attributes, passing the tests in `docs/art-direction.md`. Fingerprint and metadata in the catalog.

### E7 Images and content security

Pipeline as in `docs/security.md` (Images): validation by content, re-encoding, EXIF removed, responsive sizes, limits, alt text, private bucket. Reuse what the current photo upload already does. HTML/CSS and URL sanitizer, validator for the restricted variant dialect (no JS, no external `url()`, no `@import`, no own `@keyframes`/`transition`; see `docs/catalog-promotion.md`), headers module (CSP and others) used by the Worker. Test suite with malicious input (XSS, `javascript:`, injected HTML, SVG sent as an image, polyglots). Criterion: every security test green.

### E8 AI layer

As in `docs/ai-and-reviewer.md`. ASK THE OWNER before choosing the model: compare the official options available in the API, with checked prices and limits, and propose one. Deliver: `AiProvider` with the art director (composition as JSON from the catalog), copy generation with per-family playbooks, fact checking, injection defense, cache by input hash, per-site and per-day limits, a global budget with an alert, fallback to the engine, an evaluation set with the 30 businesses, versioned prompts. A "simulated" mode (no API calls) for tests and development.

### E9 Reviewer

As in `docs/ai-and-reviewer.md`. Deterministic checks (contrast, overflow at 360/768/1280 with Playwright, links, external requests, axe, weight, schema, touch targets) and the reviewer agent (simulated and real modes) with structured output. A set of 20 sites with known defects to measure hits and false alarms. Fix loop of up to 2 rounds.

### E10 Platform

Rework the existing Next.js platform:
- Remove the live preview: the preview panel in the form, `apps/preview`, its e2e tests, and the home page copy and pictures that promise "veja o site tomar forma enquanto responde".
- Sign-in required before creating a site (decision of 2026-10-27). Form in 7 steps as in `docs/form-flow.md` (draft saved in the account at every step), blocked category check, guide to taking photos in step 4 (short, still screens, no external images).
- "Meus sites" dashboard with status and timeline, the screen to choose among the 3 directions (cards rendered by the real components), the finished-site screen (private address with a token, not indexed, no download), dashboard edits that respect locks, approval, and a payment interface with a stub (no real charge).
- Uniqueness registry: a table of design fingerprints per site (family, city, fingerprint) connected to the engine, applying the minimum distance between sites of the same family and city (drafts included).
- ASK THE OWNER to choose the queue (Inngest or Trigger.dev), with cost, limits and execution model checked.
- Database: Supabase migrations with RLS on every table and tests that user A cannot access anything of user B (extend the existing `supabase/tests`). Rate limits, server-side validation, ownership check on every action.
- Note in `docs/owner-steps.md`: set up a custom SMTP (Supabase's default SMTP only delivers to the project team and is rate limited).

### E11 Admin

`/admin` route for the administrator role: review queue (rendered site, client data, reviewer report, history), approve, request changes, suspend, a log of every decision. No user impersonation. Promotion cycle as in `docs/catalog-promotion.md`: metrics per variant and per composition, mark a composition "recommended" or "retired", request a new variant from the factory; weights with a cap and a minimum exploration quota.

### E12 Hosting

As in `docs/hosting.md`, extending the existing `apps/sites-worker`: run locally with wrangler and miniflare, publishing by version with a pointer in KV, private draft address with a token, suspension and the suspended-site page, zip export, security headers, `BASE_DOMAIN` instead of the platform's domain. DO NOT deploy. Document every account and DNS step in `docs/owner-steps.md`.

### E13 Final verification

Run every test, Lighthouse, axe and the security suite. Build the blind test kit (`docs/blind-test.md`) with 20 sites. Update the README and `docs/owner-steps.md`. Deliver a report: what is in, what was cut, numbers, and what depends on the owner's decisions and accounts.

### E15 Accounts

Sign-up with name, email, password and the accepted terms, with email confirmation; sign-in by password or by link; "esqueci a senha"; the /conta page (profile, email, password, two-step verification for the team, other devices, data export, account deletion). Security: server-side page protection, the confirmed-email rule on the server and in the database, no account enumeration, Turnstile, rate limits, password rules, host-only cookies, no open redirects, Origin checks, Zod, admin with aal2, no-store and noindex. Email templates in `docs/email-templates/`; Supabase and email setup in `docs/owner-steps.md` (Accounts). Login with Google is left for later.

### E16 Account dashboard

Signing in, signing up and confirming the email lead to `/painel` (unless a safe page was asked for with `voltar`), and signed-in people who open `/entrar` or `/cadastro` go there too. The dashboard, rendered on the server with the person's session, replaces the list at `/meus-sites` (now a 308 to `/painel`; each site's pages keep their addresses): a greeting, what needs the person (email to confirm, a direction to choose, a site to approve, a site that needs attention, a draft to continue, an incomplete profile), one card per site (status, milestones, the right button, and once published the address, hosting included until and days of changes left, from `pricing.ts`) and the in-site notices (`public.notifications`, made by database triggers on the status changes; the sentence comes from the kind, no stored text). The account menu is Painel, Criar site, Perfil e segurança, Sair. The public pages are prerendered twice, for visitors and for signed-in people, and the proxy serves the right one under the same address, so the menu never flickers. No help or contact screen, no notification emails; renewal, custom domain, charges and receipts come later.

### E17 One header, the profile menu, a cleaner home page

The same header and footer on every page (public pages, sign-in and password screens, the dashboard, the account, each site's page, the form, payment and the team area), with the same four links in the middle (Como funciona, Preço, Dúvidas, Ajuda). Signed out: "Entrar" and "Criar meu site". Signed in: "Criar site" and a round profile button (initials, or a person icon) whose menu holds the name and email, Painel, Criar site, Perfil e segurança, Área da equipe (team only, decided on the server) and Sair (a POST form). The menu follows the ARIA menu-button pattern (keyboard, Escape, Tab, click outside). On phones: the brand, the profile button and the full-screen sheet with the links and the account block. Signed-in pages read the session on the server for the header; the prerendered public pages keep their two variants and ask `/api/account/me` for the name and team only when the menu opens. The form keeps its progress under the header (no second brand or account menu); the team area's "Fila de revisão" and "Catálogo" are tabs inside the page. The home page loses the "Experimente aqui" demo, the "Veja um site de verdade" frame and the `/exemplo` page (owner decision of 2026-10-29); the hero fills the space with the title, the text, the buttons and three short facts.

### E18 Home page motion and navigation

Every create-site button shares the specular finish, now a composited light eased once per frame (smooth where it stuttered). The header's sign-in link reads "Entrar ou cadastre-se". Section entrances repeat each time an element returns, with a cap on simultaneous entrances and an instant final state on jumps. The links to Como funciona, Preço and Dúvidas scroll smoothly there (also from other pages). The price card's glow turns slowly by itself and hands over to the mouse without jumps. The stem in "Como funciona" is one curved, tapering stroke with leaves that bud, grow and sway, ending in a bloom. The mouse vine roams the free space of the whole public page, kept off the content. All with reduced motion, no JavaScript and touch screens covered.

### E14 Home demo (optional)

Removed (owner decision 2026-10-29). The "Experimente aqui" demo, the "Veja um site de verdade" example frame and the `/exemplo` page were taken off the home page in E17; the form always starts empty.
