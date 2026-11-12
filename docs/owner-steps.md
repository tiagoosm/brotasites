# Steps that depend on the owner (accounts and decisions)

Keep this list up to date during the project. Claude Code does not create accounts and does not deploy.

**Start here: `docs/launch-status.md`.** It has every variable the code reads (where to set it, what happens without it), the services and their state, and the order of what is left. `pnpm check:launch` tells you the next action without printing any secret.

## Done (reported by the owner on 2026-11-12, not verified by Claude Code)

- [x] `brotasites.com.br` registered at Registro.br, its DNS there, and the platform on Vercel at `brotasites.com.br`, with the team's area on `admin.brotasites.com.br` (E28).
- [x] Custom SMTP in Supabase with Resend; sign-up tested end to end (E15, step 1 below).
- [x] Supabase migrations applied up to `20261111000000_team_second_factor_switch` (E10, E11, E15, E16, E24, E33; everything in `supabase/migrations/` except `20261105000000_site_domains.sql`, which waits for E25). One admin in `public.admins`. CAPTCHA turned on in Supabase.
- [x] Vercel's Production variables checked (E34), except `TRIGGER_SECRET_KEY`, left out on purpose until the jobs are published.
- [x] `CRON_SECRET` in Vercel and the daily keep-alive (2026-11-02, below).
- [x] Cloudflare: `brotasites.com` registered and its zone active; R2 bucket `brotasites-sites` with its token; KV namespace `brotasites-hosting` (its id and the account id are in `apps/sites-worker/wrangler.jsonc`).
- [x] Anthropic key and the jobs' production variables in Trigger.dev.

## To make site creation work, in order (E35: everything from GitHub, no machine of yours)

Until step 5 is done, the platform keeps site creation closed on purpose (E34): `/criar` says "Estamos preparando a criação de sites", the API answers 503, and the team panel lists the missing Vercel variables. Nothing gets stuck in the queue. The same steps, in Portuguese, are in `docs/launch-status.md`.

1. **GitHub secrets and variable.** Settings > Environments > New environment `production`. Recommended: under "Required reviewers", add yourself, so each publish waits for your approval. In it (`pnpm check:launch --target github` lists the same):
   - Secret `CLOUDFLARE_API_TOKEN`: Cloudflare, My Profile > API Tokens > Create Token > template "Edit Cloudflare Workers"; Account Resources: only your account; Zone Resources: only `brotasites.com`.
   - Secret `CLOUDFLARE_ACCOUNT_ID`: the account id (the same as in `wrangler.jsonc`; as a secret, GitHub masks it in the logs).
   - Secret `TRIGGER_ACCESS_TOKEN`: Trigger.dev, the project > API keys > Production environment > preset "Deploy only" (`tr_prod_…`). A personal access token (`tr_pat_…`, Account > Tokens) also works but ties deploys to your account.
   - Variable `TRIGGER_PROJECT_REF`: the project's `proj_…` ref (under Variables, not Secrets).
2. **DNS in the `brotasites.com` zone.** Two **proxied** records: `A` named `*` and `A` named `brotasites.com` (the root), both to `192.0.2.1`, an address reserved for documentation (RFC 5737). Cloudflare answers before the request would reach it; its docs suggest such reserved addresses (or `AAAA 100::`) for records that only exist to turn the proxy on. The wildcard also covers `previa.` and `www.`. Without these records the Worker's routes exist but no browser reaches them.
3. **Publish.** GitHub > Actions > "Deploy Worker" > Run workflow, branch `main`, type `publicar`. Then "Deploy jobs" the same way. The Worker's deploy sets its routes (`*.brotasites.com/*`, `brotasites.com/*`); the jobs' deploy builds the Playwright image on Trigger.dev's side. There is no workers.dev step: `workers_dev` and `preview_urls` are `false` in `wrangler.jsonc` (E35c), so the Worker answers only on its routes, and the account's workers.dev subdomain, shared with other Workers, is never changed.
4. **`EXPORT_SECRET`, once, in the Cloudflare dashboard** (never through GitHub). The dashboard accepts it only once the Worker exists (step 3): Workers & Pages > `brotasites-sites` > Settings > Variables and Secrets > Add, type Secret, name `EXPORT_SECRET`, the same value as in Vercel (if Vercel has none yet, generate a long random value, for example with a password manager, and use it in both places). Later deploys keep it. Then check `https://previa.brotasites.com/` (the Worker's 404) and `https://brotasites.com/` (redirects to the platform), or `pnpm check:launch --online`.
5. **Vercel, last.** Add `TRIGGER_SECRET_KEY` (the project's production secret key, `tr_prod_…`, Sensitive), check the other generation variables are there (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_KV_API_TOKEN`, `NEXT_PUBLIC_PREVIEW_ORIGIN=https://previa.brotasites.com`, `EXPORT_SECRET`), and Redeploy once. Site creation opens.
6. **First a simulated generation, then a real one.** With `AI_MODE=simulated` in Trigger.dev, create a test site, choose a direction, approve it in the team's queue: no AI spend. Then set `AI_MODE=live` in Trigger.dev and create another (Trigger.dev's variables apply to new runs; if the jobs still run simulated, run "Deploy jobs" again). `/admin/visao-geral` shows neither a "criação de sites está fechada" notice nor stuck generations. In Trigger.dev, the project > Runs, open the first `site-job` run and check its log: the directions' screenshots (Chromium), the art director's copy (the AI playbooks, read from disk) and the site's `astro build` (Astro and the templates, shipped in the image by `trigger.config.ts`, E35d). A failure there names the missing file or package ("Cannot find module …", "ENOENT …"): send it to Claude Code. The old site "Real Dente" (queued since 2026-10-29) can be restarted from its page with "Tentar de novo", or discarded.
7. **Later:** move to Workers Paid ($5/month) before the sites near 100,000 requests a day: on Free, the Worker and its KV reads fail past that (`docs/hosting.md`, Costs). Request the inclusion of `brotasites.com` in the Public Suffix List, and keep its transfer lock on.

### How to revert

- **Stop publishing from GitHub:** Actions > the workflow > "…" > Disable workflow. They never run on their own anyway: only on a click with `publicar` typed.
- **Revoke the access:** Cloudflare, My Profile > API Tokens > the GitHub token > Delete (or Roll to replace it). Trigger.dev, the project > API keys > the "Deploy only" key > Revoke. Then delete the secrets in GitHub (Settings > Environments > production). Revoking does not take down what is already published.
- **Roll the Worker back:** Workers & Pages > `brotasites-sites` > Deployments > the previous version > Rollback. Client sites do not change: their files and pointers live in R2 and KV.
- **Take the Worker off the air:** delete the two DNS records of step 2, or remove its routes in Settings > Domains & Routes.
- **Roll the jobs back:** Trigger.dev, the project > Deployments > the previous version > Promote. To stop generation at once, remove `TRIGGER_SECRET_KEY` from Vercel and redeploy: the platform goes back to "Estamos preparando a criação de sites" and nothing gets stuck.

## Before real clients

- [ ] **Turnstile** (Accounts (E15) step 4 below): reported on in Supabase on 2026-11-12. Vercel must then have `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and no `NEXT_PUBLIC_CAPTCHA_MODE`; with the mode still `off`, the pages send no CAPTCHA token and Supabase refuses sign-in and sign-up.
- [ ] **Turn the team's second step back on:** `update public.team_settings set require_second_factor = true;` (Accounts (E15) step 5 below).
- [ ] Supabase Authentication settings and pt-BR templates (Accounts (E15) steps 2 and 3), if not done yet.
- [ ] Optional: run the 30-business evaluation against the real model (`AI_MODE=live AI_MODEL_ID=claude-opus-5-5 ANTHROPIC_API_KEY=... pnpm --filter @brotasites/ai eval`) and keep the numbers as the baseline. Each full run is about 60 model calls.
- [ ] Blind test before opening sales (`docs/blind-test.md`; the kit was built in E13 and tried with the simulated AI only):
  1. Generate the BrotaSites half with the real model: `AI_MODE=live AI_MODEL_ID=claude-opus-5-5 ANTHROPIC_API_KEY=... pnpm --filter @brotasites/jobs blind-test generate` (10 sites, about one generation each). Optionally add photos you have the right to use (`--photos`).
  2. Commission the hand-made half: one designer (or several) makes the 10 sites from the briefs in `apps/jobs/kit/briefs/`, with the same photos. This is a paid job, at your discretion.
  3. `blind-test assemble`, then show `participantes/` to 10 to 20 people (small business owners and designers) without saying which product is being tested, and record the answers in `chave/respostas.csv`.
  4. `blind-test score`. If the target fails, the report says which pairs lost; invest there (catalog, playbooks, reviewer) and repeat.
- [ ] Legal review: Terms, Privacy, guarantee and refund. Invoicing with an accountant.
- [ ] Email addresses, as forwards to your inbox (for example Cloudflare Email Routing on the `brotasites.com.br` zone; to verify its terms): `contato@`, `privacidade@` and `abuso@brotasites.com.br`. The site shows them by default; `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_PRIVACY_EMAIL` and `NEXT_PUBLIC_ABUSE_EMAIL` override them.
- [ ] GitHub settings (Settings > Advanced Security): turn on Dependabot alerts and security updates, and secret scanning with push protection (free on public repositories; check the plan if the repository becomes private). CI also scans for secrets with gitleaks and audits dependencies on every push.
- [ ] External pentest before selling.
- [ ] Check INPI before investing in the brand.
- [ ] Decide the repository's visibility: the master plan assumes a private repository, and `tiagoosm/brotasites` is public. Adapted React Bits code (`side-rays.tsx`, `vine-trail.tsx`) is visible while it is public.
- [ ] Later, once everything is stable on HTTPS: decide on the HSTS preload list (`docs/security.md`).

## Before charging

- [ ] Vercel Pro (the Hobby plan is for non-commercial use only).
- [ ] Asaas (out of scope for now). Until then leave `PAYMENTS_MODE` empty in production; `stub` shows a test payment screen that confirms without charging, for testing only.

## Client domains (E25, optional, after launch)

Included in the price and optional. The code runs against a simulated hosting (`DOMAINS_MODE=simulated`, development only); the calls to Cloudflare for SaaS are written and have never been run. To turn it on:

1. **Cloudflare for SaaS** on the `BASE_DOMAIN` zone (after the Worker is published, "To make site creation work" above): in the zone, SSL/TLS > Custom Hostnames, enable it; create the fallback origin (for example `fallback.brotasites.com`, a proxied record the Worker answers on); create the CNAME target `clientes.brotasites.com` (proxied, pointing to the fallback origin).
2. **API token** with the least permission for custom hostnames on that zone only (Cloudflare's docs name "SSL and Certificates: Edit"; **to verify** when creating it). Put `CLOUDFLARE_SAAS_ZONE_ID`, `CLOUDFLARE_SAAS_API_TOKEN`, `CUSTOM_DOMAIN_TARGET=clientes.brotasites.com` and `DOMAINS_MODE=cloudflare` in Vercel (server only), plus the KV variables if not there yet. Never `simulated` in production.
3. **Apply the migration** `supabase/migrations/20261105000000_site_domains.sql` (after the E24 one) and run the database tests locally first.
4. **Confirm in the account** that 100 custom hostnames are included and the price of each extra one (official docs, 2026-11-05: 100 included on Free, Pro and Business, then $0.10 a month each, up to 50,000; **to verify**). The team panel (`/admin/limites`) shows "Domínios de clientes: N de 100 incluídos" and warns from 80. Past 100, each new domain costs at Cloudflare; the yearly renewal covers it. If the account answers "quota" (error 1405), Cloudflare's sales team allocates more.
5. **Legal review** of the Terms: the connection is included; registering and renewing the domain are the client's; BrotaSites is not responsible for an expired domain or a registrar's failure (marked pending review).
6. **Decide** whether the team helps clients with their DNS, and whether that help is paid. Today the page only gives the step by step and promises no help.

## Testing before launch: CAPTCHA off

Kept as a reference only. On 2026-11-12 the owner reported the CAPTCHA on in Supabase, which means this setup must already be gone: with `NEXT_PUBLIC_CAPTCHA_MODE=off` the pages send no CAPTCHA token, and a Supabase project that requires one refuses sign-in and sign-up.

- `NEXT_PUBLIC_CAPTCHA_MODE=off` in Vercel turns the platform's CAPTCHA off on purpose, also in production; it only works while Supabase's CAPTCHA protection is off too. The platform's own rate limits keep working (they need `SUPABASE_SECRET_KEY`).
- With Turnstile on: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel, `NEXT_PUBLIC_CAPTCHA_MODE` deleted, the secret key in Supabase ("Accounts (E15)", step 4).

## Dashboard (E16)

1. **Migration** (done: applied, per the owner on 2026-11-12). Apply `supabase/migrations/20261031000000_notifications.sql` after the accounts migration (SQL Editor, the whole file, Run), then run `supabase/tests/notifications.sql`: it must end with "ALL CHECKS PASSED".
2. Nothing else to configure: the dashboard and the notices use the existing session, tables and limits. Notices read more than 90 days ago are removed by the database itself, whenever the same person gets a new notice (no scheduled job needed).

## Accounts (E15)

In this order. Nothing here was done by Claude Code; values marked "to verify" were not checked in the official pages from this session (supabase.com and resend.com were out of the session's network; Supabase facts come from its documentation search).

1. **Email sending** (done with Resend, per the owner on 2026-11-12). Register the platform's domain and set up a custom SMTP for Supabase (suggestion to verify: Resend). In the provider: verify the domain with SPF, DKIM and DMARC records, use a sender like `nao-responda@<domain>`, turn **off** link and open tracking (it rewrites the confirmation links). Then in Supabase, Authentication > Emails > SMTP Settings, enter the provider's SMTP host, user and password. Send a test to Gmail, Outlook and Hotmail and check it lands in the inbox. Prices and sending limits of the provider: to verify on its pricing page. With a custom SMTP, Supabase's own limit for auth emails starts at 30 new users per hour (Supabase production checklist) and can be raised in Authentication > Rate Limits.
2. **Supabase Authentication settings:**
   - Providers > Email: **Confirm email** on (accounts confirm before the first sign-in; decision of 2026-10-29 below); **Secure email change** on (both addresses confirm); minimum password length 8; turn on **leaked password protection** (Authentication, "Leaked password protection", checked against HaveIBeenPwned) if the plan offers it (to verify: it may need a paid plan). E26 (2026-11-09): the platform itself does not call any leaked-password service; deciding whether to check new passwords against one stays with the owner. E27 (2026-11-09): the platform's only requirement is now 8 characters (the kinds of character only raise the strength meter; `docs/security.md`). Set Supabase's minimum length to 8 and leave "Password requirements" on "No required characters", so Supabase never refuses a password the form accepts. With common passwords no longer refused, leaked-password protection matters more.
   - Anonymous sign-ins: off. Phone sign-in: off.
   - Email OTP / link expiry: 3600 seconds or less (Supabase recommends 1 hour at most); the links are single-use.
   - URL Configuration: Site URL = the platform's address; Redirect URLs = only `https://<platform domain>/auth/confirm**` (and `http://localhost:3000/auth/confirm**` in development). Nothing on `BASE_DOMAIN`.
   - Rate Limits: keep the defaults (one email per address per 60 s for sign-up confirmation, links and resets; 30 auth emails per hour with a custom SMTP, raise when needed) and turn on **IP address forwarding**, then set `SUPABASE_FORWARD_IP=true` in Vercel. The platform adds its own limits per IP and per email (`apps/platform/src/lib/server/rate-limit.ts`): sign-up 5 per IP and 3 per email per hour; password sign-in 30 per IP and 10 per email per 15 minutes; links, resets and resends 10 per IP and 5 per email per hour; account changes 30 per IP and 10 per email per hour.
   - Sessions: optional, on paid plans only (to verify): an inactivity timeout.
3. **Email templates (pt-BR)**, Authentication > Emails > Templates: paste the files of `docs/email-templates/` (Confirm signup: `confirm-signup.html`; Reset Password: `reset-password.html`; Change Email Address: `change-email.html`) with the subjects written at the top of each file. They link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...&redirect_to={{ .RedirectTo }}`. To verify in the dashboard: with Secure email change on, which token variable the message to the new address uses (the template may need `{{ .TokenHashNew }}` there).
4. **Turnstile.** In Cloudflare, Turnstile > Add widget, for the platform's domain (and `localhost` for development), mode "Managed". Put the **site key** in Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and leave `NEXT_PUBLIC_CAPTCHA_MODE` empty in production. Put the **secret key** only in Supabase, Authentication > Bot and Abuse Protection > Enable CAPTCHA protection (the path in Supabase's CAPTCHA guide), provider Cloudflare Turnstile. Turnstile's free plan and limits: to verify on Cloudflare's pricing page. In production without a site key the account routes refuse to work on purpose.
5. **Two-step verification for the team: off for now; turn it back on before accepting real clients.** (E33, owner's decision of 2026-11-11.) The migration `supabase/migrations/20261111000000_team_second_factor_switch.sql` was applied to the production project on 2026-11-11 at the owner's request (recorded in Supabase as `team_second_factor_switch`); it created `public.team_settings` with the second step off. While it is off, use a long, unique password for the team account and keep at most one or two rows in `public.admins`. To turn it back on: `update public.team_settings set require_second_factor = true;` (nothing else). When it is on, the rest of this step applies: TOTP is on by default in Supabase (Authentication > Multi-Factor). Make yourself an admin (E11 step), sign in, open `/admin`: the panel asks to turn on an authenticator app (QR code) and, from then on, the code at every sign-in. `/admin` refuses sessions without the second step (the database's `is_admin()` checks `aal2`). Keep the key shown under the QR code in a safe place to restore the app.
6. **Migration** (done, per the owner on 2026-11-12). Apply `supabase/migrations/20261030000000_accounts.sql` after the E10 and E11 ones, then run `supabase/tests/accounts.sql` (and the other files of `supabase/tests`) in the SQL editor: each must end with "ALL CHECKS PASSED". Existing accounts get an empty profile: they are asked for their name and to accept the terms at /conta.
7. **Jobs.** Covered by the Trigger.dev deploy (step 4 of "To make site creation work"): it includes the `site-purge` task that removes deleted accounts' sites from R2 and KV.
8. **Terms and privacy: legal review.** `/termos` and `/privacidade` are provisional (version `2026-10-draft`, marked "pendente de revisão jurídica" on the pages and in `src/content/legal.ts`). After the lawyer's review, publish the new text with a new version in `TERMS_VERSION` (`src/lib/auth/schemas.ts`) and in `private.current_terms_version()` (a new migration): everyone is asked to accept again at /conta.

## Supabase keep-alive (2026-11-02)

- Done for you: `CRON_SECRET` was created in Vercel (production, sensitive) and a daily Claude scheduled task checks the database; see `docs/hosting.md`, "Keeping Supabase awake".
- After this merges, Vercel deploys the cron with the next production deployment. You can check it in Vercel > the project > Settings > Cron Jobs (it lists `/api/cron/keep-alive`), and run it once from there.
- Supabase still emails a warning about a week before pausing; if one ever arrives, open the project in the Supabase dashboard once and tell me.

## UX laws (E22)

The audit is in `docs/ux-audit.md`. These items wait on you:

- **CEP lookup (Tesler):** filling city and state from the CEP needs a lookup service (for example ViaCEP or BrasilAPI; terms and limits to verify). Choose one, or keep typing them in.
- **Time estimate (Parkinson):** the home page has no "leva uns N minutos" because there is no measured figure and the project never invents numbers. After the first real clients, the time can be measured and stated.
- **"Site no ar" (peak-end):** today it says "Seu site está no ar.". A warmer end is proposed for your OK: "Seu site está no ar. Compartilhe o endereço com seus clientes." plus the address.
- **Generated sites:**
  - Show the floating WhatsApp button only after the hero's button leaves the screen, so the first screen shows the action fewer than 3 times.
  - Cap "Sobre" paragraphs at 25 words.
  - Both go through the catalog cycle (E6/E11) if you approve.

## Cost limits and team panel (E24)

1. **Migration:** done on 2026-11-04 (applied by Claude Code at the owner's request, as `cost_and_admin`), after checking every table, column and constraint it uses.
2. **Legal review:** Terms and Privacy now say that unpaid sites idle for 30 days are deleted (with warnings on the dashboard), that the team can see account data for support, and that the cost of each AI call is measured. Still marked "pendente de revisão jurídica".
3. **Exchange rate:** the panel's estimates in reais use R$ 5,50 per dollar, marked "to verify" in `apps/platform/src/config/limits.ts` (`usdToBrl`). Update the rate and `checkedOn` when you check it; it is never used for a price.
4. **Email warning (future):** the deletion warning is in-site only, because this round sends no notification emails. When an email provider is chosen, a warning email 7 days before is the natural next step.
5. **Daily AI budget:** the panel reads `AI_DAILY_BUDGET_USD` (default US$ 20) and `AI_BUDGET_ALERT_RATIO` (default 0.8). Set them in Vercel and in the jobs' environment if you want other values.

## Decisions to review

Since 2026-10-27 the owner does not approve each task. Choices the plan reserved for the owner are taken with the recommended option and listed here; any of them can be reversed.

- **2026-11-05, sign-in and sign-up:** the two pages are one frame (the same card, with the morning light behind it), and the sign-in link by email was removed: signing in is with the email and password only. An account without a password (made with the old link) signs in through "Esqueci a senha", which sends a link to create one. Optional, in Supabase: Authentication > Emails, the "Magic Link" template is no longer used.
- **E25, 5 steps and client domains:**
  - The word is *passo* everywhere the client reads it. Exceptions kept: *Verificação em duas etapas* (the usual name of two-factor sign-in) and *Perguntas frequentes* (a section of the client's site).
  - Publicar lives at `/meus-sites/<site>/publicar`; the dashboard's button for a finished site is *Publicar*. The site's timeline keeps its named milestones (no numbers).
  - The 5th step sends the answers; a site already sent saves and goes back to its page (*Salvar e voltar ao site*); asking for 3 new directions stays on the site's page.
  - The www pair: the www is connected and the root redirects to it, because pointing a root domain needs Cloudflare's Enterprise "apex proxying". Another subdomain connects as typed.
  - The client's own domain becomes the main address once active (they can switch back); a suspended site keeps its domain mapped and shows the suspension page there.
  - The domain check uses the Public Suffix List as a data file in the repository (MPL 2.0, server only) instead of installing a library.
  - The HTML canonical link of the generated pages changes with the next build, not at once.
  - Database migrations: none for the 5 steps (no table or function names the steps); `20261105000000_site_domains.sql` for the domains.
- **E24, cost control:**
  - Sites that wait on us (generating, building, in review) are never deleted for inactivity, only those that wait on the client.
  - The cleanup runs inside the existing keep-alive cron (one schedule), not in a second cron.
  - The reviewer's model calls are recorded in `ai_calls` but still do not count toward the daily AI budget, as before E24.
  - Opening the payment counts as activity (a payment created or updated renews the deadline).
  - The profile menu's "Criar meu site" still opens `/criar`, which explains why a second site cannot start; only the dashboard button is disabled.
  - The Terms version was not bumped: the text is still a draft waiting for legal review, so nobody is asked to accept again yet.

- **E20, design review:**
  - **Fixed:** without a GPU the hero's light canvas lost its context and Chrome drew its broken-canvas icon in the hero's top left corner (on phones, over the title). The canvas now leaves the layout when it cannot draw, as the vine's already did.
  - **Fixed:** one term for the art directions, *direção* (see E19 below).
  - **Fixed:** in the dashboard a site *No ar* had a grey dot, the same as an idle one; it is now a steady green (pulsing green stays for work in progress, yellow for your turn) and problems (*Precisa de atenção*, *Suspenso*) are red.
  - **Fixed:** the account page had two sections called *Seus dados*; the download one is now *Cópia dos seus dados*.
  - **Fixed:** on a site's page the directions section repeated the status line (*Escolha uma das 3* twice); it is now *As 3 direções*. The three cards keep their *Escolher esta* buttons on one line, whatever each note's length.
  - **Fixed:** a live site's page showed the download before its address; the address comes first.
  - **Fixed:** step 6 said twice that the page can be closed.
  - The hero line no longer leaves a lone word at the end of a line (`text-wrap: pretty`).
  - **Kept on purpose:** the skill used for this review asks for testimonials, numbers and "social proof" in the hero; BrotaSites has no real ones yet and the project rules forbid inventing them, so none were added. It also asks for Framer Motion and new shadcn components; the page already has its own motion (E18) and adding libraries needs the owner's OK, so none were added.
  - **Suggestions left for the owner** (not done, they change the look): a real example of a finished site in the hero once there is a real, authorized client; and on the sign-in and sign-up pages, the header's "Entrar ou cadastre-se" link could be hidden (it points to the page itself).
- **E19, copy review:**
  - Rule used: one idea per block, supporting text of one or two short lines, answers that lead with the yes or no. Details stay in Ajuda and in the legal pages.
  - The H1 and slogan stay (*Sete perguntas e seu site pronto.*). The final call became *Seu site começa com sete perguntas.* and the hero line *Você responde, escolhe o visual e aprova. A gente monta o site. Sem código.*
  - The term stays *as 3 direções* everywhere (E20 reverted a short-lived *3 visuais*, which clashed with the statuses, buttons and form step that say *direção*).
  - The feature *Endereço e mapa* (*sem sair do site*) promised an embedded map, which client sites do not have; it is now *Como chegar* (*Um toque abre a rota até você no mapa.*).
  - Not changed: Termos and Privacidade (their wording waits for the lawyer), the team area, server error messages and status texts (already one line).
- **E18, home page motion and navigation:**
  - **Price glow (item 4):** instead of animating the gradient's angle (a registered `--glow-angle`, which repaints the gradient every frame), the arc is a square with a conic gradient that turns with `rotate` on its own layer inside the masked rim (and the blurred halo): only compositing each frame. The mouse eases it the short way round with requestAnimationFrame; on leave the CSS turn restarts from that angle (a negative `animation-delay`).
  - **Section scroll (item 5):** a small requestAnimationFrame scroller, not CSS `scroll-behavior: smooth` (which fixes neither the duration nor the curve, and would also change the back button and every other anchor). 600 to 900 ms by distance, ease-in-out cubic, stops under the 64px header (the section's `scroll-margin-top`). From another page the target is kept in `sessionStorage`, the home page opens at the top and then scrolls (a direct load of `/#preco` still jumps, as browsers do).
  - **Vine (item 7):** clipped in its WebGL shader by the content's boxes (up to 64 on screen, a 10px soft edge) and the 2D leaves faded by the same rule, rather than drawn behind opaque blocks: the page keeps its transparent text blocks and its look, and nothing new is painted. Boxes are measured when the layout changes (ResizeObserver, fonts), never on a mouse move; scrolling shifts them by `scrollY`. The vine only runs where a GPU draws it (as before), so it could not be checked on screen in this container (no GPU); its rule is covered by unit tests.
  - **Stem direction:** the prompt asked for the stem to be thick and dark at the base and thin and light at the young tip, and for the ink to follow the scroll downward to the bloom at the last question. Read together, the base is at the top (where the ink starts) and the young tip at the bottom (where it blooms); that is how it is drawn.
  - **Phone menu:** signed out, its main button is again "Criar meu site" (the specular one), with the sign-in link in the list (E30: now "Criar conta" and "Entrar"); signed in, the account block without "Criar site", "Sair", then "Criar site" as the main button.
  - **Sign-in page:** "Ainda não tem conta? Cadastre-se" moved up, right under the title, in a light green box.
  - Button profile (hovering the hero button for 3 s, Playwright trace in this container): paint 804 → 67 times (144 → 13 ms), raster 386 → 81 tasks (234 → 21 ms), style recalculation 320 → 105 ms; frames at 16.7 ms before and after, no long tasks either way. The light no longer goes through inherited CSS variables with transitions, which recalculated and repainted the whole button on every frame. One cost went up: compositing (Layerize) about 0.8 ms per frame instead of 0.1, from the page's extra layers (the turning glow, the leaves' animations); no frame is dropped.
  - Lighthouse, home page, this container (phone / desktop, performance / accessibility / best practices / SEO): before 75 / 100 / 100 / 100 and 100 / 100 / 100 / 100 (phone LCP 3.5 s, TBT 620 ms); after, two runs, 94 and 93 / 100 / 100 / 100 and 100 / 100 / 100 / 100 (phone LCP 2.7 s, TBT 150 to 200 ms). The phone score varies between runs here (E17 measured 93 on the same page).
  - **Fixed on the way:** without a GPU the vine's WebGL canvas, once its context was dropped, painted a white sheet. The old margin mask hid it (the margins are light anyway); over the whole page it would have hidden everything under the header on computers whose GPU the browser blocks. The vine now removes its canvases when it cannot draw, and an e2e test checks that the hero title's ink is visible and no canvas is left without a GPU.
  - The 44px touch-target check now waits for the running entrances to end before measuring (entrances come back on every scroll and move elements for a moment); the sizes it checks are unchanged.
  - JavaScript of the home page: 168.8 KB transferred (531.5 KB uncompressed), 3.4 KB more than before (8.7 KB uncompressed).
- **E17, one header and the profile menu:**
  - **Name and team on the public pages** (owner's choice, 2026-10-29): the prerendered public pages only know that someone is signed in, so their profile button shows the person icon and the menu reads the name, the email and "Área da equipe" from `/api/account/me` when it first opens (the four account items show at once). The signed-in pages render the initials and the full menu from the server.
  - The menu is built in the project (no new library): the ARIA menu-button pattern, items of 44px, Escape and Tab close it, a click outside too.
  - Signed out, the home page's header shows "Entrar" but not "Criar meu site" (its hero has the button, as before); every other page shows both. Signed in, "Criar site" shows on every page, next to the profile button.
  - The dashboard's notices bell moved from the old header to the greeting; the team area's links became tabs under the header; the form shows its progress under the header, without a second brand or account menu.
  - Footer: the full one everywhere, a single line on the sign-in, sign-up and password screens.
  - **Fixed on the way**: since E16 the home page logged a React hydration error (#418): the header compared the prerendered internal address ("/visitante") with the visible one ("/") and rendered differently. The header now reads the visible address.
  - Lighthouse of the home page, this container, phone / desktop (performance / accessibility / best practices / SEO): before (main, E16) 62 / 100 / 92 / 100 and 100 / 100 / 92 / 100 (phone LCP 4.2 s, TBT 1,190 ms; the 92 was the hydration error); after 93 / 100 / 100 / 100 and 100 / 100 / 100 / 100 (phone LCP 3.0 s, TBT 150 ms).
- **E16, account dashboard:**
  - **Public pages, two prerendered versions** (owner's choice, 2026-10-29): `/`, `/ajuda`, `/termos` and `/privacidade` are built twice (`/visitante/...` and `/logado/...`, `src/lib/public-variant.ts`); the proxy, which already reads the session, serves the right one under the page's own address and answers 404 to the internal addresses. The pages stay static and the menu never flickers.
  - **`Vary: Cookie`**: Next.js writes its own `Vary` on every rendered page and replaces ours; it is kept on redirects and API answers. The pages that differ per session are still never stored by a shared cache: the dashboard and the account pages send `Cache-Control: private, no-store`, the public pages `private, no-cache`. To verify after the first deploy: that Vercel keeps `private` on the public pages (if it changes it to `public, max-age=0, must-revalidate`, caches still revalidate every time, so no one gets another person's menu).
  - **Data**: the dashboard reads the profile, the sites (with their name, answered steps and the two milestone events embedded), the latest 15 notices and the unread count in four requests sent at once, with the person's session; nothing is read per site. Milestone dates come from what already exists (`created_at`, the first `directions_ready` and `site_built` events, `approved_at`, `published_at`); no new column.
  - **Notices**: made by triggers on `sites.status` (directions ready, ready for approval, published, suspended, suspension lifted), on `admin_decisions` ("request_changes") and on the email confirmation. "Directions ready" is unique per round; the others are made once per real status change. The admin's note never goes into a notice. Retention: read notices older than 90 days are deleted when the person gets a new notice.
  - **Menus**: signed out, the header shows "Entrar" and, where there is no "Criar meu site" button (home page and phone menu), "Criar conta". Signed in: Painel, Criar site, Perfil e segurança, Sair. "Criar site" in the header goes to `/criar` (which opens the latest draft); "Criar outro site" on the dashboard goes to `/criar?novo=1`.
  - **Suspended sites**: the status text is now "Seu site foi suspenso. Veja os motivos na página do site." everywhere (no contact screen).
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
  - The "Como funciona" section shows the 7 steps of the new form with small still pictures; the old pictures of templates and palettes were removed.
  - Sites wait in "in review" for a person (CLAUDE.md: at first every site is reviewed by hand). The admin queue comes in E11; until then `REVIEW_SKIP_HUMAN=true` sends finished sites straight to the client, in development only.
  - E11, admin panel: decisions go through `server_admin_decide` and are logged in `admin_decisions`, which not even the server can rewrite. Asking for changes or suspending needs a note (the change note goes to the copy step; the suspension reason is shown to the client). Suspending today only changes the status on the platform; taking the site offline in the Worker comes with E12.
  - E11, catalog weights: a recommended variant weighs 3 times more (the cap); a recommended composition is used by Fiel à marca or Evolução 60% of the time when it fits the site, and never by Contraste, so at least a third of the suggestions explore (the docs ask for 20%). Retired compositions and variants are not drawn and the art director's proposals with them are refused; a section never loses its last variant. To change these numbers, edit `packages/engine/src/weights.ts`.
  - E12, hosting: the preview host is `previa.<BASE_DOMAIN>` (the design doc said `ver.`), previews expire 30 days after each build, the .zip export link lasts 10 minutes, and suspended sites answer 503 with a neutral page ("Site indisponível"). Nobody sets `grace` or `offline` yet: renewal (R$ 99/year) is not built. The `CLAUDE.md` row "Workers KV: to verify" can now point to `docs/hosting.md`, Costs (Claude Code cannot edit `CLAUDE.md`).
  - E13, blind test design: the 20 sites are 10 pairs of the same fictional business (one BrotaSites, one hand-made from the same brief), so the comparison is about the making, not the business. Each answer is a forced choice (A or B); "do not guess above chance" is a one-sided binomial test at 5% over all answers, and "prefer the generated sites in at least half of the pairs" counts a pair when most of its participants preferred the generated site. The businesses are 10 of the 30 of the AI evaluation (4 food, 3 beauty, 3 events), each taking the three directions in turn. Participants are not told which product is tested, only that in each pair one site was made with AI.
  - E13, fixes found by the kit: without a logo, the header link was 40 px tall (under the 44 px target) and its accessible name did not contain its visible text; and a hero title too large for its column broke words in the middle ("Forn" / "o"), since browsers without Portuguese hyphenation break anywhere. Both are fixed in the templates, and the reviewer now flags a word broken in the middle of large text. The pipeline tests had not caught them because they skip the browser checks and the fixture site has a logo.
  - E13, home page decorations: the hero's light rays and the vine that follows the mouse now run only where a GPU draws them; without one (software WebGL) the page shows without them. Lighthouse on the home page went from 58 to 94 on phones. To bring them back everywhere, remove the check in `apps/platform/src/components/site/webgl.ts` (not recommended).
  - E15, accounts (decisions of 2026-10-29, asked to the owner because the plan contradicted Supabase's documentation):
    - **The email is confirmed before the first sign-in.** The plan asked that an unconfirmed account could sign in and save its draft; with "Confirm email" on, Supabase gives no session until the link is used, and turning it off would mean writing our own confirmation. The owner chose Supabase's way. The server and the database still refuse sending the form and paying without a confirmed email (defense in depth), and a banner with "Reenviar e-mail de confirmação" shows if such a session ever exists.
    - **Session cookie readable by the browser (not HttpOnly).** The plan asked for HttpOnly; Supabase documents it as not feasible when the browser uses the session, which the form and "Meus sites" do. The owner chose Supabase's default plus a CSP: host-only, Secure, SameSite=Lax, and a nonce CSP with 'strict-dynamic' on the signed-in pages. Making it HttpOnly later means moving every data access to the server (a step of its own).
  - E15, CAPTCHA: Supabase's own CAPTCHA protection with Turnstile, rather than checking the token in the platform. It protects Supabase's Auth API itself (a bot calling it directly is refused too), which a check in our routes cannot. The cost: the widget is on every sign-in, not only after 3 failures as the plan suggested (in "Managed" mode it rarely asks for a click). Sign-in links, resets and resends carry it too.
  - E15, rate limits: a counter in the database (`server_rate_limit`, fixed windows, hashed keys) rather than a Vercel feature, so it works on any plan and every server instance shares it; Supabase's own limits stay on top.
  - E15, sensitive changes: changing the email, creating a password (accounts made with the old sign-in link, removed on 2026-11-05) and deleting the account need a sign-in from the last 10 minutes; the page says so and links to /entrar. Changing an existing password asks for the current one.
  - E15, deleting an account: the sites, drafts, photos and directions go at once; a published site answers "offline" (410) right away and its files leave R2 with the next `site-purge` run; paid charges stay in `payments` without the site, with who paid (`retained_customer`), for the tax period (how long: with the accountant). Team accounts are not deleted from /conta (their decisions keep their id); the owner removes them.
  - E15, "Criar meu site" without an account leads to /cadastro; the other signed-in pages lead to /entrar. Both link to each other.
  - Payments: one `PaymentProvider` interface with a stub (`apps/platform/src/lib/server/payments.ts`). The amount always comes from `config/pricing.ts`.

