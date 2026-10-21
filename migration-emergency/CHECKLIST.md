# Migration acceptance and rollback checklist

- [ ] Production PostgreSQL backup completed, encrypted, and restore-tested
- [ ] Production schema and application query compatibility reviewed
- [ ] Cloudflare D1 staging database provisioned (separate from production)
- [ ] Schema conversion verified including unique constraints and indexes
- [ ] Full data export and staging import completed with matching row counts
- [ ] All published article URLs return 200 and exact content
- [ ] Drafts remain private; editor authentication and roles work
- [ ] Media URLs, alt text, source attribution and featured images match
- [ ] Lead/featured/news/category placement matches
- [ ] Article creation, editing, publishing, preview, and rollback work
- [ ] Canonical, Open Graph, NewsArticle schema and robots unchanged
- [ ] /sitemap.xml and /news-sitemap.xml correct, recent stories present
- [ ] Cache invalidation on publish works, without high-frequency DB reads
- [ ] Representative production traffic tested against staging
- [ ] Current Neon usage and remaining quota rechecked
- [ ] Final write freeze and delta sync strategy rehearsed
- [ ] Explicit user approval obtained for production cutover
- [ ] Rollback: original Vercel deployment and Neon env values recorded securely
- [ ] Post-cutover smoke tests and traffic monitoring passed

NO-GO if any content, credentials, editor workflow, or SEO URL fails parity.
