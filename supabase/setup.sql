-- =============================================================================
-- NewsSphere · Supabase schema
-- Run in SQL Editor on a fresh database (Dashboard → SQL Editor → Run).
-- For an existing database use migrate.sql instead.
-- =============================================================================

-- IST timestamp helper used as column defaults:
--   to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')

-- 1. Profiles ─────────────────────────────────────────────────────────────────
--    Auto-populated on first Google login via upsertProfile() in useAuth.js.
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID REFERENCES auth.users PRIMARY KEY,
  email      TEXT,
  name       TEXT,
  avatar_url TEXT,
  created_at TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS'),
  last_seen  TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Saved news ───────────────────────────────────────────────────────────────
--    Articles bookmarked by logged-in users (replaces saved_searches).
--    UNIQUE(user_id, article_url) prevents duplicate saves.
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
CREATE POLICY "Users manage own saved news" ON saved_news
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Source preferences ───────────────────────────────────────────────────────
--    One row per user; all followed sources stored as a single array.
--    Toggle a source → update the array, never insert a new row.
CREATE TABLE IF NOT EXISTS source_prefs (
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  user_name        TEXT,
  user_email       TEXT,
  followed_sources TEXT[] DEFAULT '{}',
  updated_at       TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
);
ALTER TABLE source_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own source prefs" ON source_prefs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Topic preferences ────────────────────────────────────────────────────────
--    One row per user; all followed topics stored as a single array.
CREATE TABLE IF NOT EXISTS topic_prefs (
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  user_name       TEXT,
  user_email      TEXT,
  followed_topics TEXT[] DEFAULT '{}',
  updated_at      TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
);
ALTER TABLE topic_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own topic prefs" ON topic_prefs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
