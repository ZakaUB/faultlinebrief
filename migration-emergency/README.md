# Faultline Brief emergency migration — 2026-10-21

SAFE PREPARATION ONLY. This branch is isolated from the production deployment branch `google-news-sitemap`. Do not merge, change production environment variables, or switch DNS until explicit approval after 18:00 Pakistan time.

## Current state
- Neon project: holy-breeze-85807377; production: br-dry-fog-b4q67dzl
- Existing Neon staging: br-noisy-forest-b4k3mjmr
- Vercel production deployment: b5769e6c2c56e293fc28656ac203eb414321525f
- Neon project transfer at last check: 4,408,948,224 bytes; reset 2026-11-01 00:00 UTC
- This repository's main branch already contains Cloudflare D1/Payload packages; **do not assume the Vercel production branch uses that schema**.

## Preflight (mandatory)
1. Obtain a fresh, consistent read-only export of the production PostgreSQL database; save encrypted backup outside public Git.
2. Inventory production tables, constraints, indexes, extensions, relations, JSON and media references.
3. Inspect actual production application query code and CMS writes; determine whether D1 can implement equivalent behavior. PostgreSQL SQL dumps are NOT directly executable in SQLite.
4. Provision a new isolated D1 staging database and R2 media bucket if needed. Never reuse live credentials in staging.
5. Build an explicit table-by-table PostgreSQL-to-SQLite transform; preserve IDs, slugs, timestamps, drafts, published status, users and password hashes. Avoid public copies of private tables.
6. Import into staging, compare row counts/checksums and foreign keys, test login, create/edit/publish, images, sitemap, canonical, structured data and OG.
7. Test traffic and cache behavior on staging; ensure sitemap freshness and publication invalidation.
8. Only after written approval: freeze writes briefly, perform delta export/import, verify parity, switch environment/DNS, observe, retain rollback path.

## GO/NO-GO
Do not cut over unless every check in CHECKLIST.md passes. Keep original Neon production available for rollback. Avoid schema changes or deletion in Neon.
