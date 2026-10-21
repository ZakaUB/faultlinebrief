# Verified D1 feasibility audit — 2026-10-21

## Verified sources
- `main/package.json`: `@payloadcms/db-d1-sqlite`, `@opennextjs/cloudflare`, `@payloadcms/storage-r2`.
- `main/wrangler.jsonc`: D1 binding `D1`, database `faultlinebriefq-db` (ID `dfd85d0b-4f79-4f20-8b91-810ce7a4dc59`); R2 binding `R2` to `faultlinebriefq-media`.
- `main/src/payload.config.ts`: `sqliteD1Adapter({ binding: cloudflare.env.D1 })`; Payload collections in this config are Users and Media ONLY. Do not assume it implements the production article schema or public site.
- Neon staging branch `br-noisy-forest-b4k3mjmr`: public tables `articles`, `articles_rels`, `articles_sources`, `categories`, `media`, `payload_kv`, `payload_locked_documents`, `payload_locked_documents_rels`, `payload_migrations`, `payload_preferences`, `payload_preferences_rels`, `users`, `users_sessions`.
- Vercel production deployment `b5769e6c2c56e293fc28656ac203eb414321525f` was built from `google-news-sitemap`, not `main`. Production implementation and Cloudflare main branch may diverge.

## Important blockers before any D1 import
1. Inspect the actual deployed `google-news-sitemap` source and identify all article/page/database queries.
2. Inventory source table columns/types, foreign keys, indexes, JSON and Lexical rich text structures; design explicit SQLite transforms.
3. Check whether existing Cloudflare D1 database is production or staging before writing to it. DO NOT apply migrations to its current ID without verifying ownership and environment.
4. Provision an **isolated new staging D1**; use an independent staging Worker and R2 bucket.
5. Build parity tests for article slugs, canonical/OG, JSON-LD, news sitemap, source attribution, images, login, editorial publish and cache invalidation.
6. Export and import only into isolated staging; never commit actual user/password/session records or secrets to Git.
7. Do not change Vercel production environment, Neon production schema, DNS, or Cloudflare live routes without explicit cutover approval.

## Conclusion
Storage capacity is sufficient (~34 MB Neon logical database vs 500 MB D1 Free database limit), but compatibility and throughput are not yet validated. D1 is SQLite, not PostgreSQL. Cloudflare Workers Paid may be appropriate for production if row-read/write workloads require it. A safe staging implementation is feasible; production cutover is NOT yet approved.
