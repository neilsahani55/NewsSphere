-- NewsSphere — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- All statements are idempotent (safe to run multiple times).

-- ── News articles ─────────────────────────────────────────────────────────────
-- Populated by the GitHub Actions pipeline every 30 minutes.
-- Browser reads use the anon key; writes use the service-role key (pipeline only).

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

-- ── User profiles ─────────────────────────────────────────────────────────────
-- Created/updated on every Google Sign-In. id matches auth.users.id.

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY,
  email      TEXT,
  name       TEXT,
  avatar_url TEXT,
  last_seen  TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS'),
  created_at TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile"   ON profiles;
DROP POLICY IF EXISTS "Users upsert own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;

CREATE POLICY "Users read own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users upsert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── Saved news (bookmarks) ────────────────────────────────────────────────────
-- One row per user; article_urls is the full list of bookmarked article URLs.
-- Updated on every bookmark toggle; read on every login to sync across devices.

CREATE TABLE IF NOT EXISTS saved_news (
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  user_name    TEXT,
  user_email   TEXT,
  article_urls TEXT[] DEFAULT '{}',
  updated_at   TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
);

ALTER TABLE saved_news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saved news" ON saved_news;
CREATE POLICY "Users manage own saved news" ON saved_news
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger: auto-remove deleted articles from every user's saved list.
CREATE OR REPLACE FUNCTION fn_cleanup_saved_news()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE saved_news
  SET article_urls = array_remove(article_urls, OLD.article_url),
      updated_at   = to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
  WHERE OLD.article_url = ANY(article_urls);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_news_delete_cleanup ON news;
CREATE TRIGGER trg_news_delete_cleanup
AFTER DELETE ON news
FOR EACH ROW EXECUTE FUNCTION fn_cleanup_saved_news();

-- ── User preferences ──────────────────────────────────────────────────────────
-- Stores followed sources and topics for the "Your Special" personalised feed.

CREATE TABLE IF NOT EXISTS user_prefs (
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  user_name        TEXT,
  user_email       TEXT,
  followed_sources TEXT[] DEFAULT '{}',
  followed_topics  TEXT[] DEFAULT '{}',
  updated_at       TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
);

ALTER TABLE user_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own prefs" ON user_prefs;
CREATE POLICY "Users manage own prefs" ON user_prefs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Today in History ──────────────────────────────────────────────────────────
-- Populated daily by the history-pipeline GitHub Action (Wikipedia On This Day).
-- Browser reads use the anon key; writes use the service-role key (pipeline only).

CREATE TABLE IF NOT EXISTS today_history (
  id           BIGSERIAL PRIMARY KEY,
  history_date TEXT NOT NULL,
  event_year   TEXT NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  description  TEXT DEFAULT '',
  category     TEXT DEFAULT '',
  details      TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_history_date ON today_history (history_date);

ALTER TABLE today_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read history" ON today_history;
CREATE POLICY "Public read history" ON today_history FOR SELECT USING (true);
