# Client site hosting

A single Cloudflare Worker serves every site (`apps/sites-worker`). Do not use "one project per client": Cloudflare Pages allows 100 projects per account. Verified limits and prices are in the "Site hosting" table of `CLAUDE.md`.

## Design

- **R2:** static files, under `sites/{subdomain}/{version}/...` (published) and `drafts/{siteId}/{version}/...` (private).
- **KV:** pointers `site:{subdomain} -> {version}`, state (active, suspended, grace) and the custom-domain-to-subdomain map.
- **Worker:** resolves the host (a subdomain of `BASE_DOMAIN` or a custom domain), reads KV, serves the file from R2, applies the security headers, answers 404 and the suspended-site page. Drafts: `ver.{BASE_DOMAIN}/{token}` with a random token of at least 128 bits, expiry, `noindex`, no cache and no download.
- **Publish:** write the new version to R2, validate, switch the pointer. Rolling back is switching the pointer to the previous version.
- **Export:** a zip of the active version (available to the client after payment).
- **Custom domain:** Cloudflare for SaaS (verified on 2026-10-25: 100 custom hostnames included, then $0.10 each per month; confirm in the docs when implementing). DNS instructions for the client and a status check on the dashboard.
- **Batch rebuild:** when the template is fixed, regenerate every site from its JSON and locked identity, with a visual comparison, a gradual rollout and a quick rollback.

## Generation jobs and previews (built in E10)

- **Queue:** Trigger.dev (decision in `docs/owner-steps.md`). The database is the source of truth: the platform's database functions (`request_directions`, `choose_direction`, `request_rebuild`, `server_approve`, `server_confirm_payment`) write a `jobs` row, then the platform triggers the `site-job` task of `apps/jobs` with the job id (`/api/jobs/start`, with `TRIGGER_SECRET_KEY`). The task claims the row (`claim_job`), so a job that is never triggered stays queued for the local runner (`pnpm --filter @brotasites/jobs dev:local`) or a later trigger. Each job is retried once, then the site goes to "needs attention".
- **Jobs:** `directions` (engine and art director, 3 directions, screenshots at 390 and 1280 px into the private `site-renders` bucket), `build` (approved identity, AI copy, reviewer with up to 2 fix rounds, private preview), `publish` (only with a paid publish payment).
- **Private preview of the finished site:** R2 key `previews/{siteId}/{token}/...`, served by `apps/sites-worker` at `previa.{BASE_DOMAIN}/{siteId}/{token}/` with `noindex`, `no-store` and the strict CSP. The token has 192 random bits (24 bytes, base64url). The platform links to it with `NEXT_PUBLIC_PREVIEW_ORIGIN`. In development the local runner serves the same paths at `http://127.0.0.1:4500`.
- **Photos:** clients upload into the private `site-uploads` bucket; the job re-encodes each photo (no metadata) before any site uses it, so only clean copies reach R2.

## Costs (to verify when implementing)

R2: storage charged per GB-month, free egress, free tier. Workers: free plan with a daily limit; paid plan from $5/month. KV and Cloudflare for SaaS: check the official pricing pages. The platform (Next.js) runs on Vercel (Pro before charging clients).

## This round

Implement the Worker with wrangler and miniflare locally, with tests. DO NOT deploy. Document in `owner-steps.md`: Cloudflare account, R2 bucket, KV namespace, Worker route, DNS of `BASE_DOMAIN` with a wildcard, Cloudflare for SaaS, Public Suffix List, 2FA and the domain lock.
