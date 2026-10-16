# Faultline Brief — Cloudflare Worker staging migration

Created 2026-10-16. **Staging only; production cutover NOT authorized.**

## Isolation ledger

| Component | Production — untouched | Experimental staging |
| --- | --- | --- |
| Git branch | `google-news-sitemap` | `cloudflare-staging-migration` |
| Web frontend | Vercel `faultlinebrief.com` | Worker `faultlinebrief-cf-staging` (NOT deployed) |
| CMS + PostgreSQL | Neon `br-dry-fog-b4q67dzl` | Neon `br-noisy-forest-b4k3mjmr` (created without compute) |
| Media | Existing Cloudflare R2 bucket | Prefer separate test R2 bucket and test-only credentials |
| DNS | Current production records | **DO NOT CHANGE** |

The existing `wrangler.jsonc` refers to a prior D1-based Worker and is **not** a safe production migration configuration. Do not delete its assets, D1 resource or R2 bucket while testing. The separate `wrangler.staging.jsonc` has a unique Worker name and no custom domain routes.

## Current status

- [x] Separate GitHub branch created.
- [x] Separate Neon database branch created (no compute initially).
- [x] Staging-only Worker configuration prepared; not deployed.
- [x] Read-only smoke-test script added; not yet executed against Cloudflare.
- [ ] Select and pin tested `@opennextjs/cloudflare` and `wrangler` dependencies; update pnpm lockfile in this branch.
- [ ] Confirm Next.js 16.3.3 + Payload CMS 3.90.2 adapter compatibility during cloud build.
- [ ] Provision staging compute for the Neon branch and create staging-only `DATABASE_URL`, `PAYLOAD_SECRET` and R2 environment secrets in Cloudflare.
- [ ] Decide how R2 media will be copied or read safely (DO NOT point staging writes at production bucket).
- [ ] Deploy only the `faultlinebrief-cf-staging` Worker after protecting its URL with Cloudflare Access or equivalent. Prevent duplicate indexing.
- [ ] Run smoke tests and live CMS write/read/update, media uploads, admin sign-in, editorial publish/preview, canonical/schema, sitemap, robots, and scheduled cache freshness tests.
- [ ] Measure US and European TTFB, LCP, error rate, cold-start behavior, Neon connections, image loading, and financial cost under consistent test conditions.
- [ ] Require explicit owner approval before changing DNS, production Worker, Git default branch, Neon production database, media, or Vercel settings.

## Safe deployment requirements

Cloudflare's OpenNext adapter is the **existing app compatibility path**, rather than an assurance that Payload works. Official references:

- https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- https://opennext.js.org/cloudflare/get-started
- https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/
- https://opennext.js.org/cloudflare/caching

Do not copy production `DATABASE_URL` to staging: Payload initialization or migrations may write data. Never put API tokens, connection passwords or storage keys into GitHub commits, GitHub workflow output, or URLs.

Cloudflare Hyperdrive can connect to Neon, but needs a separately provisioned configuration, properly supported node-postgres version, and validated integration with Payload's Postgres adapter. Do not introduce a speculative binding ID or automatically use the production database. Start by proving a normal staging database connection before measuring Hyperdrive.

Do not use the existing production R2 images as a staging write target. A fresh bucket is preferred. If copied editorial images are needed, use controlled replication to a staging bucket.

## Repeatable testing

After a staging Worker exists and its URL is protected for authorized testers, run the read-only smoke script from a cloud CI job with `CLOUDFLARE_STAGING_URL` pointing to that workers.dev hostname. The smoke script intentionally rejects the live domain.

Smoke tests verify HTTP responses only. They are **not** a substitute for interactive checks of Payload login, publishing, writes to staging Neon, media uploads to staging R2, and edit-triggered cache invalidation.

## Go/no-go conditions

Do not migrate unless the isolated Workers deployment shows functional parity, zero critical regressions, equal or better real-user performance, and acceptable Worker/Neon/R2 operating costs over a representative test window. Keep Vercel production as the rollback path until Cloudflare has demonstrated reliability.
