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
- Site deployment: no Cloudflare Pages project per client (Pages allows 100 projects per account). One host serves every subdomain: each generated site is uploaded to one Cloudflare R2 bucket under `sites/<subdomain>/`, and a single Cloudflare Worker (`apps/sites-worker`) serves `<subdomain>.brotasites.com` from it. Wrangler deploys that Worker; the generation worker uploads sites through the R2 S3 API. See "Site hosting: options and limits" below.
- AI (Claude via the Anthropic SDK): generates text and adjustments only, always returning JSON validated by the schema. Never generates free-form code.
- Tests: Vitest (schema and generator) and Playwright (end-to-end flow). CI on GitHub Actions.
- Payments: Asaas (Pix and card). Confirm Asaas fees in the account before fixing final prices. Not implemented yet.
- After the MVP: job queue (Inngest or Trigger.dev).
- Main domain: `brotasites.com` (`brotasites.com.br` belongs to a third party). Check INPI before investing in the brand.

## Commercial model (decision of 2026-10-25)

- Creating, editing and previewing is free. Publishing is a one-time payment of R$ 297 per site. No monthly plan.
- Included: 12 months of hosting at `<subdomain>.brotasites.com`, changes through the dashboard for 30 days after publishing, and a static export of the site (the site belongs to the client). After 30 days, changes are paid separately, with the price stated up front.
- After 12 months: optional renewal at R$ 99/year. Without renewal the site goes offline; the client can download it first.
- Custom domain: + R$ 97 to connect. The client registers and pays for the domain.
- 7-day money-back guarantee: text pending legal review.
- Every value lives in `apps/platform/src/config/pricing.ts` (including the optional `launchPrice`, undecided between 197 and 297). Never hard-code a price elsewhere.
- Never compare prices with freelancers or competitors in product copy.

## Site hosting: options and limits

Checked in the official docs on 2026-10-25 (USD, before taxes):

| Option | Limits that matter | Cost |
|---|---|---|
| Cloudflare Pages, one project per client (rejected) | 100 projects per account; 100 custom domains per project on Free | Free |
| **R2 + one Worker (chosen, in code)** | Workers Free: 100,000 requests/day, 10 ms CPU per request, 100 Workers per account; 1,000 routes and 100 custom domains per zone | Free tier, or Workers Paid at $5/month (10M requests and 30M CPU ms included, then $0.30 per million requests and $0.02 per million CPU ms) |
| R2 storage for that Worker | Free tier per month: 10 GB-month, 1M Class A and 10M Class B operations | Then $0.015/GB-month, $4.50 per million Class A, $0.36 per million Class B; egress free |
| Worker with static assets (one Worker, sites bundled in) | 20,000 files per version on Free, 100,000 on Paid; 25 MiB per file; every publish redeploys all sites | Asset requests free |
| Client custom domains (Cloudflare for SaaS, on the `brotasites.com` zone) | 100 custom hostnames included, up to 50,000 | $0.10 per extra hostname/month |

- One `*.brotasites.com/*` route covers every subdomain, so the per-zone limits on routes and custom domains do not grow with clients.
- Move to Workers Paid before the sites near 100,000 requests per day: on Free, requests past the limit fail.
- The platform runs on Vercel Hobby, which Vercel limits to non-commercial, personal use. Move it to Vercel Pro (or another host) before charging clients.

Sources: developers.cloudflare.com (`/pages/platform/limits/`, `/workers/platform/pricing/`, `/workers/platform/limits/`, `/r2/pricing/`, `/cloudflare-for-platforms/cloudflare-for-saas/plans/`) and vercel.com/docs/plans/hobby.

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
│   ├── platform/          # Next.js: dashboard, form, API
│   ├── preview/           # Astro server for the live preview in the form
│   └── sites-worker/      # Cloudflare Worker serving the client sites from R2
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
- Launch price: 197 or 297 (`launchPrice` in `pricing.ts`).
- Legal review of the guarantee, refund and terms texts.
- Asaas fees for Pix and card.
- Registering `brotasites.com` (if not done yet) and the INPI check.
