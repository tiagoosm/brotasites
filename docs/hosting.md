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
- **Custom domain:** Cloudflare for SaaS (verified on 2026-10-25: 100 custom hostnames included, then $0.10 each per month; confirm in the docs when implementing). The Worker already serves a host mapped in KV; ordering, DNS instructions for the client and the status check on the dashboard come with the custom-domain product (+ R$ 97).
- **Batch rebuild:** when the template is fixed, regenerate every site from its JSON and locked identity, with a visual comparison, a gradual rollout and a quick rollback (not built yet).
- **Locally:** `pnpm --filter @brotasites/sites-worker dev` runs the Worker in Miniflare with local R2 and KV; `test/local/miniflare.test.ts` does the same in CI.

## Generation jobs and previews (built in E10)

- **Queue:** Trigger.dev (decision in `docs/owner-steps.md`). The database is the source of truth: the platform's database functions (`request_directions`, `choose_direction`, `request_rebuild`, `server_approve`, `server_confirm_payment`) write a `jobs` row, then the platform triggers the `site-job` task of `apps/jobs` with the job id (`/api/jobs/start`, with `TRIGGER_SECRET_KEY`). The task claims the row (`claim_job`), so a job that is never triggered stays queued for the local runner (`pnpm --filter @brotasites/jobs dev:local`) or a later trigger. Each job is retried once, then the site goes to "needs attention".
- **Jobs:** `directions` (engine and art director, 3 directions, screenshots at 390 and 1280 px into the private `site-renders` bucket), `build` (approved identity, AI copy, reviewer with up to 2 fix rounds, private preview), `publish` (only with a paid publish payment).
- **Private preview of the finished site:** R2 key `previews/{siteId}/{token}/...`, served by `apps/sites-worker` at `previa.{BASE_DOMAIN}/{siteId}/{token}/` with `noindex`, `no-store` and the strict CSP. The token has 192 random bits (24 bytes, base64url). The platform links to it with `NEXT_PUBLIC_PREVIEW_ORIGIN`. In development the local runner serves the same paths at `http://127.0.0.1:4500`.
- **Photos:** clients upload into the private `site-uploads` bucket; the job re-encodes each photo (no metadata) before any site uses it, so only clean copies reach R2.

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
