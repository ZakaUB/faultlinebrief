# Editorial identities: staged rollout

1. Back up and inspect the staging D1 database before executing `migrations/d1/20261117_editorial_authors.sql`. Apply with Wrangler to **staging** only, not production.
2. Verify the three seed authors and foreign keys; test repeated application for idempotence.
3. Implement authenticated, role-checked author CRUD in the editor Worker and an author selector in the article form. Do not expose user creation until a secure authentication/invitation mechanism is designed. An editorial user profile alone must never grant login access.
4. Ensure the public D1 article API returns the selected author for published articles, and the frontend uses the same name for byline and NewsArticle JSON-LD.
5. Test draft/publish/edit flows, authorization, HTML escaping, inactive authors, missing assignments, and existing articles.
6. After reviewed tests, take a production backup and apply the additive migration to production in a separate approved operation.

**No production D1 change is made by this branch.** This is schema preparation, not a working CMS feature. The staging Users screen currently uses a legacy PostgreSQL `DATABASE_URL` gate; it must be migrated to D1-aware endpoints before the feature works.
