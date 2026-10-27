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

## Costs (to verify when implementing)

R2: storage charged per GB-month, free egress, free tier. Workers: free plan with a daily limit; paid plan from $5/month. KV and Cloudflare for SaaS: check the official pricing pages. The platform (Next.js) runs on Vercel (Pro before charging clients).

## This round

Implement the Worker with wrangler and miniflare locally, with tests. DO NOT deploy. Document in `owner-steps.md`: Cloudflare account, R2 bucket, KV namespace, Worker route, DNS of `BASE_DOMAIN` with a wildcard, Cloudflare for SaaS, Public Suffix List, 2FA and the domain lock.
