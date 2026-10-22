# Production-to-staging article reconciliation — 2026-10-22

Read-only Neon SQL comparison of production branch `br-dry-fog-b4q67dzl` against staging branch `br-noisy-forest-b4k3mjmr`.

- Production: **40 published articles**
- Staging: **79 articles**, including **50 staging-only test slugs**
- Shared by exact slug: **29**; shared headlines match
- **11 published production articles missing from staging**

## Missing published production slugs

1. `canada-wainwright-military-base-explosion-seven-dead-live-fire-drill`
2. `houthi-missile-strike-yemen-shabwa-soldiers-killed`
3. `iran-war-energy-crisis-russia-sanctions-us-strategy`
4. `middle-east-emerging-power-blocs-regional-alliances`
5. `pakistan-qatar-us-iran-compromise-nuclear-inspections`
6. `putin-trump-xi-summit-ukraine-peace-talks`
7. `russia-lavrov-tehran-iran-war-diplomacy`
8. `trump-zelensky-rift-ukraine-us-support-october-2026`
9. `uk-raf-typhoon-jets-saudi-arabia-houthi-attacks`
10. `ukraine-winter-air-defense-europe-us-rift-2026`
11. `white-house-press-secretary-ousted-state-department-turmoil`

## Cutover blocking actions

- Build a **production-sourced** D1 import with all 40 production articles; do not use staging as source of truth.
- Transfer related category relationships, source links, rich-text bodies, image metadata and image bytes/URLs.
- Exclude every `cf-staging-test-` record from the production dataset.
- Verify 40/40 published slugs, content fields, images and SEO metadata against production read-only source.
- Recheck the live site just before cutover; recent editorial changes may add articles.
- Keep Vercel, production Neon and live DNS unchanged until explicit cutover approval.

This report records observed differences only; no production data was modified.
