# Steps that depend on the owner (accounts and decisions)

Keep this list up to date during the project. Claude Code does not create accounts and does not deploy.

- [ ] Choose the `BASE_DOMAIN` for client sites and register it; turn on the transfer lock; request inclusion in the Public Suffix List.
- [ ] Accounts: Supabase, Vercel (Pro plan before charging clients), Cloudflare, email/SMTP provider, Asaas, GitHub (2FA).
- [ ] Set up a custom SMTP in Supabase (the default only delivers to the project team and has a low limit).
- [ ] Choose the queue (Inngest or Trigger.dev), proposal in step E10. The AI model was chosen in E8 (see "Decisions to review").
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

