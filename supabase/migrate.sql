-- =============================================================================
-- NewsSphere · Migration script
-- Run in SQL Editor on an EXISTING database (select "Run without RLS").
-- Preserves all existing user data.
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

-- 2. saved_news: collapse to one row per user ────────────────────────────────
-- Back up existing multi-row data into a single URL array per user.
CREATE TEMP TABLE _sn_backup AS
  SELECT user_id, user_name, user_email,
         array_agg(article_url ORDER BY saved_at) AS article_urls
  FROM saved_news
  GROUP BY user_id, user_name, user_email;

DROP TABLE IF EXISTS saved_news;

CREATE TABLE saved_news (
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  user_name    TEXT,
  user_email   TEXT,
  article_urls TEXT[] DEFAULT '{}',
  updated_at   TEXT DEFAULT to_char((NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:MI:SS')
);
ALTER TABLE saved_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved news" ON saved_news
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Restore existing saves
INSERT INTO saved_news (user_id, user_name, user_email, article_urls)
  SELECT user_id, user_name, user_email, COALESCE(article_urls, '{}')
  FROM _sn_backup;

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

-- 3. Merge source_prefs + topic_prefs → user_prefs ───────────────────────────
-- Back up both tables before dropping them.
CREATE TEMP TABLE _sp_backup AS
  SELECT user_id, user_name, user_email, followed_sources
  FROM source_prefs;

CREATE TEMP TABLE _tp_backup AS
  SELECT user_id, followed_topics
  FROM topic_prefs;

DROP TABLE IF EXISTS source_prefs;
DROP TABLE IF EXISTS topic_prefs;

CREATE TABLE user_prefs (
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

-- Merge: a user may exist in one or both backup tables.
INSERT INTO user_prefs (user_id, user_name, user_email, followed_sources, followed_topics)
  SELECT
    COALESCE(sp.user_id, tp.user_id),
    sp.user_name,
    sp.user_email,
    COALESCE(sp.followed_sources, '{}'),
    COALESCE(tp.followed_topics, '{}')
  FROM _sp_backup sp
  FULL OUTER JOIN _tp_backup tp ON sp.user_id = tp.user_id;
