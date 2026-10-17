# SonicJS staging migration inventory

Source database: isolated Neon branch br-noisy-forest-b4k3mjmr.
Source counts verified 2026-10-17: 29 articles (29 published), 30 media, 3 categories.
Target: new D1 database faultlinebrief-sonicjs-staging, not created yet (Cloudflare D1 API returned HTTP 401).
SonicJS starter CLI checked: create-sonicjs v3.0.0-beta.28, interactive prompt; must use validated unattended installation process.
Preserve exact article slugs, publish status, editorial placement, SEO metadata, timestamps and category links.
Convert Lexical body documents carefully and compare normalized text before publishing.
Do not change the existing Faultline Brief frontend, DNS, Payload database, or deployed production services.
Never import to any shared/production D1 instance or R2 bucket.
Validation gates: counts, slugs, text fidelity, photos, CMS login, create/edit/publish, sitemaps and performance.
