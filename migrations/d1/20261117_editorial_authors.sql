-- Faultline Brief: additive D1 editorial identities migration.
-- Apply to isolated staging D1 first; backup and inspect production before any live application.
-- Public author identities are NOT login accounts. Never store passwords or tokens here.
CREATE TABLE IF NOT EXISTS editorial_authors (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 2 AND 120),
  slug TEXT NOT NULL UNIQUE,
  bio TEXT NOT NULL DEFAULT '',
  profile_url TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS editorial_user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('admin','editor','contributor')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  author_id TEXT REFERENCES editorial_authors(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- These profiles are authorization metadata only. Authentication must remain
-- in the existing secure identity provider; never accept a role from client input.
CREATE TABLE IF NOT EXISTS editorial_article_authors (
  article_slug TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES editorial_authors(id) ON DELETE RESTRICT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_editorial_authors_active ON editorial_authors(active,display_name);
CREATE INDEX IF NOT EXISTS idx_editorial_article_authors_author ON editorial_article_authors(author_id);
INSERT OR IGNORE INTO editorial_authors(id,display_name,slug) VALUES
 ('editorial-desk','Faultline Brief Editorial Desk','editorial-desk'),
 ('news-desk','News Desk','news-desk'),
 ('za-ayoubi','Z.A AYOUBI','za-ayoubi');
-- Existing articles remain unchanged and use the Editorial Desk fallback
-- until explicitly assigned an author by the CMS.
