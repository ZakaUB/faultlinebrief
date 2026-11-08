-- Apply to a staging D1 database first; do not run against production without approval.
CREATE TABLE IF NOT EXISTS cms_publish_approvals (
 token_hash TEXT PRIMARY KEY,
 article_id TEXT NOT NULL,
 slug TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_publish_approvals_expiry ON cms_publish_approvals(expires_at);
