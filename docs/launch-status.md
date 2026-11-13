# Launch status (E34, E35, E39)

What production needs, what the owner reported as done, and the order of what is left. The variable tables are generated from `scripts/launch/requirements.mjs`, the same list `pnpm check:launch` uses; a test (`scripts/launch/requirements.test.mjs`) fails when the code reads a variable that list does not have, or when the deploy workflows use a GitHub secret or variable it does not list. If a table here and that file disagree, the file wins.

No value here is a secret. Secrets go only in Vercel, Trigger.dev, GitHub's `production` environment or the Cloudflare dashboard, never in the repository. The Cloudflare account id and the KV namespace id in `apps/sites-worker/wrangler.jsonc` are identifiers, not secrets.

## How to check

- `pnpm check:launch --target vercel --env <file>`: compares a file from `vercel env pull --environment=production <file>` with what the platform needs. Prints only names and states (presente, faltando, vazia, exemplo, valor errado, conferir), never values. Delete the file afterwards.
- `pnpm check:launch --target trigger --env <file>`: the same for the jobs.
- `pnpm check:launch --target worker`: reads `apps/sites-worker/wrangler.jsonc` (domains, account id, KV id, and `workers_dev`, which must be `false`; the zeros are refused). `EXPORT_SECRET` shows as "conferir": it lives in the Cloudflare dashboard, where no script reads it.
- `pnpm check:launch --target github`: lists the secrets and the variable GitHub needs for the deploy workflows, and where they go. It reads nothing (GitHub never shows a secret back).
- `pnpm --filter @brotasites/jobs image:smoke`: builds a folder laid out like the Trigger.dev image (only the packages and files `apps/jobs/trigger.config.ts` puts there) and generates the example site from it (E35d). Needs the npm registry; no account.
- `pnpm check:launch --online`: fetches the platform, the admin host and the sites domain and says what answers.
- The team panel (`/admin/visao-geral`) says whether site creation is open and, when it is not, which Vercel variables are missing (names only). It also counts generations stuck in the queue for more than 15 minutes.
- Exit code 1 means something blocking is missing; the last line says the next action.

## Services (state reported by the owner on 2026-11-12, not verified)

| Service | Used for | State (informado pelo dono) | What is left |
|---|---|---|---|
| Registro.br | `brotasites.com.br` and its DNS | Done | — |
| Vercel | The platform (`apps/platform`) | `brotasites.com.br` and the `admin` host working; Production variables checked | `TRIGGER_SECRET_KEY` and one redeploy (step 5), on purpose last |
| Supabase | Database, accounts, storage | Migrations applied up to `20261111000000_team_second_factor_switch`; 1 admin; second factor off (E33); CAPTCHA on | `20261105000000_site_domains` (only with E25); turn the second factor back on before selling |
| Resend | SMTP for the account emails | Done; sign-up tested | — |
| Cloudflare zone `brotasites.com` | The sites' domain | Registered, zone active | Proxied DNS records (step 3) |
| Cloudflare R2 | Previews and published sites | Bucket `brotasites-sites` and its token | — |
| Cloudflare Workers KV | Site pointers and status | Namespace `brotasites-hosting` (id in `wrangler.jsonc`) | — |
| Cloudflare Worker (`apps/sites-worker`) | Serves `*.brotasites.com` | Not published | `EXPORT_SECRET` (step 2), then "Deploy Worker" (step 4) |
| Anthropic | The AI (art director, copy, reviewer) | Key in Trigger.dev | — |
| Trigger.dev | The job queue | Production variables set; tasks not published: **deploy blocked** (see below) | Unblock the account, then "Deploy jobs" (step 4) |
| GitHub | Publishing the Worker and the jobs (E35) | Workflows in the repository; secrets not set | Step 1 |
| Turnstile | CAPTCHA on sign-in and sign-up | On in Supabase (reported) | Check that Vercel has the site key and no `NEXT_PUBLIC_CAPTCHA_MODE=off` |
| Asaas | Payments | Not started (out of scope) | Before charging |
| Cloudflare for SaaS | Clients' own domains (E25) | Not started | Optional, after launch |

### Todas as categorias abertas (2026-11-12)

Since E38 the three launch waves are open (owner's decision). The legal validation of the advertising rules of the wave 3 professions (health councils, OAB) is still pending. The rules of those categories stay on (`docs/categories.md`, "Launch waves"), and reinforced or mandatory review now always waits for a person, even with `REVIEW_SKIP_HUMAN=true`.

### Build: `__name is not defined` (2026-11-12, E39)

The directions of the first real site worked; its build failed twice with `ReferenceError: __name is not defined` and the site went to `needs_attention`.

- **Cause.** Trigger.dev bundles the jobs with esbuild and `keepNames`, which wraps named functions in `__name(fn, "name")` calls. The reviewer's browser checks hand functions to Playwright (`page.evaluate`), which serializes them and runs them in Chromium. The `__name` helper exists only in the bundle, not in the page, so the first wrapped function failed there. Nothing in the reviewer's checks was wrong; only how the functions reach the browser.
- **Fix.** Every browser context the reviewer and the direction screenshots open registers `KEEP_NAMES_SHIM` (`packages/reviewer/src/browser-checks.ts`) with `context.addInitScript`, before any page code runs. It is a string on purpose: a function would be bundled and wrapped too. It defines `__name` in the page as a function that returns its argument. The checks and quality limits did not change.
- **Test.** `packages/reviewer/test/e2e/keep-names.test.ts` bundles `browser-checks.ts` with esbuild 0.23.1 (the version Trigger.dev's CLI uses) and `keepNames`, and runs it on a local page in Chromium: without the shim it fails with `__name is not defined`, as in production; with it every check runs.
- **Reprocessing a site in `needs_attention`, without creating a new site:**
  - **Team (admin):** the site's page in `/admin` shows "Tentar de novo" at the top. It runs the failed step ("Criar as 3 direções", "Montar o site" or "Publicar") again as a new job with the same answers; the failed job stays, with its error. It asks for a confirmation, works only when nothing is queued or running, and allows `adminRetriesPerDay` (3, in `apps/platform/src/config/limits.ts`) per site in 24 hours. The client sees "Nossa equipe pediu uma nova tentativa." in the site's history.
  - **Client:** a site whose look was already chosen shows "Não conseguimos terminar o seu site" and "Tentar de novo" (`request_rebuild`, limited by the database to 30 per site a day). A site whose directions failed keeps "Revisar as respostas e tentar de novo". The client only ever sees "Algo deu errado do nosso lado. Nossa equipe já foi avisada.": never the technical error.
- **What went wrong, for the team (part 4).** The admin site page opens with "O que deu errado" when a step failed: the step in plain words, its times and attempts, the known cause and what to do (or "Erro não reconhecido"), the masked technical text folded under "Detalhes técnicos" with a copy button, and a link to the run in Trigger.dev. The queue (`/admin`) and the overview (`/admin/visao-geral`) show one short line per site; the history adds the team's note to the client's generic "job_failed" entry.
  - **Masking.** `maskJobError` (`packages/schema/src/job-error.ts`) runs in the jobs before an error is logged or stored and again in the admin API before it is returned: the values of the environment's secret variables, `sk-`, `tr_`, `sb_secret_`, JWTs (`eyJ…`), `Bearer …`, `apikey=`/`x-api-key:`/`password=`, credentials in URLs and long base64 runs become `[oculto]`; blank lines are collapsed; at most 2000 characters (the start and the end). The causes table (`JOB_ERROR_CAUSES`) covers `__name`, memory, a stopped process, Anthropic credit and key, Supabase, Cloudflare R2/KV, the Astro build and the network.
  - **Run id.** The task saves `ctx.run.id` in the job's `payload.triggerRunId` (no migration). The link uses `https://cloud.trigger.dev/runs/<id>`, which should open the run (to verify on the first failure). Jobs from before this change have no id: search Runs by time.
  - **To decide later:** clients can read their own `jobs` rows (RLS), the `error` column included. It is masked now, and the screens never show it, but a migration with column grants would close it.
- **Passo a passo para o dono, depois de mesclar:**
  1. Espere o deploy da Vercel terminar (ele leva o botão novo do admin).
  2. Confirme em GitHub > Actions > "Deploy jobs" que a publicação terminou verde. Desde o E40 ela roda sozinha depois do merge; se falhar, rode à mão (Run workflow, branch `main`, digite `publicar`). Sem ela, a correção do `__name` não chega ao Trigger.dev e a nova tentativa falha igual.
  3. Abra o site travado em `/admin` (aba "Precisa de atenção") > "Tentar de novo" > confirme. Ou, na conta do cliente, a página do site > "Tentar de novo".
  4. Acompanhe a tarefa em Trigger.dev > Runs. Se falhar de novo, o site volta para "Precisa de atenção"; veja o erro antes de tentar outra vez (o limite é de 3 tentativas por dia).

### Primeira execução real: falta de memória (2026-11-12)

The first real `site-job` (directions) ran on Trigger.dev's default machine (`small-1x`, 0.5 GB) and was killed at 56 s with `TASK_PROCESS_OOM_KILLED`. The job stayed `running` and the site `generating_directions`, with no directions saved.

Since E37:
- `site-job` runs on `medium-2x` (4 GB), with one retry on `large-1x` for out-of-memory only.
- A job left `running` for more than 45 minutes is offered "Tentar de novo" and counted on the team's overview.
- After the merge: run "Deploy jobs", then open the stuck site's page and use "Tentar de novo" once its job is 45 minutes old (or create a new test site).

### Deploy dos jobs bloqueado pelo Trigger.dev (2026-11-12)

Resolved on 2026-11-12, on the owner's side: the jobs were deployed and the first real run started (see above). Kept for the record.

Status: deploy dos jobs bloqueado pelo Trigger.dev: `Deployments are not available for this organization`. "Deploy jobs" builds and uploads the code, then Trigger.dev refuses `initializeDeployment` (`POST /api/v1/deployments`) with that message.

- **Main hypothesis (not confirmed):** a restriction of the Trigger.dev account or organization (plan, billing or a block on deployments). Only the owner can check it, in the dashboard or with Trigger.dev support.
- **Hypotheses the repository can rule out:**
  1. `TRIGGER_PROJECT_REF` belongs to another organization than the token.
  2. `TRIGGER_ACCESS_TOKEN` belongs to another account.
  3. An outdated CLI: since E36 the project uses 4.8.5, the latest at the time.
- **Already in the failed run's log:** with an environment API key the CLI resolves the project (`GET /api/v1/projects/<ref>/prod`) before it builds. That call worked, since the error came only at the deployment. So the key opens that project, which makes hypotheses 1 and 2 unlikely.
- **Since E36,** the workflow's "Diagnóstico (sem segredos)" step prints the CLI version, `TRIGGER_PROJECT_REF`, the kind of key (prefix only), `whoami` (without e-mail) and the project name and id that this key opens. `whoami` reads only a personal login (`trigger login`), never `TRIGGER_ACCESS_TOKEN`, so with the environment key it reports a failure by design; the organization is checked in the dashboard instead.
- **`[bundleSkills] skill discovery failed … Failed to import some task files`:** harmless. Before deploying, the CLI imports the bundled tasks from `apps/jobs` to look for `skills.define(...)`. The project defines no skills, and the tasks' external packages (`sharp`, `playwright`) are not linked in `apps/jobs/node_modules` by pnpm. In the image they are installed, and the real indexer runs there.

### Textos melhores (E41, parte A)

- **Editor de IA.** With `AI_MODE=live`, every text the writer produces gets a second pass (`editCopy` inside `writeCopy`, prompt `editor-2026-11-13.1`): it cuts clichés, varies the rhythm, makes the hero specific and keeps one voice, without adding any fact. Its answer goes through the same checks as the writer's (facts, banned phrases, the hero's concrete fact, the schema) plus a length check (at most 10% longer); if anything fails, or the model errs, the writer's text stays. The report records `copyEditor` (applied, discarded, failed, off). Its cost is counted under "copy" in `/admin/custos` (the `ai_calls` table has no separate task; a migration could split it later) and inside the daily budget.
- **`AI_COPY_EDITOR`** (Trigger.dev, optional): on by default; `false` turns it off. Ignored in simulated mode.
- **O que o dono roda** (passo do dono, gasta créditos): `AI_MODE=live AI_MODEL_ID=… ANTHROPIC_API_KEY=… pnpm --filter @brotasites/ai eval` prints, for the 30 businesses, `editorApplied`, `editorDiscarded`, `editorFailed`, `editorInventedFacts` and `editorBannedPhrases` (both must be 0 in the final sites; the ones caught are counted here), the mean of changed fields and the length ratio. In CI (simulated) the editor is off.

## Order of the remaining steps

Em português, na ordem em que destravam a geração. Nada disso precisa de máquina com o projeto instalado: tudo é feito nos painéis e no GitHub.

1. **Segredos no GitHub.** Em Settings > Environments, criar o ambiente `production` (opcional, mas recomendado: em "Required reviewers", colocar você mesmo, para cada publicação pedir sua aprovação). Nele, em Secrets: `CLOUDFLARE_API_TOKEN` (no Cloudflare, My Profile > API Tokens > Create Token > modelo "Edit Cloudflare Workers", com Account Resources só a sua conta e Zone Resources só `brotasites.com`), `CLOUDFLARE_ACCOUNT_ID` e `TRIGGER_ACCESS_TOKEN` (no Trigger.dev, o projeto > API keys > ambiente Production > preset "Deploy only"). Em Variables: `TRIGGER_PROJECT_REF` (o `proj_…` do projeto). `pnpm check:launch --target github` mostra a mesma lista.
2. **DNS da zona `brotasites.com`.** Dois registros **proxied** (nuvem laranja): `A` com nome `*` e `A` com nome `brotasites.com` (a raiz), ambos com o endereço `192.0.2.1`. É um endereço reservado para documentação: o Cloudflare responde antes de chegar a ele, e é o que a própria documentação do Cloudflare indica para registros que só existem para ligar o proxy (um `AAAA` para `100::` também serve). Sem esses registros, as rotas do Worker existem mas nenhum navegador chega a elas.
3. **Publicar.** Desde o E40, o "Deploy Worker" e o "Deploy jobs" rodam sozinhos depois de cada merge na `main` com o CI verde, cada um quando o merge mexe no que ele publica. À mão: Actions > o workflow > Run workflow (branch `main`, digite `publicar`). Não há passo de subdomínio `workers.dev`: o Worker tem `workers_dev` e `preview_urls` desligados e responde só pelas rotas de `brotasites.com` (E35c). O subdomínio `workers.dev` da conta, usado por outros Workers, não é tocado.
4. **`EXPORT_SECRET` no Worker, uma vez só.** Ele não passa pelo GitHub, e o painel só aceita o segredo depois que o Worker existe (passo 3). No Cloudflare: Workers & Pages > `brotasites-sites` > Settings > Variables and Secrets > Add, tipo Secret, nome `EXPORT_SECRET`, o mesmo valor da Vercel (se ainda não existir na Vercel, gere um valor longo e aleatório e use o mesmo nos dois lugares). Publicações seguintes pelo GitHub mantêm o segredo. Confira com `pnpm check:launch --online`, ou abrindo `https://previa.brotasites.com/` (deve responder o 404 do Worker) e `https://brotasites.com/` (deve levar à plataforma).
5. **Vercel, por último.** Colocar `TRIGGER_SECRET_KEY` (a chave secreta de produção do projeto no Trigger.dev, `tr_prod_…`, tipo Sensitive) e conferir que as variáveis de geração estão lá (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_KV_API_TOKEN`, `NEXT_PUBLIC_PREVIEW_ORIGIN`, `EXPORT_SECRET`). Fazer **um** Redeploy. A criação de sites abre.
6. **Primeira geração simulada, depois real.** Com `AI_MODE=simulated` no Trigger.dev, criar um site de teste e ver as 3 direções e o site pronto (sem gastar com a IA). Depois trocar para `AI_MODE=live` no Trigger.dev (as variáveis do Trigger.dev entram em cada execução nova; se as tarefas continuarem simuladas, rode "Deploy jobs" de novo) e criar outro. `/admin/visao-geral` não deve mostrar aviso de geração fechada nem gerações paradas.
7. **Antes de clientes reais.** Conferir o Turnstile na Vercel (chave do site, sem `NEXT_PUBLIC_CAPTCHA_MODE=off`); religar a verificação em duas etapas da equipe (`update public.team_settings set require_second_factor = true;`); revisão jurídica.
8. **Antes de cobrar.** Asaas (fora do escopo agora; até lá `PAYMENTS_MODE` vazio ou `stub` só para teste).
9. **Tirar do ar e excluir sites (E42).** Aplicar a migração `supabase/migrations/20261113000000_takedown.sql` no Supabase: SQL Editor > New query > colar o arquivo inteiro > Run. Ela pode rodar de novo sem estragar nada. Antes dela, as rotas "Tirar do ar" e "Excluir" respondem erro e o cron diário só registra a falha. Nenhuma variável nova.
   - **Decisões pendentes do dono:** política de reembolso quando o cliente exclui um site pago (hoje o admin decide à mão; o texto não promete nada e indica o contato); direito de arrependimento do consumidor (7 dias) e como ele aparece nos Termos; o prazo de 7 dias antes da exclusão (`deletionWaitDays`); a quarentena de 30 dias do endereço (`subdomainHoldDays`). Os valores ficam em `apps/platform/src/config/limits.ts` (o banco usa 30 dias fixos para a quarentena e no máximo 30 dias de espera).
10. **Depois do lançamento, opcional.** Domínio próprio do cliente (E25): migração `site_domains` e Cloudflare for SaaS.

## Como reverter

- **Parar de publicar pelo GitHub:** Actions > "Deploy Worker" (ou "Deploy jobs") > botão "…" > Disable workflow. Nada mais roda, nem o automático depois do merge (E40) nem o manual.
- **Voltar uma versão das tarefas:** no Trigger.dev, o projeto > Deployments > a versão anterior > "Promote" (nome do botão a verificar no painel); ou reverta o commit na `main` e o deploy automático publica a versão revertida.
- **Revogar o acesso:** no Cloudflare, My Profile > API Tokens > o token do GitHub > Delete (ou Roll, para trocar). No Trigger.dev, o projeto > API keys > a chave "Deploy only" > Revoke. Depois apague os segredos no GitHub (Settings > Environments > production). Revogar não tira do ar o que já foi publicado.
- **Voltar o Worker a uma versão anterior:** no Cloudflare, Workers & Pages > `brotasites-sites` > Deployments > a versão anterior > Rollback. Os sites dos clientes não mudam: os arquivos e os ponteiros ficam no R2 e no KV.
- **Tirar o Worker do ar:** apagar os dois registros DNS do passo 3 (as rotas param de receber visitas) ou, no Worker, Settings > Domains & Routes > remover as rotas.
- **Voltar as tarefas:** no Trigger.dev, o projeto > Deployments > a versão anterior > Promote. Para parar a geração na hora, tire `TRIGGER_SECRET_KEY` da Vercel e faça um Redeploy: a plataforma volta a mostrar "Estamos preparando a criação de sites" e nada fica preso.

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
| `AI_COPY_EDITOR` | jobs (`apps/jobs`) | Trigger.dev, prod env | optional | Default on: with AI_MODE=live the text gets the editor's second pass (E41). | true (default); false turns the editor off |
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
| `WORKERS_DEV` | sites Worker (`apps/sites-worker`) | `apps/sites-worker/wrangler.jsonc` | required | wrangler deploy needs the account's workers.dev subdomain and, unattended, stops asking to register one. | `false` |
| `ACCOUNT_ID` | sites Worker (`apps/sites-worker`) | `apps/sites-worker/wrangler.jsonc` | required | wrangler deploy asks which account to use. | the Cloudflare account id in wrangler.jsonc (an identifier, not a secret) |
| `EXPORT_SECRET` | sites Worker (`apps/sites-worker`) | Cloudflare dashboard, the Worker's Variables and Secrets (type Secret) | generation | "Baixar o site" links are refused. | secret (never in the repo) |

### github

Read by the deploy workflows only (`.github/workflows/deploy-worker.yml`, `deploy-jobs.yml`), in the repository's `production` environment (Settings > Environments > production). No script reads them; `pnpm check:launch --target github` lists them.

| Name | Kind | Workflow | What it is |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | secret | Deploy Worker | Cloudflare API token from the "Edit Cloudflare Workers" template, limited to the account and to the `brotasites.com` zone. |
| `CLOUDFLARE_ACCOUNT_ID` | secret | Deploy Worker | The Cloudflare account id (the same as in `wrangler.jsonc`; as a secret, GitHub masks it in the logs). |
| `TRIGGER_ACCESS_TOKEN` | secret | Deploy jobs | A Trigger.dev API key of the project's Production environment with the "Deploy only" preset (`tr_prod_…`). A personal access token (`tr_pat_…`) also works, but ties deploys to one person. |
| `TRIGGER_PROJECT_REF` | variable | Deploy jobs | The Trigger.dev project ref (`proj_…`). Not a secret: a variable, so it shows in the logs. |

## Divergences found (2026-11-12)

Between what the code reads and what `.env.example` and `docs/owner-steps.md` said before this step:

- **Read by the code, missing from `docs/owner-steps.md`:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Vercel, required), the Worker's KV id in `wrangler.jsonc` and `CLOUDFLARE_API_TOKEN` (needed by `wrangler deploy`). Added in E34; since E35 the token is a GitHub secret.
- **Not in `.env.example`, by design:** the Worker's `BASE_DOMAIN`, `PLATFORM_URL` and KV id live in `apps/sites-worker/wrangler.jsonc`, not in an env file.
- **In `.env.example`, not production settings:** `LOCAL_PREVIEWS_DIR` and `LOCAL_PREVIEWS_PORT` (local runner only) and `TRIGGER_PROJECT_REF` (read by `trigger.config.ts` when deploying, not at run time; since E35 a GitHub variable).
- **In `docs/owner-steps.md`, not environment variables:** `TRIGGER_PROJECT_REF` (a deploy-time setting, see above) and `TERMS_VERSION` (a constant in `src/lib/auth/schemas.ts`, correctly described there as code). Nothing to set in production for either.
- **Owner-reported Vercel variables:** see the note under "Services".
- **Where generation is checked:** the platform only sees Vercel's variables. `generationReady()` checks those; the AI and R2 variables live on Trigger.dev and are checked only by `pnpm check:launch --target trigger`. If Trigger.dev is misconfigured, jobs fail there; the stuck-job notice (15 minutes) and the client's "Tentar de novo" cover that case.

### Changed in E35 (2026-11-12)

- The Worker's `EXPORT_SECRET` moved from `wrangler secret put` to the Cloudflare dashboard, and `CLOUDFLARE_API_TOKEN` from the owner's shell to GitHub: nothing is deployed from a personal machine.
- `wrangler.jsonc` now has the real account id, the real KV id and the routes. Because `wrangler dev` rewrites every request to the first route's host, `pnpm --filter @brotasites/sites-worker dev` and the Miniflare test run a copy without the routes (`apps/sites-worker/dev/local-config.ts`).
- The owner reported the CAPTCHA on in Supabase. If `NEXT_PUBLIC_CAPTCHA_MODE=off` is still in Vercel while Supabase requires a CAPTCHA token, sign-in and sign-up fail (Supabase asks for a token the page never sends). Check it with `pnpm check:launch --target vercel --env <file>`: the Turnstile key must be there and the mode empty.
