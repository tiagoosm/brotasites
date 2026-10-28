# Steps that depend on the owner (accounts and decisions)

Keep this list up to date during the project. Claude Code does not create accounts and does not deploy.

- [ ] Choose the `BASE_DOMAIN` for client sites and register it; turn on the transfer lock; request inclusion in the Public Suffix List.
- [ ] Accounts: Supabase, Vercel (Pro plan before charging clients), Cloudflare, email/SMTP provider, Asaas, GitHub (2FA).
- [ ] Set up a custom SMTP in Supabase (the default only delivers to the project team and has a low limit). Suggestion to verify: Resend.
- [ ] Apply the E10 migrations to the Supabase project (`supabase/migrations/20261028000000_platform_v12.sql` and `20261028010000_approval.sql`), for example with `supabase db push`, after checking them on a branch or a copy. They were tested only on a local Postgres (`bash supabase/tests/local/run.sh`). Then run the checks in `supabase/tests` in the SQL editor: each one must end with "ALL CHECKS PASSED".
- [ ] Supabase Authentication, Magic Link template: change the link's `next` to `/criar` (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/criar`). Old links to `/criar/negocio` still work: they lead to `/criar`.
- [ ] Vercel environment variables for E10: `SUPABASE_SECRET_KEY` (server only), `TRIGGER_SECRET_KEY`, `NEXT_PUBLIC_PREVIEW_ORIGIN` (`https://previa.<BASE_DOMAIN>` once the domain exists), `NEXT_PUBLIC_BASE_DOMAIN`, and `PAYMENTS_MODE`. Leave `PAYMENTS_MODE` empty in production until Asaas is in: `stub` shows a test payment screen that confirms without charging.
- [ ] Trigger.dev (queue chosen in E10, see "Decisions to review"): create the account and a project, then put `TRIGGER_SECRET_KEY` in the Vercel environment variables and deploy `apps/jobs` with `pnpm --filter @brotasites/jobs exec trigger deploy`. Until then the jobs run with the local runner (`pnpm --filter @brotasites/jobs dev:local`).
- [ ] Anthropic: create the organization in the Claude Console (platform.claude.com), add credit, set a monthly spend limit there, create an API key and put it only in the hosting's environment variables as `ANTHROPIC_API_KEY`, with `AI_MODE=live` and `AI_MODEL_ID`. Until then the platform runs in simulated mode (no API call).
- [ ] Optional: run the 30-business evaluation against the real model (`AI_MODE=live AI_MODEL_ID=claude-opus-5-5 ANTHROPIC_API_KEY=... pnpm --filter @brotasites/ai eval`) and keep the numbers as the baseline. Each full run is about 60 model calls; see the cost estimate below.
- [ ] Legal review: Terms, Privacy, guarantee and refund. Invoicing with an accountant.
- [ ] GitHub settings (Settings > Advanced Security): turn on Dependabot alerts and security updates, and secret scanning with push protection (free on public repositories; check the plan if the repository becomes private). CI also scans for secrets with gitleaks and audits dependencies on every push.
- [ ] External pentest before selling.
- [ ] Check INPI before investing in the brand.
- [ ] Decide the repository's visibility: the master plan assumes a private repository, and `tiagoosm/brotasites` is public. Adapted React Bits code (`side-rays.tsx`, `vine-trail.tsx`) is visible while it is public.

## Decisions to review

Since 2026-10-27 the owner does not approve each task. Choices the plan reserved for the owner are taken with the recommended option and listed here; any of them can be reversed.

- **E3, fonts of client sites:** 13 open-license (SIL OFL 1.1) families, licenses checked in the Google Fonts repository: Fraunces, Instrument Serif, DM Serif Display, Cormorant Garamond, Young Serif, Bricolage Grotesque, Space Grotesk, Manrope, DM Sans, Fredoka, Baloo 2, Caveat and Kalam, in 9 pairs (`packages/catalog/src/fonts.ts`). Playfair Display was left out: its name is a Reserved Font Name, and the OFL treats the subset we ship as a modified version. To see them, run `pnpm --filter @brotasites/catalog specimen` and open `packages/catalog/dist/specimen/index.html`.
- **E6, taste calibration (food):** the first variants, `hero-feast`, `sobre-manifesto` and `servicos-menu`, were rendered in the four states (good photo, weak photo, no photo, long text) at 360 and 1280 px and sent to the owner on 2026-10-27; production went on with that taste. To see them again: `node packages/templates/scripts/variant-states.mjs --out /tmp/states --hero hero-feast --sobre sobre-manifesto --servicos servicos-menu`, then open `/tmp/states/index.html`.
- **E8, AI model:** `claude-opus-5-5` (Claude Opus 5.5), set by `AI_MODEL_ID`, with effort `medium`. Prices checked on 2026-10-27 at platform.claude.com/docs/en/about-claude/pricing (USD per million tokens, before taxes):

  | Model | Input | Output | Cache read | Notes |
  |---|---|---|---|---|
  | Claude Opus 5.5 (chosen) | $4 | $20 | $0.20 | Default model of the current line; 1M context, 128K output |
  | Claude Sonnet 5.5 | $2 | $10 | $0.10 | Half the price; the alternative if the cost per site matters more |
  | Claude Haiku 5.5 | $0.10 | $0.50 | $0.01 | Cheapest; a risk for Portuguese copy quality |
  | Claude Fable 5.1 | $10 | $50 | $0.25 | Most capable, not needed for this task |

  Estimate (to verify with the live evaluation, since thinking tokens vary): one round of directions plus copy sends about 7,000 input tokens and gets up to about 6,000 output tokens, so about US$ 0.15 per round on Opus 5.5 (US$ 0.30 with a retry) and about half on Sonnet 5.5. With the default limits (20 rounds per site per day, US$ 20 per day for the whole platform) the worst case is bounded. To switch to Sonnet 5.5, change `AI_MODEL_ID` to `claude-sonnet-5-5`; nothing else changes. The requests also turn on server-side refusal fallbacks (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`), so a false-positive safety decline is retried on the model Anthropic recommends instead of failing the round.
- **E9, reviewer agent:** same model as the AI layer (`AI_MODEL_ID`). Estimate, to verify with real use: one review round sends two screenshots and the page's text, about 13,000 input tokens and up to 2,000 output tokens, so about US$ 0.09 per round on Opus 5.5; the loop runs at most 3 rounds. The deterministic checks have no cost.
- **E10, job queue: Trigger.dev.** Generation builds sites with Astro and sharp and reviews them in Chromium (Playwright), which takes minutes and a real browser. Inngest runs each step inside our own functions (on Vercel), where Chromium and long builds do not fit; Trigger.dev runs tasks on its own machines, with no maximum run time, and has an official Playwright build extension. Checked on 2026-10-28 in the official pages (trigger.dev/pricing, trigger.dev/docs/limits, trigger.dev/docs/config/extensions/playwright; inngest.com/pricing, inngest.com/docs/usage-limits/inngest), through search results, because this session's network could not open the two sites directly, so **to verify** in the account before relying on them:
  - Trigger.dev Free: US$ 0 per month with US$ 5 of usage included, 20 concurrent runs in production, no maximum run duration; the small machine costs US$ 0.0000338 per second plus US$ 0.000025 per run. At that price the US$ 5 cover roughly 1,200 two-minute runs a month on the small machine; the build with the Chromium review may need a larger machine, which costs more per second (to verify when deploying).
  - Inngest Free: 50,000 executions per month, 5 concurrent steps, no overage (execution pauses at the quota), and the code runs on our side.
- **E10, form and dashboard choices:**
  - Signing in is required before the first question, so the sign-in page no longer offers "Continuar sem entrar"; it links back to the home page instead.
  - After approval the client can change two colors of the approved palette, the main color (buttons) and the accent, in step 2. The build applies them with the engine's overrides and pulls them to the nearest tone that keeps AA; the rest of the identity stays locked. Other palette roles are not offered, to keep the screen simple.
  - The home page keeps the "Experimente aqui" miniature (plan step E14) as a sample, labeled "Amostra" and "Nada é salvo aqui"; it is not a preview of the form.
  - The "Como funciona" section shows the 7 steps of the new form with small still pictures; the old pictures of templates and palettes were removed.
  - Sites wait in "in review" for a person (CLAUDE.md: at first every site is reviewed by hand). The admin queue comes in E11; until then `REVIEW_SKIP_HUMAN=true` sends finished sites straight to the client, in development only.
  - Payments: one `PaymentProvider` interface with a stub (`apps/platform/src/lib/server/payments.ts`). The amount always comes from `config/pricing.ts`.

