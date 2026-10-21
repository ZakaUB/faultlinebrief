-- Isolated staging D1 read model. Never apply to existing production D1.
-- This is NOT a replacement for Payload's complete relational schema.
CREATE TABLE IF NOT EXISTS migration_articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  updated_at TEXT,
  content_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  source_json TEXT NOT NULL DEFAULT '[]',
  image_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_migration_articles_status_published
  ON migration_articles(status, published_at DESC);
CREATE TABLE IF NOT EXISTS migration_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  raw_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS migration_media (
  id TEXT PRIMARY KEY,
  raw_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS migration_manifest (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
