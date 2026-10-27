# BrotaSites

Platform where a client answers 7 guided questions and gets a landing page published, without ever seeing code. Each site comes from a deterministic identity engine, an AI layer that acts as art director, an automatic reviewer and, at first, a human reviewer. Landing pages only for now.

Project owner: Tiago da Silva Machado (github.com/tiagoosm). Product language (UI and generated site content): Brazilian Portuguese (pt-BR).

## Language rules

- Repository language is English: code, file and variable names, code comments, commit messages, README, everything in `docs/`, PR titles and descriptions unless the owner asks otherwise, and repo metadata.
- Product content stays in pt-BR: generated site text, form, dashboard and admin UI copy, validation messages shown to users, AI playbooks' example copy, and sample data (e.g. Padaria do Zé).
- Chat with the project owner is in Portuguese.

## How to work on this project

- Work in steps (PLAN.md). One branch per step (`step-N-name`), one pull request per step, never merged without the owner's OK. Stop at the end of each step and show a short summary.
- When a step says ASK THE OWNER, present the options with costs and limits checked in the official documentation and wait for the choice.
- Run lint, tests and build before saying a step is done.
- Do not install technologies outside the stack below without asking. Pin stable versions in `package.json`. Never use `latest`.
- Never commit secrets (API keys, tokens). Use `.env.local` (gitignored) and keep a `.env.example` up to date.
- Small commits, messages in English in the imperative mood (e.g. "Add Zod schema for the landing page").
- Ask before any irreversible or paid action. Do not create accounts, buy anything or deploy to production. Anything that depends on an owner account goes into `docs/owner-steps.md`.
- Check prices, limits and licenses in the official documentation before stating them. If that is not possible, mark them "to verify" and tell the owner.
- If something in the docs contradicts what you find in the code or in a provider's documentation, stop and tell the owner.
- Claude Code Skills may be used to build. The running product never uses Anthropic Skills: it uses the playbooks in the repository.

## Stack (decided)

- TypeScript everywhere. Monorepo with pnpm + Turborepo.
- Platform (form, client dashboard, admin, API): Next.js (App Router), Tailwind and shadcn/ui, hosted on Vercel. The Hobby plan is limited to non-commercial, personal use: move to Pro before charging clients.
- Database, auth (magic link) and file storage: Supabase, for platform data only. RLS on every table.
- Validation: Zod in `packages/schema`, the single source of truth for the form, API, AI, engine and generator. Spec: `docs/schema-1.2.md`.
- Generated sites: Astro + Tailwind, static HTML, no database, no external requests.
- Site hosting: one Cloudflare Worker + R2 + KV, on a base domain separate from the platform's (`BASE_DOMAIN`). Client custom domains through Cloudflare for SaaS. See "Site hosting: options and limits" and `docs/hosting.md`.
- AI: Claude through the Anthropic SDK, behind an `AiProvider` interface. The model comes from an environment variable.
- Job queue: Inngest or Trigger.dev (owner's choice in step E10).
- Tests: Vitest, Playwright, axe, Lighthouse. CI on GitHub Actions.
- Payments: Asaas (Pix and card). Out of scope for now: an interface and a stub only. Confirm Asaas fees in the account before fixing final prices.

## Commercial model (decision of 2026-10-25)

- Creating, editing and seeing the directions and the finished site is free. Publishing is a one-time payment of R$ 297 per site. No monthly plan. No watermark on client sites.
- Included: 12 months of hosting, changes through the dashboard for 30 days after publishing, and a static export of the site (the site belongs to the client). After 30 days, changes are paid separately, with the price stated up front.
- After 12 months: optional renewal at R$ 99/year. Without renewal the site goes into a grace period and then offline; the client can download it first.
- Custom domain: + R$ 97 to connect. The client registers and pays for the domain.
- 7-day money-back guarantee: text pending legal review.
- Every value lives in `apps/platform/src/config/pricing.ts` (including the optional `launchPrice`, undecided between 197 and 297). Never hard-code a price elsewhere.
- Never compare prices with freelancers or competitors in product copy.

## Product rules

- No loading screen: generation is asynchronous. The client sends the form and can close the page; status shows on the "Meus sites" tab of the dashboard. No notification emails in this round; the only email sent is the magic sign-in link.
- There is no live preview while answering the form (decision of 2026-10-27). The client sees only the 3 art directions and the finished site (private address, not indexed, with a token).
- Directions: "Fiel à marca", "Evolução", "Contraste". Unlimited redos until one is approved. After approval the identity is locked; only content, images, contact details, sections and colors (with AA contrast) can change.
- Every site goes through the automatic reviewer and, at first, through human review in the admin queue.
- No contact form, no analytics, no cookies on client sites. Contact through WhatsApp (wa.me), phone and email. Maps only as a "Como chegar" link button.

## Site hosting: options and limits

Checked in the official docs on 2026-10-25 (USD, before taxes):

| Option | Limits that matter | Cost |
|---|---|---|
| Cloudflare Pages, one project per client (rejected) | 100 projects per account; 100 custom domains per project on Free | Free |
| **R2 + one Worker (chosen, in code)** | Workers Free: 100,000 requests/day, 10 ms CPU per request, 100 Workers per account; 1,000 routes and 100 custom domains per zone | Free tier, or Workers Paid at $5/month (10M requests and 30M CPU ms included, then $0.30 per million requests and $0.02 per million CPU ms) |
| R2 storage for that Worker | Free tier per month: 10 GB-month, 1M Class A and 10M Class B operations | Then $0.015/GB-month, $4.50 per million Class A, $0.36 per million Class B; egress free |
| Worker with static assets (one Worker, sites bundled in) | 20,000 files per version on Free, 100,000 on Paid; 25 MiB per file; every publish redeploys all sites | Asset requests free |
| Client custom domains (Cloudflare for SaaS, on the `BASE_DOMAIN` zone) | 100 custom hostnames included, up to 50,000 | $0.10 per extra hostname/month |
| Workers KV (site pointers and status) | to verify when implementing (E12) | to verify |

- Client sites live on `BASE_DOMAIN` (decision of 2026-10-27), not on the platform's domain, so an abusive site cannot hurt the platform's reputation and platform cookies never reach client sites. `BASE_DOMAIN` is still to be chosen by the owner; use `sites.localhost` in development.
- One `*.BASE_DOMAIN/*` route covers every subdomain, so the per-zone limits on routes and custom domains do not grow with clients.
- Move to Workers Paid before the sites near 100,000 requests per day: on Free, requests past the limit fail.

Sources: developers.cloudflare.com (`/pages/platform/limits/`, `/workers/platform/pricing/`, `/workers/platform/limits/`, `/r2/pricing/`, `/cloudflare-for-platforms/cloudflare-for-saas/plans/`) and vercel.com/docs/plans/hobby.

## AI rules (non-negotiable)

- Never invent testimonials, reviews, numbers, statistics, awards, badges, certifications or contact details.
- The testimonials section can only be enabled with at least one real, authorized testimonial.
- Factual content (prices, opening hours, address, years in business, professional registration) comes only from the form. The AI only rewrites and organizes it.
- Fields edited by hand by the client are listed in `ai.userEditedFields` and are never overwritten.
- Never generate photos of the business and never redraw the logo. Without a logo, generate a monogram.
- The AI returns JSON validated against a closed catalog. It never produces URLs and never produces JavaScript.
- The AI never receives secrets or tools. Client text always goes in as delimited data.
- If the output fails validation: retry once; then use the engine alone; if that also fails, set the site to "needs attention" and alert the admin.

## Structure

```
brotasites/
├── apps/
│   ├── platform/          # Next.js: form, client dashboard, admin, API
│   ├── preview/           # live preview server: removed in E10 (no live preview)
│   └── sites-worker/      # Cloudflare Worker serving client sites from R2 + KV
├── packages/
│   ├── schema/            # Zod + types (the heart of the project)
│   ├── catalog/           # tokens, families, personalities, ornaments, variants
│   ├── engine/            # deterministic identity engine
│   ├── templates/         # Astro: sections and variants
│   ├── generator/         # JSON + identity -> static site
│   ├── ai/                # providers, playbooks, evaluations
│   └── reviewer/          # deterministic checks + reviewer agent
├── supabase/              # migrations and RLS tests
├── docs/
├── CLAUDE.md
├── PLAN.md
├── THIRD_PARTY_LICENSES.md
└── README.md
```

## Reference documents (`docs/` folder)

- `product.md`: pricing, what is included, site statuses, payments.
- `form-flow.md`: the 7 form steps, minimum to generate, missing data.
- `schema-1.2.md`: the configuration JSON (replaces v1.1, kept in `docs/legacy/`).
- `site-config.example.json`: filled-in example (Padaria do Zé). Still v1.1 until E2.
- `categories.md`: families, categories, blocked categories and per-topic rules.
- `art-direction.md`: personalities, design tokens, typography, heroes, variant tests.
- `default-motion.md`: the single motion choreography of generated sites.
- `ai-and-reviewer.md`: AI providers, art director, copy, evaluations, reviewer.
- `security.md`, `abuse-and-content.md`: security requirements and abuse policy.
- `hosting.md`: Worker, R2, KV, publishing, custom domains.
- `catalog-promotion.md`: how the catalog grows; restricted code layer (off).
- `blind-test.md`: the "does not look like AI" criterion.
- `owner-steps.md`: accounts and decisions that depend on the owner.
- `platform-design.md`, `platform-copy.md`: the platform's own look and copy (not client sites).

## Open questions (owner's decision)

- Job queue and AI model (steps E10 and E8, with checked options).
- SMTP provider for the magic link (suggestion to verify: Resend).
- `BASE_DOMAIN` for client sites.
- Legal texts (Terms, Privacy, guarantee and refund) and invoicing: with a lawyer and an accountant.
- Launch price: 197 or 297 (`launchPrice` in `pricing.ts`).
- Asaas fees for Pix and card.
- Repository visibility: the master plan assumes a private repository; it is currently public.
- Registering `brotasites.com` (if not done yet) and the INPI check.
