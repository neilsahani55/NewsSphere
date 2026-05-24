-- =============================================================================
-- NewsSphere · Migration script  (idempotent — safe to run multiple times)
-- Run in SQL Editor → "Run without RLS"
-- Each step checks the current schema before making changes.
-- =============================================================================

-- 1. Profiles: convert TIMESTAMPTZ columns to IST text ───────────────────────
--    Skipped automatically if the columns are already TEXT.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'profiles'
        AND column_name  = 'created_at') = 'timestamp with time zone'
  THEN
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
  END IF;
END $$;

-- 2. saved_news: collapse to one row per user ────────────────────────────────
--    Handles three possible starting states:
--      a) Old multi-row schema  (column: article_url singular)  → collapse & recreate
--      b) New single-row schema (column: article_urls plural)   → already done, skip
--      c) Table missing entirely (was saved_searches)           → create fresh
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'saved_news'
      AND column_name = 'article_url'          -- old multi-row schema
  ) THEN
    -- Back up existing rows into one array per user
    CREATE TEMP TABLE _sn_backup AS
      SELECT user_id, user_name, user_email,
             array_agg(article_url ORDER BY saved_at) AS article_urls
      FROM saved_news
      GROUP BY user_id, user_name, user_email;

    DROP TABLE saved_news;

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

    INSERT INTO saved_news (user_id, user_name, user_email, article_urls)
      SELECT user_id, user_name, user_email, COALESCE(article_urls, '{}')
      FROM _sn_backup;

  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'saved_news'
  ) THEN
    -- Table never existed (or was saved_searches) — create fresh
    DROP TABLE IF EXISTS saved_searches;

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
  END IF;
  -- If article_urls column already exists, nothing to do.
END $$;

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
--    Skipped if user_prefs already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_prefs'
  ) THEN
    -- Back up both tables
    CREATE TEMP TABLE _sp_backup AS
      SELECT user_id, user_name, user_email,
             COALESCE(followed_sources, '{}') AS followed_sources
      FROM source_prefs;

    CREATE TEMP TABLE _tp_backup AS
      SELECT user_id,
             COALESCE(followed_topics, '{}') AS followed_topics
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

    -- Merge rows (a user may exist in one or both backup tables)
    INSERT INTO user_prefs (user_id, user_name, user_email, followed_sources, followed_topics)
      SELECT
        COALESCE(sp.user_id, tp.user_id),
        sp.user_name,
        sp.user_email,
        COALESCE(sp.followed_sources, '{}'),
        COALESCE(tp.followed_topics, '{}')
      FROM _sp_backup sp
      FULL OUTER JOIN _tp_backup tp ON sp.user_id = tp.user_id;
  END IF;
END $$;
