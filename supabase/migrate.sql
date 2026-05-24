-- =============================================================================
-- NewsSphere · Migration script
-- Run in SQL Editor on an EXISTING database to apply the v2 schema changes.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards where possible).
-- =============================================================================

-- 1. Profiles: convert TIMESTAMPTZ columns to IST text ───────────────────────
ALTER TABLE profiles
  ALTER COLUMN created_at TYPE TEXT
    USING to_char((created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS'),
  ALTER COLUMN created_at SET DEFAULT
    to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS');

ALTER TABLE profiles
  ALTER COLUMN last_seen TYPE TEXT
    USING to_char((last_seen AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS'),
  ALTER COLUMN last_seen SET DEFAULT
    to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS');

-- 2. Replace saved_searches with saved_news ──────────────────────────────────
DROP TABLE IF EXISTS saved_searches;

CREATE TABLE IF NOT EXISTS saved_news (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_name   TEXT,
  user_email  TEXT,
  article_url TEXT NOT NULL,
  title       TEXT,
  source_name TEXT,
  category    TEXT,
  description TEXT,
  saved_at    TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE (user_id, article_url)
);
ALTER TABLE saved_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own saved news" ON saved_news;
CREATE POLICY "Users manage own saved news" ON saved_news
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Migrate source_prefs → one row per user ─────────────────────────────────
-- Aggregate existing per-source rows into a single array per user.
CREATE TEMP TABLE _sp_backup AS
  SELECT user_id,
         array_agg(source_name ORDER BY source_name) FILTER (WHERE followed) AS followed_sources
  FROM source_prefs
  GROUP BY user_id;

DROP TABLE IF EXISTS source_prefs;

CREATE TABLE source_prefs (
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  user_name        TEXT,
  user_email       TEXT,
  followed_sources TEXT[] DEFAULT '{}',
  updated_at       TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
);
ALTER TABLE source_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own source prefs" ON source_prefs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Restore existing data
INSERT INTO source_prefs (user_id, followed_sources)
  SELECT user_id, COALESCE(followed_sources, '{}') FROM _sp_backup;

-- 4. Migrate topic_prefs → one row per user ──────────────────────────────────
CREATE TEMP TABLE _tp_backup AS
  SELECT user_id,
         array_agg(topic ORDER BY topic) FILTER (WHERE followed) AS followed_topics
  FROM topic_prefs
  GROUP BY user_id;

DROP TABLE IF EXISTS topic_prefs;

CREATE TABLE topic_prefs (
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  user_name       TEXT,
  user_email      TEXT,
  followed_topics TEXT[] DEFAULT '{}',
  updated_at      TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
);
ALTER TABLE topic_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own topic prefs" ON topic_prefs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Restore existing data
INSERT INTO topic_prefs (user_id, followed_topics)
  SELECT user_id, COALESCE(followed_topics, '{}') FROM _tp_backup;
