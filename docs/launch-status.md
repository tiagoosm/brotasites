# Launch status (E34)

What production needs, what the owner reported as done, and the order of what is left. The variable tables are generated from `scripts/launch/requirements.mjs`, the same list `pnpm check:launch` uses; a test (`scripts/launch/requirements.test.mjs`) fails when the code reads a variable that list does not have. If a table here and that file disagree, the file wins.

No value here is a secret. Secrets go only in Vercel, Trigger.dev or `wrangler secret`, never in the repository.

## How to check

- `pnpm check:launch --target vercel --env <file>`: compares a file from `vercel env pull --environment=production <file>` with what the platform needs. Prints only names and states (presente, faltando, vazia, exemplo, valor errado), never values. Delete the file afterwards.
- `pnpm check:launch --target trigger --env <file>` and `--target worker`: the same for the jobs and the Worker (the Worker reads `apps/sites-worker/wrangler.jsonc` plus `EXPORT_SECRET` and `CLOUDFLARE_API_TOKEN` from the shell).
- `pnpm check:launch --online`: fetches the platform, the admin host and the sites domain and says what answers.
- The team panel (`/admin/visao-geral`) says whether site creation is open and, when it is not, which Vercel variables are missing (names only). It also counts generations stuck in the queue for more than 15 minutes.
- Exit code 1 means something blocking is missing; the last line says the next action.

## Services (state reported by the owner on 2026-11-12, not verified)

| Service | Used for | State (informado pelo dono) | What is left |
|---|---|---|---|
| Registro.br | `brotasites.com.br` and its DNS | Done | Register `brotasites.com` (the sites' domain) if not yet |
| Vercel | The platform (`apps/platform`) | `brotasites.com.br` and the `admin` host working | Generation variables (step 5); see the note below on the variables reported |
| Supabase | Database, accounts, storage | Migrations applied up to `20261111000000_team_second_factor_switch`; 1 admin; second factor off (E33) | `20261105000000_site_domains` (only with E25); turn the second factor back on before selling |
| Resend | SMTP for the account emails | Done; sign-up tested | — |
| Cloudflare R2 | Previews and published sites | Not started | Step 2 |
| Cloudflare Workers KV | Site pointers and status | Not started | Step 2 |
| Cloudflare Worker (`apps/sites-worker`) | Serves `*.brotasites.com` | Not started | Step 2 |
| Anthropic | The AI (art director, copy, reviewer) | Not started | Step 3 |
| Trigger.dev | The job queue | Not started | Step 4 |
| Turnstile | CAPTCHA on sign-in and sign-up | Not started (`NEXT_PUBLIC_CAPTCHA_MODE=off` assumed) | Before real clients |
| Asaas | Payments | Not started (out of scope) | Before charging |
| Cloudflare for SaaS | Clients' own domains (E25) | Not started | Optional, after launch |

**Note on the reported Vercel variables.** The owner reported only `NEXT_PUBLIC_PLATFORM_URL` and `NEXT_PUBLIC_ADMIN_HOST` in Vercel's Production. That cannot be the whole list while sign-up works: sign-up needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` and `NEXT_PUBLIC_CAPTCHA_MODE=off` (or a Turnstile key), and the production build stops without `NEXT_PUBLIC_BASE_DOMAIN` (E28). They may be set on "All Environments" or as shared variables. Check with `pnpm check:launch --target vercel --env <file>` before step 5.

## Order of the remaining steps

Em português, na ordem em que destravam a geração. `pnpm check:launch` diz qual é o próximo.

1. **Vercel, básico.** Conferir com `pnpm check:launch --target vercel` que as variáveis básicas estão lá (Supabase, endereços, `CRON_SECRET`, `NEXT_PUBLIC_CAPTCHA_MODE=off`). Se faltar alguma, colocar e fazer Redeploy.
2. **Cloudflare.** Registrar `brotasites.com` e criar a zona; criar o bucket R2 `brotasites-sites` e o namespace KV; criar os tokens (R2 só nesse bucket, KV só nesse namespace); colocar o id do KV em `apps/sites-worker/wrangler.jsonc`; `wrangler secret put EXPORT_SECRET`; publicar o Worker em workers.dev; depois DNS da zona e as rotas. Passo a passo em `docs/owner-steps.md` e no cabeçalho do `wrangler.jsonc`.
3. **Anthropic.** Criar a organização no Claude Console, pôr crédito e limite mensal de gasto, criar a chave. A chave vai só no Trigger.dev, nunca na Vercel.
4. **Trigger.dev.** Criar o projeto, colocar as variáveis de produção dos jobs (tabela "Trigger.dev" abaixo, com `AI_MODE=live`), conferir com `pnpm check:launch --target trigger --env <arquivo>` e rodar `pnpm --filter @brotasites/jobs exec trigger deploy`.
5. **Vercel, geração.** Colocar `TRIGGER_SECRET_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_KV_API_TOKEN`, `NEXT_PUBLIC_PREVIEW_ORIGIN` e `EXPORT_SECRET`, e fazer Redeploy. Só então a criação de sites abre (até lá, `/criar` mostra "Estamos preparando a criação de sites").
6. **Conferir.** `pnpm check:launch --online`; abrir `/admin/visao-geral` (sem aviso de geração fechada); criar um site de teste do começo ao fim e aprovar na fila da equipe.
7. **Antes de clientes reais.** Turnstile (e apagar `NEXT_PUBLIC_CAPTCHA_MODE`); religar a verificação em duas etapas da equipe (`update public.team_settings set require_second_factor = true;`); revisão jurídica.
8. **Antes de cobrar.** Asaas (fora do escopo agora; até lá `PAYMENTS_MODE` vazio ou `stub` só para teste).
9. **Depois do lançamento, opcional.** Domínio próprio do cliente (E25): migração `site_domains` e Cloudflare for SaaS.

## Variables

"Need": `required` the target does not work without it; `generation` creating sites needs it (the platform keeps creation closed without the Vercel ones, E34); `launch` needed before real clients, not before testing; `optional` a default applies.

### vercel

| Variable | Read by | Where to set it | Need | Without it | Production value |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | platform (`apps/platform`) | Vercel, Production | required | No sign-in, no account pages. | https://<project>.supabase.co |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | platform (`apps/platform`) | Vercel, Production | required | No sign-in, no account pages. | sb_publishable_… |
| `SUPABASE_SECRET_KEY` | platform (`apps/platform`) | Vercel, Production, Sensitive | required | Account creation, sites, the team's panel and the cron fail (503). | secret (never in the repo) |
| `NEXT_PUBLIC_PLATFORM_URL` | platform (`apps/platform`) | Vercel, Production | required | The production build stops (E28). | https://brotasites.com.br |
| `NEXT_PUBLIC_BASE_DOMAIN` | platform (`apps/platform`) | Vercel, Production | required | The production build stops (E28); creating sites stays closed (E34). | brotasites.com |
| `NEXT_PUBLIC_ADMIN_HOST` | platform (`apps/platform`) | Vercel, Production | optional | /admin stays on the platform's address. | admin.brotasites.com.br |
| `CRON_SECRET` | platform (`apps/platform`) | Vercel, Production, Sensitive | required | The daily keep-alive is refused, and Supabase Free may pause. | secret (never in the repo) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | platform (`apps/platform`) | Vercel, Production | launch | With NEXT_PUBLIC_CAPTCHA_MODE=off: no bot protection; without both, sign-in and sign-up are refused in production. | 0x… (Turnstile site key) |
| `NEXT_PUBLIC_CAPTCHA_MODE` | platform (`apps/platform`) | Vercel, Production | optional | With no Turnstile key either: sign-in and sign-up refused in production. Never "simulated" there. | off (only until Turnstile), then empty |
| `TRIGGER_SECRET_KEY` | platform (`apps/platform`) | Vercel, Production, Sensitive | generation | No job ever starts: creating sites stays closed (E34). | secret (never in the repo) |
| `CLOUDFLARE_ACCOUNT_ID` | platform (`apps/platform`) | Vercel, Production | generation | Suspending a site does not reach the Worker; creating sites stays closed. | the Cloudflare account id (32 hex) |
| `CLOUDFLARE_KV_NAMESPACE_ID` | platform (`apps/platform`) | Vercel, Production | generation | Same as above. | the KV namespace id (32 hex) |
| `CLOUDFLARE_KV_API_TOKEN` | platform (`apps/platform`) | Vercel, Production, Sensitive | generation | Same as above. | secret (never in the repo) |
| `NEXT_PUBLIC_PREVIEW_ORIGIN` | platform (`apps/platform`) | Vercel, Production | generation | Previews point to the local runner (127.0.0.1); creating sites stays closed. | https://previa.brotasites.com |
| `EXPORT_SECRET` | platform (`apps/platform`) | Vercel, Production, Sensitive | generation | No "Baixar o site" link. | secret (never in the repo) |
| `PAYMENTS_MODE` | platform (`apps/platform`) | Vercel, Production | optional | Approval and publishing are off. | stub until Asaas (E-later); never stub with real clients |
| `SUPABASE_FORWARD_IP` | platform (`apps/platform`) | Vercel, Production | optional | Supabase's per-IP limits see Vercel's IPs. | true once IP forwarding is on in Supabase |
| `AI_DAILY_BUDGET_USD` | platform (`apps/platform`) | Vercel, Production | optional | Default 20. | 20 (default) |
| `AI_BUDGET_ALERT_RATIO` | platform (`apps/platform`) | Vercel, Production | optional | Default 0.8. | 0.8 (default) |
| `AI_ROUNDS_PER_SITE_PER_DAY` | platform (`apps/platform`) | Vercel, Production | optional | Default 20. | 20 (default) |
| `AI_ROUNDS_PER_ACCOUNT_PER_DAY` | platform (`apps/platform`) | Vercel, Production | optional | Default 40. | 40 (default) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | platform (`apps/platform`) | Vercel, Production | optional | Default from the platform's host. | contato@brotasites.com.br (default) |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | platform (`apps/platform`) | Vercel, Production | optional | Default from the platform's host. | privacidade@brotasites.com.br (default) |
| `NEXT_PUBLIC_ABUSE_EMAIL` | platform (`apps/platform`) | Vercel, Production | optional | Default from the platform's host. | abuso@brotasites.com.br (default) |
| `DOMAINS_MODE` | platform (`apps/platform`) | Vercel, Production | optional | The client's own domain flow says it is coming soon. | empty until E25 is set up, then cloudflare |
| `CLOUDFLARE_SAAS_ZONE_ID` | platform (`apps/platform`) | Vercel, Production | optional | Only with DOMAINS_MODE=cloudflare. | the brotasites.com zone id |
| `CLOUDFLARE_SAAS_API_TOKEN` | platform (`apps/platform`) | Vercel, Production, Sensitive | optional | Only with DOMAINS_MODE=cloudflare. | secret (never in the repo) |
| `CUSTOM_DOMAIN_TARGET` | platform (`apps/platform`) | Vercel, Production | optional | Default clientes.<BASE_DOMAIN>. | clientes.brotasites.com (default) |

### trigger

| Variable | Read by | Where to set it | Need | Without it | Production value |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | jobs (`apps/jobs`) | Trigger.dev, prod env | required | Every job fails at start. | https://<project>.supabase.co (or SUPABASE_URL) |
| `SUPABASE_SECRET_KEY` | jobs (`apps/jobs`) | Trigger.dev, prod env (secret) | required | Every job fails at start. | secret (never in the repo) |
| `AI_MODE` | jobs (`apps/jobs`) | Trigger.dev, prod env | required | Simulated AI: placeholder texts, never for clients. | `live` |
| `AI_MODEL_ID` | jobs (`apps/jobs`) | Trigger.dev, prod env | required | With AI_MODE=live, every job fails. | claude-opus-5-5 (decision of E8) |
| `ANTHROPIC_API_KEY` | jobs (`apps/jobs`) | Trigger.dev, prod env (secret) | required | With AI_MODE=live, every job fails. | secret (never in the repo) |
| `AI_EFFORT` | jobs (`apps/jobs`) | Trigger.dev, prod env | optional | Default medium. | medium (default) |
| `CLOUDFLARE_ACCOUNT_ID` | jobs (`apps/jobs`) | Trigger.dev, prod env | required | Previews and sites cannot be stored: the job stops. | the Cloudflare account id |
| `R2_ACCESS_KEY_ID` | jobs (`apps/jobs`) | Trigger.dev, prod env (secret) | required | Same as above. | secret (never in the repo) |
| `R2_SECRET_ACCESS_KEY` | jobs (`apps/jobs`) | Trigger.dev, prod env (secret) | required | Same as above. | secret (never in the repo) |
| `R2_BUCKET` | jobs (`apps/jobs`) | Trigger.dev, prod env | optional | Default brotasites-sites. | brotasites-sites (default) |
| `CLOUDFLARE_KV_NAMESPACE_ID` | jobs (`apps/jobs`) | Trigger.dev, prod env | required | Published sites and previews never reach the Worker. | the KV namespace id |
| `CLOUDFLARE_KV_API_TOKEN` | jobs (`apps/jobs`) | Trigger.dev, prod env (secret) | required | Same as above. | secret (never in the repo) |
| `BASE_DOMAIN` | jobs (`apps/jobs`) | Trigger.dev, prod env | required | Sites are built for sites.localhost. | brotasites.com |
| `REVIEW_SKIP_HUMAN` | jobs (`apps/jobs`) | Trigger.dev, prod env | optional | Default false. | false (default): every site goes through a person |
| `AI_CODE_VARIANTS` | jobs (`apps/jobs`) | Trigger.dev, prod env | optional | Default false. | false (default) |

### worker

| Variable | Read by | Where to set it | Need | Without it | Production value |
|---|---|---|---|---|---|
| `BASE_DOMAIN` | sites Worker (`apps/sites-worker`) | `apps/sites-worker/wrangler.jsonc` | required | The Worker answers for the wrong domain. | brotasites.com (wrangler.jsonc vars) |
| `PLATFORM_URL` | sites Worker (`apps/sites-worker`) | `apps/sites-worker/wrangler.jsonc` | required | The bare sites domain redirects nowhere. | https://brotasites.com.br (wrangler.jsonc vars) |
| `KV_NAMESPACE_ID` | sites Worker (`apps/sites-worker`) | `apps/sites-worker/wrangler.jsonc` | required | wrangler deploy fails. | the HOSTING namespace id in wrangler.jsonc (not zeros) |
| `EXPORT_SECRET` | sites Worker (`apps/sites-worker`) | `wrangler secret put` | generation | "Baixar o site" links are refused. | secret (never in the repo) |
| `CLOUDFLARE_API_TOKEN` | sites Worker (`apps/sites-worker`) | your shell, when deploying | required | wrangler deploy asks you to sign in instead. | secret (never in the repo) |

## Divergences found (2026-11-12)

Between what the code reads and what `.env.example` and `docs/owner-steps.md` said before this step:

- **Read by the code, missing from `docs/owner-steps.md`:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Vercel, required), the Worker's KV id in `wrangler.jsonc` and `CLOUDFLARE_API_TOKEN` (needed by `wrangler deploy`). Added in this step.
- **Not in `.env.example`, by design:** the Worker's `BASE_DOMAIN`, `PLATFORM_URL` and KV id live in `apps/sites-worker/wrangler.jsonc`, not in an env file.
- **In `.env.example`, not production settings:** `LOCAL_PREVIEWS_DIR` and `LOCAL_PREVIEWS_PORT` (local runner only) and `TRIGGER_PROJECT_REF` (read by `trigger.config.ts` when deploying, not at run time).
- **In `docs/owner-steps.md`, not environment variables:** `TRIGGER_PROJECT_REF` (a deploy-time setting, see above) and `TERMS_VERSION` (a constant in `src/lib/auth/schemas.ts`, correctly described there as code). Nothing to set in production for either.
- **Owner-reported Vercel variables:** see the note under "Services".
- **Where generation is checked:** the platform only sees Vercel's variables. `generationReady()` checks those; the AI and R2 variables live on Trigger.dev and are checked only by `pnpm check:launch --target trigger`. If Trigger.dev is misconfigured, jobs fail there; the stuck-job notice (15 minutes) and the client's "Tentar de novo" cover that case.
