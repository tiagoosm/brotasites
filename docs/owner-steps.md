# Steps that depend on the owner (accounts and decisions)

Keep this list up to date during the project. Claude Code does not create accounts and does not deploy.

- [ ] Choose the `BASE_DOMAIN` for client sites and register it; turn on the transfer lock; request inclusion in the Public Suffix List.
- [ ] Accounts: Supabase, Vercel (Pro plan before charging clients), Cloudflare, email/SMTP provider, Asaas, GitHub (2FA).
- [ ] Set up a custom SMTP in Supabase (the default only delivers to the project team and has a low limit).
- [ ] Choose the queue (Inngest or Trigger.dev) and the AI model (proposals in steps E10 and E8).
- [ ] Legal review: Terms, Privacy, guarantee and refund. Invoicing with an accountant.
- [ ] GitHub settings (Settings > Advanced Security): turn on Dependabot alerts and security updates, and secret scanning with push protection (free on public repositories; check the plan if the repository becomes private). CI also scans for secrets with gitleaks and audits dependencies on every push.
- [ ] External pentest before selling.
- [ ] Check INPI before investing in the brand.
- [ ] Decide the repository's visibility: the master plan assumes a private repository, and `tiagoosm/brotasites` is public. Adapted React Bits code (`side-rays.tsx`, `vine-trail.tsx`) is visible while it is public.

## Decisions to review

Since 2026-10-27 the owner does not approve each task. Choices the plan reserved for the owner are taken with the recommended option and listed here; any of them can be reversed.

- **E3, fonts of client sites:** 13 open-license (SIL OFL 1.1) families, licenses checked in the Google Fonts repository: Fraunces, Instrument Serif, DM Serif Display, Cormorant Garamond, Young Serif, Bricolage Grotesque, Space Grotesk, Manrope, DM Sans, Fredoka, Baloo 2, Caveat and Kalam, in 9 pairs (`packages/catalog/src/fonts.ts`). Playfair Display was left out: its name is a Reserved Font Name, and the OFL treats the subset we ship as a modified version. To see them, run `pnpm --filter @brotasites/catalog specimen` and open `packages/catalog/dist/specimen/index.html`.
