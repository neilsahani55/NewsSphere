-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)

-- 1. Profiles (auto-populated on first Google login)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID REFERENCES auth.users PRIMARY KEY,
  email       TEXT,
  name        TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_seen   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Saved searches
CREATE TABLE IF NOT EXISTS saved_searches (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  query      TEXT NOT NULL,
  topics     TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own searches" ON saved_searches
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Source preferences
CREATE TABLE IF NOT EXISTS source_prefs (
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  followed    BOOLEAN DEFAULT true,
  PRIMARY KEY (user_id, source_name)
);
ALTER TABLE source_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own source prefs" ON source_prefs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Topic preferences
CREATE TABLE IF NOT EXISTS topic_prefs (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  topic   TEXT NOT NULL,
  followed BOOLEAN DEFAULT true,
  PRIMARY KEY (user_id, topic)
);
ALTER TABLE topic_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own topic prefs" ON topic_prefs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
