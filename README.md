# BrotaSites

Form-to-landing-page platform for small businesses. The client fills out a short form, and BrotaSites builds and publishes a static landing page for them automatically. No code, no page builder.

> **Status:** in development. The public site and the form are online at **https://brotasites.vercel.app** (Vercel, Hobby plan, testing only). The seven-question form, accounts (magic link), photo uploads, the publishing queue, the static site generator and the Worker that serves client sites are built and covered by tests. Not online yet: the live preview server, site generation and publishing (Cloudflare), and the `brotasites.com` domain.
>
> Repository: https://github.com/tiagoosm/brotasites (private)

## Platform hosting

The platform (`apps/platform`) runs on Vercel, project `brotasites`, linked to this repository: every push to `main` deploys to production. Project settings: root directory `apps/platform`; install `pnpm install --frozen-lockfile`; build `cd ../.. && pnpm turbo run build --filter=@brotasites/platform`; environment variables `ENABLE_EXPERIMENTAL_COREPACK=1` (pnpm 12 through Corepack), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_PLATFORM_URL`. The Hobby plan does not allow commercial use; move to Pro before selling.

## How it works

1. The client answers a short, mobile-first form (business, template, colors, sections, content, contact details).
2. The answers become a single configuration JSON, validated by a Zod schema.
3. AI (Claude) suggests and polishes copy only. It never invents facts and never writes code.
4. A generator renders the JSON with an Astro template into static HTML.
5. The site is uploaded to Cloudflare R2 and served at `client.brotasites.com` by a single Cloudflare Worker.

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
  preview/       Astro server that renders the live preview
  sites-worker/  Cloudflare Worker serving every client site from R2
packages/
  schema/        Zod schema and types (single source of truth)
  templates/     Astro landing page templates
  generator/     builds the static site, uploads it to R2, runs the job worker
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

The config is validated first, with error messages in Portuguese; missing images produce warnings and the site is built without them. Photos uploaded in the form are referenced by URL: the generator downloads them before building (only from Supabase Storage by default, see `allowedHosts`), so sites serve optimized local copies. Only the `classico` template is available so far.

To work on the form, run `pnpm dev` (or the platform and preview apps on their own) and open http://localhost:3000. The live preview comes from `apps/preview` on port 4400: an Astro server that renders the real template from the draft the form posts. The draft is saved in the browser, and in the account once the person signs in.

To work on the templates with live reload, run `pnpm --filter @brotasites/templates dev`. It renders `docs/site-config.example.json` by default, or the file set in `BROTASITES_CONFIG`.

## Publishing

The last question reserves the site address and queues a generation job (`request_publication` in [`supabase/migrations`](supabase/migrations)). The worker takes queued jobs, turns the draft into the final config (the Zod schema has the last word), builds the site with the generator and records the result; the client follows it at `/meu-site`.

```sh
pnpm --filter @brotasites/generator worker          # keeps running, one job at a time
pnpm --filter @brotasites/generator worker --once   # processes one job and stops
```

The worker needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` in its environment (never in the browser).

Sites go live through Cloudflare: the worker uploads each build to the R2 bucket `brotasites-sites` under `sites/<subdomain>/<deploy id>/` and then switches `sites/<subdomain>/current`, so visitors never see a half-updated site. A single Worker, [`apps/sites-worker`](apps/sites-worker), serves `<subdomain>.brotasites.com` from the bucket. Without the R2 variables (`CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) built sites wait in "publishing".

One-time Cloudflare setup (not done yet). Testing needs no domain:

1. Create the R2 bucket `brotasites-sites` and an R2 API token with Object Read & Write on it (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`).
2. Deploy the Worker: `pnpm --filter @brotasites/sites-worker deploy` (uses `CLOUDFLARE_API_TOKEN`). It answers on its free address, `https://brotasites-sites.<account>.workers.dev`.
3. Set `NEXT_PUBLIC_SITES_TEST_URL` to that address, so "Abrir o meu site" links to `https://brotasites-sites.<account>.workers.dev/<subdomain>/`.

On the workers.dev address sites open by path and are marked `noindex`; the Worker remembers the open site in a cookie so its files load. Later, with a domain:

4. Add the `brotasites.com` zone to Cloudflare, uncomment the route in [`apps/sites-worker/wrangler.jsonc`](apps/sites-worker/wrangler.jsonc) and deploy again.
5. Add a proxied wildcard DNS record `*` so subdomains reach the Worker, and clear `NEXT_PUBLIC_SITES_TEST_URL`.

## Supabase

The platform keeps accounts and drafts in Supabase (project `brotasites`, region sa-east-1). Schema and row level security live in [`supabase/migrations`](supabase/migrations); [`supabase/tests/rls.sql`](supabase/tests/rls.sql) checks the access rules and leaves nothing behind.

Photos go to the public `site-images` Storage bucket under `<user id>/<site id>/`; each person can only write to their own folder. The form shrinks photos to WebP (2000px at most) before uploading, and uploading requires signing in.

Copy `.env.example` to `apps/platform/.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Without them the form still works and saves drafts only on the device.

Dashboard settings (Authentication):

- **URL Configuration:** add `http://localhost:3000/**` (and later the production domain) to Redirect URLs.
- **Email templates, Magic Link:** link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/criar/negocio` so the link also works when opened on another device.
- **SMTP:** the built-in sender is rate limited and meant for testing; production needs a custom SMTP provider.

## Tests

- **Unit (Vitest):** the Zod schema, the generator's validation and build, and the template helpers (opening hours, contrast, links, theme, fonts).
- **End-to-end (Playwright):** builds a fixture site with every section on (`packages/templates/e2e/fixture`) and checks it at desktop and 375px widths: section order, SEO metadata, images, navigation and mobile menu, FAQ, WhatsApp links, the open/closed door sign at fixed times, and reduced motion. External requests are blocked so the run is hermetic.

The first e2e run needs the browser: `pnpm --filter @brotasites/templates exec playwright install chromium`. GitHub Actions runs lint, build, type-check, unit and e2e tests on every push and pull request.

## Documentation

- [`docs/site-config.schema.json`](docs/site-config.schema.json): configuration JSON format (v1.1)
- [`docs/site-config.example.json`](docs/site-config.example.json): filled-in example (a bakery)
- [`docs/form-flow.md`](docs/form-flow.md): form steps and the fields each one fills in
- [`docs/platform-design.md`](docs/platform-design.md): platform art direction (Herbarium)
- [`docs/platform-copy.md`](docs/platform-copy.md): slogan, marketing copy and the seven form questions
- [`CLAUDE.md`](CLAUDE.md): project conventions, decisions and AI rules

## License

Proprietary. All rights reserved. This repository is private and is not licensed for use, copying or distribution.
