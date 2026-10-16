# Faultline Brief — Cloudflare Worker staging migration

Created 2026-10-16. **Staging only; production cutover NOT authorized.**

## Isolation ledger

| Component | Production — untouched | Experimental staging |
| --- | --- | --- |
| Git branch | `google-news-sitemap` | `cloudflare-staging-migration` |
| Web frontend | Vercel `faultlinebrief.com` | Worker `faultlinebrief-cf-staging` (NOT deployed) |
| CMS + PostgreSQL | Neon `br-dry-fog-b4q67dzl` | Neon `br-noisy-forest-b4k3mjmr` (isolated read-write compute `ep-red-dream-b42nh8xe`, active; SQL connectivity verified 2026-10-16) |
| Media | Existing Cloudflare R2 bucket | Dedicated R2 staging bucket `faultlinebrief-staging-media` (user confirmed created); staging-only credentials still needed |
| DNS | Current production records | **DO NOT CHANGE** |

The existing `wrangler.jsonc` refers to a prior D1-based Worker and is **not** a safe production migration configuration. Do not delete its assets, D1 resource or R2 bucket while testing. The separate `wrangler.staging.jsonc` has a unique Worker name and no custom domain routes.

## Current status

- [x] Separate GitHub branch created.
- [x] Separate Neon database branch created; compute provisioned and read-only SQL connectivity test passed (2026-10-16).
- [x] Staging-only Worker configuration prepared; not deployed.
- [x] Read-only smoke-test script added; not yet executed against Cloudflare.
- [x] Trial OpenNext 1.20.12 and Wrangler 4.151.1 installed in isolated GitHub Actions runner; Worker bundle compiled successfully.\n- [ ] Pin confirmed adapter dependencies and update pnpm lockfile in this branch for reproducible deployment.
- [ ] Confirm Next.js 16.3.3 + Payload CMS 3.90.2 adapter compatibility during cloud build.
- [x] Provision staging Neon compute (`ep-red-dream-b42nh8xe`), confirm active, test SQL.\n- [ ] Create staging-only `DATABASE_URL`, `PAYLOAD_SECRET` and R2 environment secrets in Cloudflare; do not commit secrets.
- [x] User created a separate R2 staging bucket `faultlinebrief-staging-media`; binding recorded in staging-only Wrangler config.
- [ ] Create a staging-only R2 API token scoped to this bucket. Set staging `R2_BUCKET=faultlinebrief-staging-media`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; never reuse the production R2 write token.
- [ ] Decide how existing media will be copied or read safely; production object storage must not be a staging write target.
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

## R2 token created and manual staging deploy workflow prepared — 2026-10-16

The user confirmed a staging R2 API token exists; **never paste token values into chat or Git**.

A manual-only GitHub workflow is at `.github/workflows/cloudflare-staging-deploy.yml`.
It targets only `faultlinebrief-cf-staging`, with no custom-domain routes, and requires an explicit `DEPLOY-STAGING` confirmation. It has **not been run**.

### Secrets that must be configured before running

Prefer a protected GitHub Actions environment `cloudflare-staging`. Secrets may be stored as repository Actions secrets, but strictly scoped environment secrets are better.

- `CLOUDFLARE_STAGING_API_TOKEN` — **new Cloudflare Workers Edit token** scoped to the account; NOT the R2 storage token.
- `CLOUDFLARE_STAGING_ACCOUNT_ID` — Cloudflare account ID (not a password, still keep out of code).
- `CLOUDFLARE_STAGING_DATABASE_URL` — Neon **staging branch** `br-noisy-forest-b4k3mjmr`, never production branch.
- `CLOUDFLARE_STAGING_PAYLOAD_SECRET` — newly generated staging-only secret, not production secret.
- `CLOUDFLARE_STAGING_R2_ACCESS_KEY_ID` — restricted staging R2 access key ID.
- `CLOUDFLARE_STAGING_R2_SECRET_ACCESS_KEY` — restricted staging R2 secret.
- `CLOUDFLARE_STAGING_R2_ENDPOINT` — `https://<account-id>.r2.cloudflarestorage.com`.

The workflow pins OpenNext/Wrangler in its ephemeral build environment and sets the Worker-specific secrets via Wrangler after staging upload; do not submit the workflow until the entire setup is reviewed. Before allowing testers, enforce Cloudflare Access or other staging authentication and `noindex` responses to prevent indexing duplicate content.

**Important GitHub limitation:** `workflow_dispatch` is generally discoverable/run through GitHub Actions only when the workflow file is present on the repository default branch (`main`). The workflow is intentionally only on the staging branch now, so the Actions UI might not offer a Run button yet. Do not copy the workflow into main or enable automated deploys without an explicit, reviewed decision; preserve production branch isolation.

Before executing a real staging deploy, confirm that the Cloudflare Worker script upload fits account limits, Cloudflare Access is prepared, and the Neon staging branch URL is correct. R2 binding has been declared but the CMS currently uses S3-compatible R2 credentials, not the Worker binding.

## Security gate before first staging deploy

The Worker build passes, but staging contains a copy of production Neon records. Its middleware therefore requires HTTP Basic Authentication with username `staging` and a unique password stored in the GitHub environment secret `CLOUDFLARE_STAGING_ACCESS_PASSWORD`. Without a password of at least 24 characters, requests fail closed with HTTP 503. Non-authenticated requests return HTTP 401. The staging password is never committed. This is a migration-branch-only protection, not a feature for production.

Before first deployment, create the secret and review Cloudflare's runtime compatibility with reading `process.env.STAGING_ACCESS_PASSWORD` in Next.js middleware. Once staged, verify unauthenticated access returns HTTP 401, authenticated access works, and that protected content is not reachable through static asset endpoints. Prefer adding Cloudflare Access as a second layer.

## Runtime compatibility investigation — 2026-10-16

The following staging-only changes were compiled, deployed, and retested. They **did not** resolve Payload's initialization 500:
- `src/payload.config.ts`: `pool.maxUses: 1` as recommended in Cloudflare's official Payload Workers implementation.
- `next.config.ts`: bundle `pg-cloudflare` rather than marking it external.
- Staging-only `/staging-health`: reports sanitized status and allowlisted diagnostic signatures; no secrets are emitted.

Latest read-only diagnostic: `HTTP 500`, step `initialize-payload`, signature `database-other`, one outer error with no nested cause. Static and some dynamic routes continue to work. Publishing, admin sign-in and CMS runtime have **not passed**.

**Next hypothesis:** Payload config is evaluated at module initialization and captures `process.env.DATABASE_URL` before runtime Worker request bindings are available. Cloudflare's official Payload example uses `getCloudflareContext({ async: true })` and `cloudflare.env.HYPERDRIVE.connectionString` while building Payload's config. A staging-only Hyperdrive configuration connected **strictly to the staging Neon branch** is the next test. Provisioning Hyperdrive needs separate Cloudflare permissions; no ID, connection string or custom domain may be guessed or committed. Ensure binding is configured, then evaluate runtime env and requests. Do not migrate production unless Payload login/edit/publish/media, articles and sitemaps all pass.

Cloudflare source: https://blog.cloudflare.com/payload-cms-workers/
