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
- [x] E19 Copy review: every client-facing text shorter and scannable at a glance
- [x] E20 Design review: every screen checked on phone and desktop, inconsistencies fixed
- [x] E22 UX laws: audit of every screen against the 20 laws, fixes, `docs/ux-laws.md` and automatic checks
- [x] E23 Design references from Refero Styles (docs only)
- [x] E24 Cost control (limits and cleanup) and the team panel
- [x] E25 "5 passos" everywhere, the client's own domain included in the price, and the flow to connect it
- [x] E26 Loading without freezing, account pages that fit the screen, strong passwords, a cleaner header, "Meus sites" and the right cursors
- [x] E27 Polished sign-in and sign-up: a soft morning light, a card that breathes, 8 characters as the only password rule
- [x] E28 The domains in code: one place for every address, the team's area on its own host, redirects, HSTS and the contact addresses
- [x] E29 Clean-up: nothing that repeats, confuses or leads where the person already is
- [x] E30 "Entrar" and "Criar conta" in the header, cleaner account screens, a light that moves, one main button, and a restricted password-reset session
- [x] E31 Animations: a short, quieter mouse vine, click sparks, the hero title settling in, and a price card that arrives sharp
- [x] E32 Signed in: no "Criar meu site" in the header, the same profile menu on every page, every "Criar meu site" leads to Meus sites
- [x] E33 The team's own sign-in on its host, and the team's second step behind a switch (off for now)
- [x] E34 Generation in production: the launch map, `pnpm check:launch`, the Worker's real config, and no site ever stuck

## Steps in detail

### E34 Generation in production (owner's request of 2026-11-12)

One PR (`step-34-geracao-em-producao`); nothing outside the repository was changed (no account, deploy or setting):

- **Map:** `docs/launch-status.md`: every variable the code reads (who reads it, where to set it, need, effect without it, production value), the services with the state the owner reported, the order of what is left, and the divergences with `.env.example` and `docs/owner-steps.md`. Its tables come from `scripts/launch/requirements.mjs`; a test fails when the code reads a variable that list lacks.
- **`pnpm check:launch`:** `--target vercel|trigger|worker`, `--env <file>`, `--online`. Prints names and states only, never values; exit 1 and the next action when something blocking is missing.
- **Worker:** `wrangler.jsonc` with `brotasites.com` and `https://brotasites.com.br`; the KV id stays zeros (`TODO(owner)`), the routes commented until the zone exists; the order in its header. Development passes local values with `--var`.
- **Never stuck:** in production (or with `BROTASITES_STRICT_GENERATION=1`), creating a site or asking for directions is refused (503 `generation_not_ready`) while the Vercel generation variables are missing, and `/criar` says "Estamos preparando a criação de sites". A job queued for more than 15 minutes shows the client "Isto está demorando mais que o normal" with "Tentar de novo", and the team panel counts it and lists the missing variables.

### E33 The team's sign-in and the second step behind a switch (owner's request of 2026-11-11)

One PR (`step-33-login-da-equipe`); the migration is applied by the owner (`docs/owner-steps.md`):

- **Team sign-in:** on `admin.brotasites.com.br`, `/entrar` leads to `/entrar/equipe`: its own frame (dark ink page, the brand and an "Área da equipe" tag, the card on paper), "Área da equipe", e-mail, password, "Entrar"; no sign-up, no "Esqueci a senha" (a quiet line points to the platform), no client links, `noindex`. Same sign-in route; back only to `/admin…`; an account not on the team is signed out at once ("Esta conta não tem acesso à área da equipe."). "Acesso restrito" now offers "Ir para o site".
- **Second step, switch:** `public.team_settings.require_second_factor` (one row, RLS, no client policy), **off** by the owner's decision; `is_admin()` = on the list, never a recovery session, and aal2 only while the switch is on. The panel shows the team a reminder while it is off; the sign-in route asks for the code only while it is on. Turn back on with `update public.team_settings set require_second_factor = true;`.

### E32 The signed-in header and where creating starts (owner's request of 2026-11-11)

One PR (`step-32-menu-logado`):

- **Header:** signed in, no "Criar meu site" in the bar or the phone sheet; only the profile button.
- **Profile menu:** the same items on every page (Meus sites, Perfil e segurança, Área da equipe for the team, Sair); the current page stays, marked (`aria-current`).
- **Creating:** signed in, a bare `/criar` (every "Criar meu site" on the public pages, a sign-in that started from one) leads to Meus sites (307 in the proxy); the form opens from there with `/criar?novo=1` ("Criar outro site", or the first site's button). Drafts continue from their card on Meus sites.

### E31 Animations (owner's request of 2026-11-10)

One PR (`step-31-animacoes`); nothing in client sites, no new library:

- **Mouse vine:** no leaves; at most about 140 px of tail along the path, gone 0.4 s after the mouse rests; 2 px, opacity 0.28, stem green, a smaller sway. Measured over 3 s of mouse movement (CDP, 1440×900), main-thread task time went from about 3,350 ms (WebGL with leaves) and 2,700 ms (WebGL trimmed) to about 525 ms with one plain 2D canvas, so the vine is now 2D and no longer needs a GPU. Same protections (free space only, no touch, reduced motion, lazy, no pointer events, hidden from assistive technology, paused off screen and in a hidden tab).
- **Click sparks:** a press anywhere on the public pages and the signed-in area bursts 7 short strokes (5 on touch) in pollen yellow only that fade in about half a second; one canvas made on the first press, a loop only while they live, at most 40. Never in the team's area (path and admin host), on typing fields or with reduced motion (decision: inputs and admin excluded so typing and the team's work stay calm).
- **Hero title:** split into words in CSS (no wait for JavaScript), each rising 0.32em into place in 750 ms, once; opaque from the first frame because a fade from 0.6 moved the simulated phone LCP by about 0.4 s while the rise alone did not (median 2,677 ms against 2,679 ms without it, CLS 0). Whole words keep the kerning and the exact line breaks (tested at six sizes). Still without JavaScript and with reduced motion.
- **Follow-up (owner's review, PR `step-31-ajustes`):** the price card still showed a green and amber blur inside: its halo (z-index −1, blurred) painted over the card's face whenever the card became its own stacking context (its entrance, some browsers); the card now has its own face above the halo. The hero title's letters lift near the mouse (inline letter spans, kerning kept). The morning light turns about 24° toward the mouse instead of 4°. The mouse vine is on every page but the team's area.
- **Price card blur (root cause):** the whole card entered with `filter: blur(3px)`; while already readable (opacity 0.87 at 304 ms) its text and border glow were still resampled through a 0.4 px blur until about 660 ms. Blocks and cards now enter with opacity and a short rise only; blur (2 px) is kept for short titles.

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

### E30 Header buttons, account screens, the light, the main button and the reset session (owner's requests of 2026-11-10)

One PR (`step-30-navbar-e-telas-de-conta`):

- **Header:** visitors get "Entrar" (quiet) and "Criar conta" (the highlight), never the screen they are on, neither on the password screens; the right column is wider so the middle links never move; the phone menu ends with both.
- **Sign-up:** strength only while typing, only the 8-character minimum listed, the button across the card, the terms in one line.
- **Morning light:** root cause measured (beams so wide they were a flat veil, a slow clock under a still glow); beams and clock restored; still with reduced motion.
- **Account screens:** no footer; all four fit 1366×650 and 1280×600.
- **Main button:** one specular finish for every solid green action (`components/ui/specular.tsx`).
- **Reset link:** a restricted recovery session that only reaches the reset page, ends on leaving or after 15 minutes, and after saving leads to sign in with the new password.

### E29 Clean-up (owner's request of 2026-11-10)

Removal and clarity only; no new function, no security rule changed. One PR (`step-29-limpeza`):

- **Footer and header:** the footer keeps only Termos and Privacidade (and the contact line); *Dúvidas* left the header (Ajuda covers it; the home page keeps its section); no *Entrar ou cadastre-se* on the account screens; menus never list the current page.
- **Errors:** each one once, under its field, announced; no summary on sign-up and no general message repeating the fields' errors on the account forms.
- **Meus sites:** the name opens the site's page (no *Detalhes*), one label *Abrir* for "the site's page", one link to the live address, the milestones instead of *Última mudança* when there are any.
- **Password:** *Mínimo: 8 caracteres* apart from *Para ficar mais forte (opcional)*.

### E28 The domains in code (owner's request of 2026-11-09)

The platform on `brotasites.com.br`, the client sites on `brotasites.com`. Four commits, one PR (`step-28-dominio-no-codigo`); nothing configured or deployed (owner steps in `docs/owner-steps.md`, "Domains"):

- **One place for the addresses:** `lib/domains/hosts.ts` reads the platform's address, the admin host, the sites' domain, the previews' origin and the contact emails from the environment; no domain written by hand in copy or templates; the client-domain check refuses the configured hosts; a production build on Vercel refuses missing addresses or the two on one registrable domain.
- **The team's host:** with `NEXT_PUBLIC_ADMIN_HOST`, `/admin` moves to `admin.brotasites.com.br` for good, that host serves only the team's area and signing in, its session is separate (host-only cookie, aal2 kept), and without the variable nothing changes. Tested with a second e2e server.
- **Redirects and headers:** `www.` and the old `brotasites.vercel.app` to the platform (not the cron and jobs calls), the bare sites domain to the platform from the Worker, HSTS in production only (without `includeSubDomains` on client domains, no preload).
- **Contact:** `contato@`, `privacidade@` and `abuso@` in the footer, Ajuda, Termos and Privacidade; email only, no form.

### E27 Polished sign-in and sign-up (owner's requests of 2026-11-09)

One PR (`step-27-login-e-cadastro-polidos`):

- **Light:** cream-gold and leaf tokens, a halo behind the card, broad blurred beams, no hard line under the header, the same look without WebGL; the shader no longer darkens the gold.
- **Passwords (owner's change):** 8 characters is the only requirement; lowercase, uppercase, number and symbol only raise the meter (*Força* on the label row, a thin bar, small pills). Common passwords are shown as *Fraca*, no longer refused.
- **Sign-up card:** 40rem, room to breathe, the terms in one sentence, a footer with the button on the right; it keeps its spacing on short laptops (a short scroll at 1280×600).
- **Sign-in:** the same rhythm; *Cadastre-se* back as a note on top and *Esqueci a senha* under the button (owner's request). Forgot and reset pages inherit it.

### E26 Usability fixes (owner's requests of 2026-11-09)

Six parts, six commits, one PR (`step-26-ajustes-de-uso`):

- **Header:** a visitor sees only "Entrar ou cadastre-se" in the header and the phone menu, on every page; "Criar meu site" stays for signed-in people and in the home page's own buttons.
- **Cursors:** one set of rules in `globals.css` (hand, text bar, not-allowed, progress); disabled controls keep their pointer events; blocked controls say why in text; `e2e/cursors.spec.ts`.
- **Account pages fit:** header, card and compact footer fit 1366×650 and 1280×600 with no scroll; never cut on smaller screens; sign-up in two columns from 768px; a stronger morning light from tokens, with a static CSS glow without WebGL or with reduced motion.
- **Strong passwords:** 10+ characters with lowercase, uppercase, a number and a symbol, not common, not the email or the name (replaced in E27 by 8 characters only); a live checklist, a three-level meter, the repeated password checked by the server too, Caps Lock warning, email typo suggestion; the same rules on reset and change; older passwords still sign in.
- **Meus sites:** "Painel" renamed everywhere, the list back at `/meus-sites` (`/painel` redirects), one card per site with its status badge, sentence and one action, sorted by urgency; account notices in a band only when needed.
- **Loading:** a top progress bar on every click, busy links, prefetch by intent, `loading.tsx` skeletons for every account segment (shown after ~120ms), a layout whose shell never waits for the session, and "Entrando…" until the next page is on screen.

### E25 5 steps and the client's own domain

Three parts, three commits (owner's decisions of 2026-11-04 and 2026-11-05):

- **5 passos:** the promise is "5 passos e seu site pronto" with "Responda, escolha entre 3 visuais e publique." under it. The form has the 5 steps that ask for information; the 5th sends the answers after a short review; choosing the look and publishing (`/meus-sites/<site>/publicar`) are not numbered. Old addresses redirect, old drafts open, the home page stem has 5 points and 2 closings, the share image was redrawn.
- **Domain included:** the client's own domain is included in the price and optional (`customDomainIncluded`); the client still registers and pays for it.
- **Connecting it:** checks on the server (Public Suffix List, reserved and platform names, imitations), `site_domains` with atomic state changes and RLS, a hosting interface with a simulated provider and the Cloudflare for SaaS one (written, not run), DNS steps with copy buttons, "Verificar agora" and a daily check for 7 days, notices, one canonical address in the Worker (www pair, 308), cleanup when a site goes, and the count against the 100 included domains in the team panel.

### E24 Cost control and the team panel

Owner's decisions (2026-11-03): keep the AI art director; model, effort and price unchanged; Turnstile, IP limits and email settings untouched. Built:

- `apps/platform/src/config/limits.ts`: 3 free rounds of directions per site, then 1 per hour (never reset); 1 unpaid site in progress per account; unpaid sites idle for 30 days deleted, with warnings 7 days and 1 day before; a USD to BRL rate for estimates only, marked "to verify".
- The database enforces them (`supabase/migrations/20261103000000_cost_and_admin.sql`): the server routes send the values, validated there, and the client's own calls use the last values sent. Rounds take a row lock; new sites an advisory lock. Proven with two concurrent sessions (`supabase/tests/local/race.sh`).
- Discarding an unpaid site (with confirmation) through the same purge path as account deletion, recorded in `site_removals`.
- `ai_calls`: every model call (directions, copy, review, rewrite) with model, tokens and cost in USD, no prompts; written by the server only, read by the team through functions; rows survive deletion without personal data.
- The team panel: `/admin/visao-geral` (funnel, abandoned sites, cost, BRL estimate, daily budget with the 80% alert), `/admin/custos`, `/admin/contas` (search, filters, sort, pages; each opened account is logged), `/admin/limites` (values in force, dry run, logged exceptions with before and after). The queue shows each site's cost and rounds.
- Daily cleanup inside the existing keep-alive cron: warnings, then removal of due sites in idempotent batches; in doubt, nothing is deleted. Terms and Privacy updated (still pending legal review).

### E22 UX laws

Every screen was measured against the owner's 20 UX laws (19 distinct: Fitts is listed twice) at 360, 768 and 1280px. The report is `docs/ux-audit.md`.

Fixed:

- the form's "Próximo" gave no feedback for 1.65s on a slow phone;
- the site page scrolled sideways at 360px;
- there were no 404 or error pages;
- suspending a site in the team area took one click, next to "Aprovar";
- the dashboard highlighted the same action twice;
- several tap targets were under 44px;
- field errors sat after their hints;
- ".json" in the account page.

The practice is fixed in `docs/ux-laws.md` (rules and checklist), a rule in `CLAUDE.md` and `e2e/ux-laws.spec.ts`. Proposals for the generated sites are recorded in the audit, without changing the catalog.

### E20 Design review

Every screen (home, help, legal, sign-in, sign-up, password, dashboard, account, the seven steps, the site page in each state) captured on phone and desktop and reviewed. Fixed: the broken-canvas icon the hero light left without a GPU, one term for the art directions, the status dot colors, a repeated section title on the account page, a repeated heading and misaligned buttons on the directions, the order of a live site's address and download, a repeated notice on step 6, an orphan word in the hero. Details and what was left for the owner in `docs/owner-steps.md`.

### E19 Copy review

Every client-facing text was cut to what a reader gets at a glance: the home page (hero, facts, features, price, final call), the stem notes, the help answers, the form step descriptions and notes, sign-in and sign-up, the dashboard, the site page, the account page and the email banner. Facts, prices (from `pricing.ts`), the legal review marks and the rules on testimonials stay. "Endereço e mapa" became "Como chegar", matching what client sites have. Legal texts and the admin area were left as they are.

### E14 Home demo (optional)

Removed (owner decision 2026-10-29). The "Experimente aqui" demo, the "Veja um site de verdade" example frame and the `/exemplo` page were taken off the home page in E17; the form always starts empty.
