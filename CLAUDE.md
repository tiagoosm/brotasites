# BrotaSites

Platform where a client fills out a form and gets a landing page published automatically, without ever seeing code. Landing pages only for now.

Project owner: Tiago da Silva Machado (github.com/tiagoosm). Product language (UI and generated site content): Brazilian Portuguese (pt-BR).

## Language rules

- Repository language is English: code, file and variable names, code comments, commit messages, README, everything in `docs/`, and repo metadata.
- Product content stays in pt-BR: generated site text, form and dashboard UI copy, validation messages shown to users, and sample data (e.g. Padaria do Zé).
- Chat with the project owner is in Portuguese.

## How to work on this project

- Do one step at a time, show what changed, and run the tests before moving on.
- Do not install technologies outside the stack below without asking.
- Pin stable versions in `package.json`. Never use `latest`.
- Never commit secrets (API keys, tokens). Use `.env.local` (gitignored) and keep a `.env.example` up to date.
- Small commits, messages in English in the imperative mood (e.g. "Add Zod schema for the landing page").
- Ask before any irreversible or paid action (buying a domain, publishing to production, creating paid projects).

## Decisions already made

- Language: TypeScript everywhere. Monorepo with pnpm + Turborepo.
- Platform (dashboard, form, API): Next.js (App Router), Tailwind and shadcn/ui.
- Database, auth (magic link) and file storage: Supabase. Stores platform data only (`users`, `sites`, `site_configs`, `jobs`, `assets`). Client sites are static, with no database.
- Validation: Zod in `packages/schema`, the single source of truth for the form, API, AI and generator. Initial reference: `docs/site-config.schema.json` (version 1.1).
- Generated sites: Astro + Tailwind, static HTML, built from the configuration JSON.
- Site deployment: Cloudflare Pages (one project per client), at `client.brotasites.com`.
- AI (Claude via the Anthropic SDK): generates text and adjustments only, always returning JSON validated by the schema. Never generates free-form code.
- Tests: Vitest (schema and generator) and Playwright (end-to-end flow). CI on GitHub Actions.
- After the MVP: job queue (Inngest or Trigger.dev) and payments (Asaas or Mercado Pago).

## AI rules (non-negotiable)

- Never invent testimonials, reviews, numbers, awards, certifications or contact details.
- The testimonials section can only be enabled if the client provides at least one real testimonial.
- Factual content (prices, opening hours, address, years in business) comes only from the form. The AI only rewrites and organizes it.
- Fields edited by hand by the client are listed in `ai.userEditedFields` and are never overwritten.
- If the AI output fails validation: retry once, then mark the site as "in review".

## Planned structure

```
brotasites/
├── apps/
│   └── platform/          # Next.js: dashboard, form, API
├── packages/
│   ├── schema/            # Zod + types (the heart of the project)
│   ├── templates/         # Astro landing page templates
│   └── generator/         # reads the JSON and builds the static site
├── docs/                  # JSON schema, example and form flow
├── CLAUDE.md
└── README.md
```

## Reference documents (`docs/` folder)

- `site-config.schema.json`: format of the configuration JSON (v1.1).
- `site-config.example.json`: filled-in example (Padaria do Zé).
- `form-flow.md`: form steps and which fields each step fills in.

## Open questions

- How many templates at launch (suggestion: 2 or 3 polished ones).
- Payment before or after generation.
- Policy for included adjustments after publishing.
- Domain and brand: `brotasites.com.br` is already registered by a third party. Suggested main domain: `brotasites.com`. Check INPI (Brazilian trademark office) before investing in the brand.
