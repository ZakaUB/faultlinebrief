# SonicJS migration validation — 2026-10-17

**Scope:** SonicJS staging Worker, isolated D1 `faultlinebrief-sonicjs-staging`, staging R2 only. Production Faultline Brief remains unchanged.

## Confirmed
- Separate Worker deployed: `faultlinebrief-sonicjs-cms-staging.zakria25.workers.dev`.
- D1 migration files 0001–0007 audited and applied. 20 tables verified.
- Protected staging gateway denies anonymous requests (HTTP 401); approved staging credentials pass the gateway.
- Correct SonicJS browser login route `/auth/login` returns HTTP 200.
- `/admin` redirects to login (HTTP 302) with browser `Accept: text/html`.
- Required JWT_SECRET and BETTER_AUTH_SECRET created as Cloudflare secrets, never committed.
- Disposable `POST /auth/register` succeeds (HTTP 201).
- Disposable `POST /auth/login` returns HTTP 500, after secrets and Drizzle ORM peer alignment.
- First registered disposable account reported role `viewer`, not `admin`.
- Scoped disposable-user cleanup verified: 0 users, 0 sessions in D1 after tests.
- Existing staging Neon article source remains separate from SonicJS; no editorial article import attempted.

## Blockers — no-go for production migration
1. Password-based administrator sign-in fails HTTP 500.
2. First registered account does not receive administrator role in observed response.
3. Admin create/edit/publish, media upload, editorial placement and frontend parity remain unverified.
4. SonicJS beta migration tracking and bootstrapped content must be validated before any import. D1 `documents` contained 81 app/bootstrap rows at last check, not the 29 imported Faultline Brief stories.

## Action policy
- Maintain production Vercel and Neon without changes.
- Do not expose default SonicJS admin credentials or weaken staging gateway.
- Do not import production articles until administrator auth and role model work and disposable-content tests pass.
- Keep Cloudflare staging Worker isolated from existing Faultline Brief Cloudflare staging frontend.

## Evidence
- GitHub workflow runs: 39025099897 schema initialization; 39025689202 login page; 39026167956 disposable registration/login; 39026385212 dependency-aligned retest; 39026506885 post-test cleanup.
