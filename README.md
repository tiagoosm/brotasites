# BrotaSites

Form-to-landing-page platform for small businesses. The client fills out a short form, and BrotaSites builds and publishes a static landing page for them automatically. No code, no page builder.

> **Status:** built and verified (plan steps E1 to E13), not selling yet. The public site and the form are online at **https://brotasites.vercel.app** (Vercel, Hobby plan, testing only). Built and covered by tests: accounts (sign-up with password and email confirmation, sign-in by password or link, the /conta page, two-step verification for the team), the account dashboard at /painel (pending actions, site status, in-site notices), one header on every page with a profile menu, the 7-step form on schema 1.2 with sign-in first, each site's page (3 directions, the finished site, changes, approval and a stub payment), the identity engine, the AI layer, the reviewer, the generation jobs (`apps/jobs`, Trigger.dev), the admin panel with the catalog promotion cycle, the Worker that serves client sites from R2 and Workers KV (versions, suspension, custom domains, .zip export) and the blind test kit. Not online yet: the jobs on Trigger.dev, the E10 and E11 database migrations, Cloudflare (R2, KV, Worker), the client sites' domain, the real AI model and payments (see `docs/owner-steps.md`). The final report, with what is in, what was cut and the numbers, is [`docs/final-report.md`](docs/final-report.md).
>
> Repository: https://github.com/tiagoosm/brotasites (currently public; visibility to be decided by the owner, see `docs/owner-steps.md`).
>
> **Next:** the owner steps in `docs/owner-steps.md` (accounts, migrations, the real model), then the blind test with real people. The steps are in [`PLAN.md`](PLAN.md).

## Platform hosting

The platform (`apps/platform`) runs on Vercel, project `brotasites`, linked to this repository: every push to `main` deploys to production. Project settings: root directory `apps/platform`; install `pnpm install --frozen-lockfile`; build `cd ../.. && pnpm turbo run build --filter=@brotasites/platform`; environment variables `ENABLE_EXPERIMENTAL_COREPACK=1` (pnpm 12 through Corepack), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_PLATFORM_URL`. The Hobby plan does not allow commercial use; move to Pro before selling.

## How it works

1. The client creates an account (name, email, password, accepted terms; the email is confirmed by link) or signs in, and answers 7 mobile-first steps: business, brand and feeling, sections, content and photos, contact and hours, then sends them (`docs/form-flow.md`). The draft is saved in the account at every step.
2. A job draws 3 art directions with the deterministic identity engine and the AI art director; the client picks one on the site's page, reached from the dashboard (or asks for 3 more). Choosing locks the identity.
3. Another job builds the site: the answers become one configuration JSON (Zod schema 1.2), the AI (Claude) rewrites the text without inventing facts, the reviewer checks it, and a private preview goes up.
4. After a person's review, the client sees the finished site at a private address, asks for changes or approves, and pays once to publish.
5. The site is uploaded to Cloudflare R2 and served on the client sites' own domain (`BASE_DOMAIN`) by a single Cloudflare Worker.

The product UI and the generated sites are in Brazilian Portuguese (pt-BR).

## Stack

| Area | Technology |
| --- | --- |
| Language | TypeScript |
| Monorepo | pnpm + Turborepo |
| Platform (dashboard, form, API) | Next.js (App Router), Tailwind, shadcn/ui |
| Database, auth, storage | Supabase |
| Validation | Zod (`packages/schema`) |
| Generated sites | Astro + Tailwind |
| Site hosting | Cloudflare R2 + one Cloudflare Worker |
| AI | Claude via the Anthropic SDK |
| Tests | Vitest, Playwright |
| CI | GitHub Actions |

## Planned structure

```
apps/
  platform/      Next.js: dashboard, form, API
  jobs/          generation jobs: directions, build, review, preview, publish (Trigger.dev)
  sites-worker/  Cloudflare Worker serving every client site from R2
packages/
  schema/        Zod schema and types (single source of truth)
  catalog/       design tokens, families, personalities, ornaments, variants (E3)
  engine/        deterministic identity engine (E4)
  templates/     Astro landing page templates
  generator/     builds the static site, uploads it to R2, runs the job worker
  ai/            AI providers, playbooks and evaluations (E8)
  reviewer/      deterministic checks and the reviewer agent (E9)
docs/            specification
```

## Getting started

Requirements: Node.js 24+ and pnpm (enable it with `corepack enable pnpm`).

```sh
pnpm install
cp .env.example .env.local   # fill in the values
```

| Script | What it does |
| --- | --- |
| `pnpm build` | Build all packages (Turborepo) |
| `pnpm dev` | Run all dev servers |
| `pnpm test` | Run unit and integration tests (Vitest) |
| `pnpm test:e2e` | Run end-to-end tests in a real browser (Playwright) |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint and check formatting (Biome) |
| `pnpm format` | Fix lint and formatting issues (Biome) |

## Generating a site

After `pnpm build`, generate a site from a config file. Image paths in the config are relative to the config file's folder.

```sh
pnpm --filter @brotasites/generator generate path/to/site-config.json --out ../../out/my-site
```

The config is validated first, with error messages in Portuguese; missing images produce warnings and the site is built without them. Photos uploaded in the form are referenced by URL: the generator downloads them before building (only from Supabase Storage by default, see `allowedHosts`), so sites serve optimized local copies. A 1.2 config (`"schemaVersion": "1.2"`, everything the platform makes) is built with the catalog template (`packages/templates/src/v12`, the identity's variants); a 1.1 config with the old `classico` template.

To work on the form and the dashboard, run `pnpm --filter @brotasites/platform dev` and open http://localhost:3000 (it needs a Supabase project, see below; signing in comes first). Sending the answers queues a job; without `TRIGGER_SECRET_KEY` run the jobs locally with `pnpm --filter @brotasites/jobs dev:local`, which also serves the private previews at http://127.0.0.1:4500. With `PAYMENTS_MODE=stub` the payment screen confirms a test payment without charging.

To work on the templates with live reload, run `pnpm --filter @brotasites/templates dev`. It renders the v1.1 example `docs/legacy/site-config.example.v1.1.json` by default, or the file set in `BROTASITES_CONFIG`. A 1.2 config (`BROTASITES_CONFIG=$PWD/docs/site-config.example.json`) renders the catalog template in `src/v12`; add `BROTASITES_LAB=1` for the Motion Lab at `/motion-lab`.

## AI layer

`packages/ai` proposes the 3 art directions (catalog ids only, checked by the engine) and rewrites the site's text with the family playbooks in `packages/ai/playbooks`. Every answer is validated JSON; facts that are not in the form, banned phrases and links are thrown away, with one retry and then the engine alone. By default it runs in simulated mode, with no API call; `AI_MODE=live` with `AI_MODEL_ID` and `ANTHROPIC_API_KEY` calls Claude. To see the evaluation of the 30 fictional businesses:

```bash
pnpm --filter @brotasites/ai eval
```

## Reviewer

`packages/reviewer` checks every site before a person sees it: the config, the built files (no outside requests, no scripts, safe links, weight), the page in Chromium at 360, 768 and 1280 px (overflow, axe, touch targets, words broken in the middle of large text, reduced motion) and, with `AI_MODE=live`, a reviewer agent that looks at screenshots. Fixable findings go back to the generator for up to 2 rounds. To run the calibration set (20 known defects, 5 clean sites):

```bash
pnpm --filter @brotasites/reviewer calibrate
```

## Accounts

`/cadastro` creates the account (name, email, password, the terms); the confirmation link signs the person in. `/entrar` takes the password or sends a sign-in link; `/esqueci-senha` sends a link to `/redefinir-senha`. `/conta` edits the name and WhatsApp, the email (confirmed by link) and the password, signs out the other devices, downloads the data as JSON and deletes the account. Every request goes through the platform's routes (`/api/auth/*`, `/api/account/*`) with an Origin check, Zod, rate limits per IP and email, and Cloudflare Turnstile checked by Supabase; the signed-in pages are refused on the server (`src/proxy.ts`). Setup (SMTP, Supabase settings, email templates in `docs/email-templates/`, Turnstile, two-step verification for the team) is in `docs/owner-steps.md`, Accounts.

## Admin panel

`/admin` is for the BrotaSites team only (people in the `admins` table, added by the owner; see `docs/owner-steps.md`). The review queue shows the sites waiting for a person (in review, needing attention, suspended). A site's page shows the finished site, the reviewer's findings, the client's answers and the history, and records the decision: approve for the client, ask for changes (the note goes to the copy step), suspend with a reason, or lift a suspension. Every decision is logged and the log cannot be rewritten. `/admin/catalogo` shows the metrics per composition and per variant, marks compositions and variants as recommended or retired, and records requests to the variant factory (`docs/catalog-promotion.md`).

## Blind test kit

The "does not look like AI" criterion (`docs/blind-test.md`) is measured in pairs: 10 fictional businesses, each one made by BrotaSites and by a designer from the same brief, 20 sites shown to 10 to 20 people who answer which one AI made and which one they would rather have.

```sh
pnpm --filter @brotasites/jobs blind-test generate   # the BrotaSites half through the real pipeline (AI_MODE=live for the real test)
pnpm --filter @brotasites/jobs blind-test assemble   # mixes in the hand-made half: anonymized, numbered at random
pnpm --filter @brotasites/jobs blind-test serve      # serves the participants' pages on :4600
pnpm --filter @brotasites/jobs blind-test score      # reads the answers and says whether the target was met
```

## Publishing

Every state change goes through a database function that checks the owner and queues a job (`supabase/migrations`); the platform then starts the job on Trigger.dev. `apps/jobs` runs three kinds of job (`docs/hosting.md`): `directions`, `build` and `publish`, which only runs with a paid publish payment. Each job is retried once; then the site goes to "needs attention".

```sh
pnpm --filter @brotasites/jobs dev:local     # local runner: takes queued jobs, serves previews on :4500
pnpm --filter @brotasites/jobs exec trigger deploy   # owner step: deploy the tasks to Trigger.dev
```

The jobs need `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` (never in the browser), and the R2 variables (`CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) for the previews and publishing. Each build goes to the R2 bucket `brotasites-sites` under `sites/<subdomain>/<deploy id>/`, with a .zip of it under `exports/`, and then the site's record in Workers KV switches to it (`CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_KV_API_TOKEN`), keeping the previous version for a rollback, so visitors never see a half-updated site; previews go under `previews/<site id>/<token>/`. A single Worker, [`apps/sites-worker`](apps/sites-worker), serves sites, previews, suspended pages, clients' own domains and the signed .zip download (`docs/hosting.md`). Run it locally with `pnpm --filter @brotasites/sites-worker dev` (Miniflare, local R2 and KV). Cloudflare setup is an owner step (`docs/owner-steps.md`).

Sites of schema 1.1 (made before E10) are still built by the old worker: `pnpm --filter @brotasites/generator worker`.

## Supabase

The platform keeps accounts and drafts in Supabase (project `brotasites`, region sa-east-1). Schema and row level security live in [`supabase/migrations`](supabase/migrations); [`supabase/tests/rls.sql`](supabase/tests/rls.sql) checks the access rules and leaves nothing behind.

Photos and logos go to the private `site-uploads` Storage bucket under `<user id>/<site id>/`; each person can only write to their own folder, and the jobs clean every file before a site uses it. The form shrinks photos to WebP (2000px at most) before uploading. Direction screenshots go to the private `site-renders` bucket, which only the server signs. [`supabase/tests/local/run.sh`](supabase/tests/local/run.sh) applies every migration to a throwaway local Postgres and runs all the checks (CI runs it too).

Copy `.env.example` to `apps/platform/.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and, for approval and the dashboard's screenshots, `SUPABASE_SECRET_KEY`. Without Supabase the form shows that it is unavailable.

Dashboard settings (Authentication):

- **URL Configuration:** add `http://localhost:3000/**` (and later the production domain) to Redirect URLs.
- **Email templates:** the four pt-BR templates of `docs/email-templates/` (confirmation, sign-in link, password reset, email change), which link to `/auth/confirm` with a `token_hash`, so the link also works when opened on another device. The rest of the Authentication settings are in `docs/owner-steps.md`, Accounts.
- **SMTP:** the built-in sender is rate limited and meant for testing; production needs a custom SMTP provider.

## Tests

- **Platform (Playwright):** accounts end to end against a fake Supabase server (`e2e/support/fake-supabase.mjs`: sign-up, confirmation, sign-in, links, reset, email change, data export, deletion, the security checks), the 7-step form, the dashboard (`/painel`, served from the fake Supabase server), the directions, approval and the stub payment, against a fake Supabase answered in the browser (`apps/platform/e2e/support/supabase.ts`), plus WCAG AA contrast and 44px touch targets on the public and signed-in pages. Run with `pnpm --filter @brotasites/platform test:e2e`.
- **Database:** `bash supabase/tests/local/run.sh` (local Postgres 16 with a Supabase stand-in): every migration and the checks that one person never reaches another's data.
- **Unit (Vitest):** the Zod schema, the generator's validation and build, and the template helpers (opening hours, contrast, links, theme, fonts).
- **Reviewer (Vitest + Chromium):** `pnpm --filter @brotasites/reviewer test:e2e` runs the calibration set (20 known defects caught, no false alarm on 5 clean sites), reviews a real build of the fixture end to end and checks the broken-word detection.
- **Jobs (Vitest + Chromium):** the pipeline from the answers to the live site with the store in memory, the blind test kit (`pnpm --filter @brotasites/jobs test`), and the direction screenshots in a real browser (`test:e2e`).
- **End-to-end (Playwright):** builds a fixture site with every section on (`packages/templates/e2e/fixture`) and checks it at desktop and 375px widths: section order, SEO metadata, images, navigation and mobile menu, FAQ, WhatsApp links, the open/closed door sign at fixed times, and reduced motion. A second fixture (`e2e/fixture-v12`) covers the 1.2 template at 1280 and 360px under the sites' CSP, with axe, the JS budget, no-JS and reduced-motion checks; a matrix of sites (`e2e/build-matrix.mjs`) runs every catalog variant through axe, CSP, sideways-scroll and touch-target checks. External requests are blocked so the run is hermetic.

The first e2e run needs the browser: `pnpm --filter @brotasites/templates exec playwright install chromium` (or set `PW_CHROMIUM` to a Chromium binary you already have; Turborepo passes it to every task). GitHub Actions runs lint, build, type-check, unit and e2e tests on every push and pull request, plus a dependency audit (fails on high and critical advisories) and a secret scan of the whole history (gitleaks). Dependabot opens weekly update pull requests.

## Documentation

- [`PLAN.md`](PLAN.md): build plan, one step and one pull request at a time
- [`CLAUDE.md`](CLAUDE.md): project conventions, decisions and AI rules
- [`docs/product.md`](docs/product.md): pricing, what is included, site statuses
- [`docs/form-flow.md`](docs/form-flow.md): the 7 form steps (target flow)
- [`docs/schema-1.2.md`](docs/schema-1.2.md): configuration JSON (v1.2); v1.1 in [`docs/legacy/`](docs/legacy/)
- [`docs/site-config.example.json`](docs/site-config.example.json): filled-in example (a bakery), v1.2, and [`docs/site-config.schema.json`](docs/site-config.schema.json), its JSON Schema generated from Zod
- [`docs/categories.md`](docs/categories.md): families, categories and blocked categories
- [`docs/art-direction.md`](docs/art-direction.md) and [`docs/default-motion.md`](docs/default-motion.md): how client sites look and move
- [`docs/ai-and-reviewer.md`](docs/ai-and-reviewer.md): AI layer and reviewer
- [`docs/security.md`](docs/security.md) and [`docs/abuse-and-content.md`](docs/abuse-and-content.md): security and abuse policy
- [`docs/hosting.md`](docs/hosting.md): client site hosting
- [`docs/catalog-promotion.md`](docs/catalog-promotion.md) and [`docs/blind-test.md`](docs/blind-test.md): how the catalog grows and how quality is judged
- [`docs/owner-steps.md`](docs/owner-steps.md): accounts and decisions that depend on the owner
- [`docs/final-report.md`](docs/final-report.md): the final verification (E13): what is in, what was cut, numbers
- [`docs/platform-design.md`](docs/platform-design.md) and [`docs/platform-copy.md`](docs/platform-copy.md): the platform's own look and copy

## License

Proprietary. All rights reserved. This repository is not licensed for use, copying or distribution.
