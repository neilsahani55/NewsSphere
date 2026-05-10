-- NewsSphere — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query

CREATE TABLE IF NOT EXISTS news (
  id               BIGSERIAL PRIMARY KEY,
  fetched_at_ist   TIMESTAMPTZ DEFAULT NOW(),
  category         TEXT DEFAULT '',
  article_url      TEXT UNIQUE NOT NULL,
  title            TEXT NOT NULL DEFAULT '',
  description      TEXT DEFAULT '',
  content          TEXT DEFAULT '',
  key_points       TEXT DEFAULT '',
  image_url        TEXT DEFAULT '',
  published_at_ist TIMESTAMPTZ,
  source_name      TEXT DEFAULT '',
  language         TEXT DEFAULT 'en',
  country          TEXT DEFAULT '',
  sentiment        TEXT DEFAULT '',
  enriched         BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Fast ordering and filtering
CREATE INDEX IF NOT EXISTS idx_news_published ON news (published_at_ist DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_news_enriched  ON news (enriched);
CREATE INDEX IF NOT EXISTS idx_news_category  ON news (category);
CREATE INDEX IF NOT EXISTS idx_news_created   ON news (created_at DESC);

-- Row Level Security: public reads, service_role writes
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read" ON news;
CREATE POLICY "Public read" ON news FOR SELECT USING (true);
