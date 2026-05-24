-- =============================================================================
-- NewsSphere · Supabase schema
-- Run in SQL Editor on a FRESH database (Dashboard → SQL Editor → Run).
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
--    One row per user. article_urls is an array of bookmarked article URLs.
--    The trigger below automatically removes any URL when its news row is deleted
--    (articles expire after ~30 days).
CREATE TABLE IF NOT EXISTS saved_news (
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  user_name    TEXT,
  user_email   TEXT,
  article_urls TEXT[] DEFAULT '{}',
  updated_at   TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
);
ALTER TABLE saved_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved news" ON saved_news
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger: when a news row is deleted, remove its URL from every user's saved list.
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

CREATE TRIGGER trg_news_delete_cleanup
AFTER DELETE ON news
FOR EACH ROW EXECUTE FUNCTION fn_cleanup_saved_news();

-- 3. User preferences ─────────────────────────────────────────────────────────
--    One row per user. Stores both followed sources and followed topics together.
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  user_name        TEXT,
  user_email       TEXT,
  followed_sources TEXT[] DEFAULT '{}',
  followed_topics  TEXT[] DEFAULT '{}',
  updated_at       TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
);
ALTER TABLE user_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON user_prefs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
