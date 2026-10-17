# Faultline Brief — isolated Node.js Payload authentication staging

**Status:** architecture approved by site owner, deployment blocked by Vercel project-creation authorization. Production cutover is NOT authorized.

## Isolation contract

- NEVER modify production Vercel project `faultlinebrief` (`prj_ITo4riU524v8ub56KHCjoIxyVcxh`), production DNS, production Git branch, production Neon branch, or production R2 media.
- Current Cloudflare Worker: `faultlinebrief-cf-staging`, with HTTP Basic protection; isolated Neon `br-noisy-forest-b4k3mjmr` and R2 `faultlinebrief-staging-media`.
- Proposed Node.js CMS/Auth project: `faultlinebrief-payload-auth-staging` on Vercel, **new project** only, no custom domain.
- Deploy this isolated Node.js project from `cloudflare-staging-migration` with staging Neon DATABASE_URL, staging R2 credentials, and separately scoped PAYLOAD_SECRET. Never copy production environment variables.
- Private admin routing and session/cookie behavior must be validated end to end; a Node.js auth endpoint alone cannot simply replace Payload's internal auth across origins without a secure session integration.
- Use the same Payload CMS configuration and database models for staging. Avoid implementing a bespoke password service or lowering PBKDF2 work factor.
- Protect the new deployment from anonymous access and indexers; confirm its effective hostname and prevent public signups before testing. No deployment is valid until this is checked.
- Once provisioned, test temporary user creation, real login, session reading, editing, publishing, media upload to staging R2, logout and cleanup on staging Neon.
- Cloudflare public pages may continue to serve the public site while authenticated CMS admin/API operate on Node, but cross-host authorization and routing must be demonstrated before migration.

## Blocker observed 2026-10-17

Vercel `create_project` for isolated `faultlinebrief-payload-auth-staging` returned HTTP 403: unauthorized to access `zakria25-6105` team scope. The existing production project was NOT modified. Correct authorization for creating *new* projects in that scope is required before proceeding to deployment. Never fall back to editing the existing production project.

## Compatibility risk

Payload 3.90.2 password operations raise `NotSupportedError` on Cloudflare Workers, consistent with its PBKDF2 iteration limit. Keep password hashing unchanged and use supported Node.js runtime for CMS authentication. Do not assume authentication sessions work across Worker/Node services until validated.
