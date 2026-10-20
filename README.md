# BrotaSites

Form-to-landing-page platform for small businesses. The client fills out a short form, and BrotaSites builds and publishes a static landing page for them automatically. No code, no page builder.

> **Status:** early development. Only the specification exists so far; the monorepo is being set up.

## How it works

1. The client answers a short, mobile-first form (business, template, colors, sections, content, contact details).
2. The answers become a single configuration JSON, validated by a Zod schema.
3. AI (Claude) suggests and polishes copy only. It never invents facts and never writes code.
4. A generator renders the JSON with an Astro template into static HTML.
5. The site is deployed to Cloudflare Pages at `client.brotasites.com`.

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
| Site hosting | Cloudflare Pages |
| AI | Claude via the Anthropic SDK |
| Tests | Vitest, Playwright |
| CI | GitHub Actions |

## Planned structure

```
apps/
  platform/      Next.js: dashboard, form, API
  preview/       Astro server that renders the live preview
packages/
  schema/        Zod schema and types (single source of truth)
  templates/     Astro landing page templates
  generator/     reads the JSON and builds the static site
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

The config is validated first, with error messages in Portuguese; missing images produce warnings and the site is built without them. Only the `classico` template is available so far.

To work on the form, run `pnpm dev` (or the platform and preview apps on their own) and open http://localhost:3000. The live preview comes from `apps/preview` on port 4400: an Astro server that renders the real template from the draft the form posts. The draft is saved in the browser for now.

To work on the templates with live reload, run `pnpm --filter @brotasites/templates dev`. It renders `docs/site-config.example.json` by default, or the file set in `BROTASITES_CONFIG`.

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
