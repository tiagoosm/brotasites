# Client site hosting

A single Cloudflare Worker serves every site (`apps/sites-worker`). Do not use "one project per client": Cloudflare Pages allows 100 projects per account. Verified limits and prices are in the "Site hosting" table of `CLAUDE.md`.

## Design (built in E12)

- **R2:** the files of each deploy under `sites/{subdomain}/{version}/...`, its .zip under `exports/{subdomain}/{version}.zip`, and private previews under `previews/{siteId}/{token}/...`.
- **KV** (`packages/generator/src/kv.ts`, binding `HOSTING`):
  - `site:{subdomain}` → `{"version", "previous", "state", "updatedAt"}`. States: `active`, `grace` (still online), `suspended` (a neutral "Site indisponível" page, 503) and `offline` ("Site fora do ar", 410).
  - `domain:{host}` → the subdomain a client's own domain serves.
  - `preview:{siteId}` → `{"token", "expiresAt"}`: only that token opens the preview, for 30 days after each build (KV also deletes the key then).
  - Sites published before KV keep working from R2's `sites/{subdomain}/current`.
- **Worker** (`apps/sites-worker`): resolves the host (a subdomain of `BASE_DOMAIN`, `previa.{BASE_DOMAIN}`, a client's domain from KV, or the workers.dev testing address by path), reads KV, serves the file from R2 with the security headers, and answers the 404, suspended and offline pages. Previews: `previa.{BASE_DOMAIN}/{siteId}/{token}/` (192-bit token), `noindex`, `no-store`, no referrer. Earlier drafts of this document called the preview host `ver.`; it is `previa.` in the code and in the platform.
- **Publish** (`deployToR2`): upload the version and its .zip to R2, then switch `site:{subdomain}` in KV, keeping the previous version. Rolling back is `rollbackSite`, one KV write. Publishing never lifts a suspension.
- **Export:** the platform gives the paying owner of a live site a link valid for 10 minutes, `previa.{BASE_DOMAIN}/_export/{subdomain}?exp=...&sig=...` (HMAC-SHA256 with `EXPORT_SECRET`, shared by the platform and the Worker); the Worker streams that version's .zip.
- **Suspension:** an admin's suspension (E11) sets the state in KV through the Cloudflare API; it can take up to 60 s to reach every location.
- **Custom domain:** included in the price and optional (decision of 2026-11-04). Cloudflare for SaaS on the `BASE_DOMAIN` zone (100 custom hostnames included, then $0.10 each per month: **to verify** in the owner's account). The flow on the site's page (asking, DNS instructions, verification, activation) is E25, see "Client domains (E25)" below.
- **Batch rebuild:** when the template is fixed, regenerate every site from its JSON and locked identity, with a visual comparison, a gradual rollout and a quick rollback (not built yet).
- **Locally:** `pnpm --filter @brotasites/sites-worker dev` runs the Worker in Miniflare with local R2 and KV; `test/local/miniflare.test.ts` does the same in CI.

## Domains (E28)

- **The rule:** the platform (`brotasites.com.br`, Vercel) and the client sites (`brotasites.com`, `BASE_DOMAIN`, this Worker) always on different registrable domains (`docs/security.md`, section 1). The team's area is `admin.brotasites.com.br` (`NEXT_PUBLIC_ADMIN_HOST`), on the platform's side.
- **Hosts of the sites domain:** `<subdomain>.brotasites.com` (a client's site), `previa.brotasites.com` (previews and the .zip export), `clientes.brotasites.com` (the CNAME target of client domains). `www`, `admin`, `previa`, `clientes` and the other reserved names can never be a client's subdomain (`packages/schema/src/v1.2/reserved.ts`).
- **The bare domain:** `brotasites.com` and `www.brotasites.com` redirect (301, path and query kept) to the platform's address, from the Worker's `PLATFORM_URL` variable. They need their own route besides `*.brotasites.com/*`: `brotasites.com/*` (and a proxied DNS record for the root).
- **HSTS:** per address, set by the Worker (`withHsts` in `apps/sites-worker/src/index.ts`): with `includeSubDomains` on the sites domain, without it on a client's domain, never over HTTP or on workers.dev.

## Generation jobs and previews (built in E10)

- **Queue:** Trigger.dev (decision in `docs/owner-steps.md`). The database is the source of truth: the platform's database functions (`request_directions`, `choose_direction`, `request_rebuild`, `server_approve`, `server_confirm_payment`) write a `jobs` row, then the platform triggers the `site-job` task of `apps/jobs` with the job id (`/api/jobs/start`, with `TRIGGER_SECRET_KEY`). The task claims the row (`claim_job`), so a job that is never triggered stays queued for the local runner (`pnpm --filter @brotasites/jobs dev:local`) or a later trigger. Each job is retried once, then the site goes to "needs attention".
- **Jobs:** `directions` (engine and art director, 3 directions, screenshots at 390 and 1280 px into the private `site-renders` bucket), `build` (approved identity, AI copy, reviewer with up to 2 fix rounds, private preview), `publish` (only with a paid publish payment).
- **Private preview of the finished site:** R2 key `previews/{siteId}/{token}/...`, served by `apps/sites-worker` at `previa.{BASE_DOMAIN}/{siteId}/{token}/` with `noindex`, `no-store` and the strict CSP. The token has 192 random bits (24 bytes, base64url). The platform links to it with `NEXT_PUBLIC_PREVIEW_ORIGIN`. In development the local runner serves the same paths at `http://127.0.0.1:4500`.
- **Photos:** clients upload into the private `site-uploads` bucket; the job re-encodes each photo (no metadata) before any site uses it, so only clean copies reach R2.

## Keeping Supabase awake (2026-11-02)

Supabase pauses Free plan projects with too little database activity over 7 days; its docs say "a few user requests to the database each day" are typically enough (supabase.com/docs/guides/platform/free-project-pausing). The project was paused once for inactivity before launch. Two daily layers now keep it active:

1. **Vercel Cron** (`apps/platform/vercel.json`): every day at 11:17 UTC (08:17 in Brasília) Vercel calls `GET /api/cron/keep-alive` on the production deployment. The route checks the `CRON_SECRET` bearer token (set in Vercel, production only; never in the repository), then runs three read-only count queries (sites, profiles, notifications) with the server key. Anyone else gets 401. Vercel's Hobby limits on cron jobs (how many, how often, timing precision) are to verify in vercel.com/docs/cron-jobs/usage-and-pricing; one job a day is the least any plan allows.
2. **Claude scheduled task** "Supabase keep-alive diário" (19:43 in Brasília): it checks the project's status, restores it if it was paused, and runs five read-only queries through the Supabase connector. It runs in the Claude Code session that created it, so it lasts while that session exists.

If the project is paused anyway: Supabase Dashboard > the project > Resume project (possible for 90 days). Moving to Supabase Pro removes pausing altogether.

## Cleaning up idle sites (E24)

The same daily Vercel Cron that keeps Supabase awake (`/api/cron/keep-alive`) also runs the cleanup (`apps/platform/src/lib/server/cleanup.ts`): first the dashboard warnings (7 days and 1 day before), then the sites past their deadline, at most 25 per run, each removed in the database and then its files (uploads, images, renders, the preview pointer in KV, and the purge job for anything published). One schedule instead of two keeps within the Hobby plan's cron limits (to verify in the Vercel docs before adding more). The team panel's `/admin/limites` shows a dry run of what the next 7 days would delete.

## Client domains (E25)

Included in the price and optional (owner's decision of 2026-11-04). Built against a simulated hosting; the real calls to Cloudflare for SaaS are written (`apps/platform/src/lib/domains/provider.ts`) and not run until the owner sets up the account (`docs/owner-steps.md`, "Client domains").

- **Facts, checked in Cloudflare's official documentation on 2026-11-05** (the `cloudflare/cloudflare-docs` repository, `cloudflare-for-platforms/cloudflare-for-saas`: plans, getting started, hostname validation, certificate validation, status codes): Free, Pro and Business plans include 100 custom hostnames, then $0.10 each a month, up to 50,000; endpoints `POST/GET/PATCH/DELETE /zones/{zone_id}/custom_hostnames[/{id}]`; a hostname serves traffic when `status` is `active` and `ssl.status` is `active`; ownership by the customer's CNAME to our target or by the TXT `ownership_verification` record; the certificate by `ssl.method` `txt` (records in `ssl.validation_records`); a no-change `PATCH` makes Cloudflare validate again sooner; error 1406 is a duplicate hostname, 1405 the quota. **Apex domains:** pointing a root domain with an A record needs "apex proxying", an Enterprise add-on; so the www is connected and the root redirects to it (below). These agree with this document's earlier figures; the owner still confirms them in the account ("to verify").
- **The flow:** the client types the domain on the site's page (paid sites only). The platform checks it (`lib/domains/validate.ts`: format, the Public Suffix List, reserved and platform names, imitations of banks, government and brands, no punycode), records it (`site_domains`, one per site, one site per domain), registers it with the hosting and shows the DNS records to copy. "Verificar agora" (limited per IP, account and site) and the daily routine (inside the keep-alive cron, for 7 days) ask the hosting; only when it says active does KV get `domain:<host>`.
- **The www pair:** typing `seunegocio.com.br` or `www.seunegocio.com.br` connects `www.seunegocio.com.br`; the root is its alias (`domain:<root>` = `{"subdomain", "redirectTo"}`), which the client redirects at the registrar and the Worker redirects with a 308 if it ever reaches it. Any other subdomain connects as typed.
- **One canonical address:** the client chooses the main one. With the own domain as the main one, `site:<subdomain>` gets `canonicalHost` and the BrotaSites address redirects there (308, path and query kept); otherwise the own domain redirects to the BrotaSites address. Publishing keeps `canonicalHost`. A suspended or offline site shows its page on any address, without redirecting. An unknown or removed host gets the same 404 as a missing page.
- **Nothing left hanging:** removing the domain takes it out of KV and the hosting; a deleted site (any path) queues its domain in `domain_purges`, which the daily routine clears. A suspension keeps the mapping, and the Worker shows the suspension page there too.
- **Left out:** the HTML `<link rel="canonical">` of the generated pages still names the BrotaSites address until the site is built again with the domain (the redirect already keeps one address).

## Costs

R2 and Workers: see the table in `CLAUDE.md` (checked on 2026-10-25). The platform (Next.js) runs on Vercel (Pro before charging clients).

Workers KV, from the official pages (developers.cloudflare.com/kv/platform/pricing and /limits) through search results on 2026-10-28, because this session's network could not open the site, so **to verify** in the account:

| Plan | Reads | Writes, deletes, lists | Storage |
|---|---|---|---|
| Free | 100,000 per day | 1,000 per day each | 1 GB |
| Workers Paid ($5/month) | 10 million per month, then $0.50 per million | 1 million per month each, then $5.00 per million | 1 GB, then $0.50 per GB-month |

Limits: values up to 25 MiB, keys up to 512 bytes, 1 write per second to the same key; a write can take up to 60 s to show where the key was read recently. Every site request reads its KV record (and a custom domain reads one more), so reads grow with traffic like Worker requests do: on Free, past 100,000 KV reads a day the reads fail. Move to Workers Paid before the sites near that, as for the Worker itself. Writes are few (one per publish, preview or suspension).

## Not done here

Nothing was deployed and no account was created. Every Cloudflare step is in `docs/owner-steps.md`.
