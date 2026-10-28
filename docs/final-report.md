# Final report (E13)

Date: 2026-10-28. Branch `step-13-final`, on top of the 12 steps merged into `main` (E1 to E12). Everything here was run in a development container; nothing was deployed, no account was created and nothing was bought.

## What is in

| Step | Delivered |
|---|---|
| E1 Baseline | pnpm + Turborepo monorepo, strict TypeScript, Biome, Vitest, Playwright; CI with lint, build, types, unit, database and e2e tests, a dependency audit (high and critical fail) and a secret scan of the whole history (gitleaks); Dependabot. |
| E2 Schema 1.2 | `packages/schema/src/v1.2`: the configuration JSON, the form's step schemas with pt-BR messages, 10 families and 118 categories with the blocked ones, structured opening hours, the JSON Schema generated from Zod. |
| E3 Catalog | 5 personalities, 13 open-license fonts in 9 pairs (served by the sites themselves), OKLCH palettes with AA contrast, shapes, dividers, patterns, original ornaments, photo treatments, seeded backgrounds. |
| E4 Engine | Deterministic identity engine: 3 directions ("Fiel à marca", "Evolução", "Contraste"), diversity between them, a design fingerprint and the minimum distance between sites of the same family and city, identity locking. |
| E5, E6 Template | The Astro template of schema 1.2 with 34 variants across the 10 sections (each one tested in four states: good photo, weak photo, no photo, long text), the default motion in at most 8 KB of JavaScript, content visible without JavaScript, the Motion Lab. |
| E7 Security | Image pipeline (validation by content, re-encoding, EXIF removed, sizes), HTML, CSS and URL sanitizers, the restricted variant dialect, CSP and security headers, a malicious-input suite. |
| E8 AI layer | `AiProvider` with the art director and the copywriter (Claude via the Anthropic SDK, model from `AI_MODEL_ID`), playbooks per family, fact checking, banned phrases, injection defense, cache, per-site and per-day limits, a global budget, fallback to the engine, the 30-business evaluation and an injection corpus, a simulated mode. |
| E9 Reviewer | Deterministic checks (config, built files, Chromium at 360, 768 and 1280 px with axe), the reviewer agent, the fix loop, the calibration set (20 known defects, 5 clean sites). |
| E10 Platform | Sign-in first, the 7-step form saved in the account, "Meus sites" with the 3 directions, the finished site at a private address, changes within the locks, approval and a stub payment; the generation jobs (`apps/jobs`, Trigger.dev, with a local runner); Supabase migrations with RLS on every table. The live preview was removed. |
| E11 Admin | `/admin`: review queue, site page, approve, ask for changes, suspend and lift a suspension, a decision log nobody can rewrite; the catalog promotion cycle (metrics, recommended and retired, variant requests) with capped weights and an exploration quota. |
| E12 Hosting | One Worker serving every site from R2 and Workers KV: versions with rollback, suspension, previews with a token and an expiry, clients' own domains, the signed .zip export, security headers, `BASE_DOMAIN`; tested with Miniflare. |
| E13 Verification | Every suite run (numbers below), Lighthouse, the blind test kit, two template defects and the home page's blocking WebGL found and fixed, a new reviewer check, the README and `docs/owner-steps.md` updated, this report. |

### Found and fixed in E13

Running the whole pipeline on 10 businesses for the blind test kit, with the reviewer's real browser checks, sent all 10 sites to "needs attention". The pipeline tests had not caught it, because they skip the browser checks and the fixture site has a logo:

1. **Header link without a logo:** 40 px tall (under the 44 px target), and its accessible name ("Padaria do Zé, início") did not contain its visible text, which axe flags (`label-content-name-mismatch`). The link is now at least 44 px tall and is named by its own text.
2. **Words broken in the middle of hero titles:** a title too large for its column broke "Forno" into "Forn" / "o" (Chromium has no Portuguese hyphenation on Linux, so it breaks anywhere). The four heroes that use the largest size, and the bento hero's figure, now shrink until the longest word fits its column (a container query, with a class per word length so the strict CSP still holds). The reviewer now flags any word broken in the middle of a heading or of other text of 28 px and up, and sends that section to another variant.

After the fixes the 10 sites pass every browser check of the reviewer, with no finding at all.

Two more fixes came from Lighthouse (the home page's WebGL decorations, under Numbers) and from the container (the template e2e suite now takes `PW_CHROMIUM` like the platform's, and Turborepo passes it on).

## What was cut or left for later

- **Not deployed, by the rules of this work:** the jobs on Trigger.dev, the E10 and E11 migrations on the Supabase project, Cloudflare (R2, KV, the Worker, DNS), the real AI model. All of it is listed, in order, in `docs/owner-steps.md`.
- **Payments:** an interface and a stub only (Asaas is out of scope for now, as planned). Prices live in `apps/platform/src/config/pricing.ts`.
- **Renewal and the end of the 12 months:** the Worker already serves the `grace` and `offline` states, but nothing sets them yet; renewal at R$ 99/year is not built.
- **Custom domains:** the Worker serves them through a KV record; ordering one in the dashboard (+ R$ 97), the DNS instructions for the client and Cloudflare for SaaS are not built.
- **Paid changes after 30 days:** the price is in `pricing.ts`, the flow is not built.
- **Notification emails:** none, by decision (only the magic sign-in link).
- **The restricted code layer** for variants made outside the catalog stays off (`docs/catalog-promotion.md`).
- **E14, the home demo on the engine:** optional, not done; the home page keeps its sample.
- **The blind test itself:** the kit is ready, but the test needs the real model, 10 hand-made sites and 10 to 20 people (owner steps).

## Numbers

### Tests (all green)

| Suite | Result |
|---|---|
| Lint (Biome), build, type-check | pass, 17 tasks |
| Unit and integration (Vitest) | 518 passed: schema 203, reviewer 83, AI 47, generator 41, sites Worker 31, catalog 29, engine 28, templates 25, platform 16, jobs 15 |
| Database (local Postgres 16, every migration) | 6 of 6 check files end with "ALL CHECKS PASSED" (RLS, storage, v1.2, publication, approval, admin) |
| Browser suites | platform (Playwright, phone and desktop: the form, "Meus sites", admin, contrast, touch targets, the home page): 202 passed, 16 skipped (by design per screen size); templates (Playwright, fixtures 1.1 and 1.2, the variant matrix with axe, CSP, sideways scroll and touch targets, 8 KB JavaScript budget): 79 passed, 1 skipped, 1 failed in this container only (below); reviewer (calibration, real build review, broken words): 4 passed; jobs (direction screenshots): 1 passed |
| Dependency audit | no high or critical advisory; 2 low and 3 moderate: `fast-uri` (through `ajv`, in the Trigger.dev CLI and in `@hookform/resolvers`, which the platform lists but never imports; fixed in 3.1.9, released on 2026-10-19, so Dependabot will offer it) and the `esbuild` development server (Trigger.dev CLI only) |
| Secret scan (gitleaks, whole history) | no leaks in the 143 commits of the branch |

The one templates failure, "loads without console errors" on the old 1.1 fixture, is specific to this container: the test aborts the Google Maps iframe, which this container's Chromium (revision 1243, while Playwright 1.64.1 expects 1248) leaves pending, so the page never goes idle. It failed the same way here before any E13 change, the 1.1 template was not touched, and CI runs it with Playwright's own browser.

### AI evaluation (simulated mode)

On the 30 fictional businesses: 61 model calls, every answer valid JSON, no invented fact, no banned phrase, no generic hero; 29 of 30 directions from the art director (one fell back to the engine, as designed) and 30 of 30 copies; smallest distance between the three directions of a site 0.453 and between sites of the same family 0.236. The real model's numbers come from the owner's run (`docs/owner-steps.md`); the simulated mode measures the guards, not the writing.

### Reviewer calibration

20 of 20 known defects caught, no false alarm on the 5 clean sites or on the defective ones.

### Lighthouse

Lighthouse 13.5.0 in headless Chromium, on local servers (performance / accessibility / best practices / SEO):

| Page | Phone | Desktop |
|---|---|---|
| Template fixture, schema 1.2 (every section, photos) | 99 / 100 / 96 / 100 | 100 / 100 / 100 / 100 |
| Kit site: Pizzaria Forno a Lenha (bento hero, no photo) | 100 / 100 / 100 / 60 | 100 / 100 / 100 / 60 |
| Kit site: Chalés Vale Verde (collage hero) | 97 / 100 / 100 / 60 | 100 / 100 / 100 / 60 |
| Kit site: Clique Eterno Fotografia (poster hero) | 97 / 100 / 100 / 60 | 100 / 100 / 100 / 60 |
| Platform home `/` (before the fix below) | 58 / 100 / 100 / 100 | 60 / 100 / 100 / 100 |
| Platform home `/` (after) | 94 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |

The kit sites score 60 in SEO on purpose: the kit adds `noindex` to every page (on a client's live site the same build has no such tag; the fixture shows 100). The fixture's 96 in best practices is one placeholder photo served larger than it is shown. Phone LCP: 1.7 s on the fixture, 1.5 to 2.1 s on the kit sites, 3.0 s on the home page.

**Fixed in E13, the home page's WebGL decorations:** the light rays of the hero and the vine that follows the mouse are WebGL shaders. Where the browser has no GPU to draw them (headless browsers such as the one Lighthouse ran in here, and phones or computers whose GPU the browser blocks), Chrome draws WebGL in software on the main thread, and the page froze: 147 s of total blocking time in the phone test. They now run only when a GPU draws them (`apps/platform/src/components/site/webgl.ts`: no context with a major performance caveat, and none whose renderer is software, such as SwiftShader or llvmpipe), and otherwise the hero shows without the rays, as it already did without WebGL 2. A new e2e test checks that the rays stay off in software.

### Blind test kit, dry run

10 of 10 businesses generated through the whole pipeline (simulated copy), each passing every browser check; assembled with 10 placeholder hand-made pages into 20 numbered sites, with no trace of the tool in the pages or their code, axe clean on every page of the kit, no broken request.

## What depends on the owner

Decisions (see "Decisions to review" in `docs/owner-steps.md`; each can be reversed):

- The `BASE_DOMAIN` for client sites, and registering `brotasites.com` with the INPI check.
- The launch price (197 or 297, `launchPrice` in `pricing.ts`), and the Asaas fees before fixing final prices.
- The SMTP provider for the magic link (suggestion to verify: Resend).
- The repository's visibility (the plan assumes private; it is public).
- The legal texts (Terms, Privacy, guarantee and refund) and invoicing, with a lawyer and an accountant.
- The choices taken under the 2026-10-27 rule: fonts (E3), model Claude Opus 5.5 (E8), Trigger.dev (E10), the form, admin and hosting details, and the blind test design (E13).

Accounts and steps, in order (details in `docs/owner-steps.md`):

1. Supabase: apply the E10 and E11 migrations, make yourself an admin, set the Magic Link template and a custom SMTP.
2. Anthropic: organization, credit, a spend limit, the API key in the hosting's environment (`AI_MODE=live`).
3. Trigger.dev: account, project, `TRIGGER_SECRET_KEY`, deploy `apps/jobs`.
4. Cloudflare: R2 bucket and token, KV namespace and token, the `BASE_DOMAIN` zone, `EXPORT_SECRET`, deploy the Worker and its route; Workers Paid before 100,000 requests a day.
5. Vercel: the environment variables; the Pro plan before charging clients.
6. The blind test: generate with the real model, commission the hand-made half, run it with 10 to 20 people, score.
7. Before selling: the legal review, an external pentest, Asaas.

Costs still marked "to verify" in the account: Trigger.dev machine prices for the Chromium review, Workers KV, the real cost per site of the AI (the estimate is about US$ 0.15 per round on Opus 5.5 plus up to 3 review rounds at about US$ 0.09). `CLAUDE.md` still lists Workers KV as "to verify"; `docs/hosting.md` (Costs) has the numbers found, and the owner can update that row (Claude Code does not edit `CLAUDE.md`).
