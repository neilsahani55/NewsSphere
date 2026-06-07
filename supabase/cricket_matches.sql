-- Cricket matches table — populated by GitHub Actions cricket pipeline
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS cricket_matches (
  match_id     TEXT PRIMARY KEY,          -- "ci_12345" or "cb_12345"
  series_name  TEXT DEFAULT '',
  match_title  TEXT NOT NULL,
  match_format TEXT DEFAULT '',           -- TEST / ODI / T20 / IPL etc.
  state        TEXT NOT NULL DEFAULT 'pre' CHECK (state IN ('in', 'pre', 'post')),
  status_text  TEXT DEFAULT '',
  venue        TEXT DEFAULT '',
  match_date   TIMESTAMPTZ,              -- null for Cricbuzz matches (no date in HTML)
  teams        JSONB NOT NULL DEFAULT '[]', -- [{name, score, winner}]
  is_india     BOOLEAN DEFAULT false,
  source       TEXT DEFAULT 'espncricinfo',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast India-match queries
CREATE INDEX IF NOT EXISTS idx_cricket_is_india  ON cricket_matches (is_india);
CREATE INDEX IF NOT EXISTS idx_cricket_state     ON cricket_matches (state);
CREATE INDEX IF NOT EXISTS idx_cricket_updated   ON cricket_matches (updated_at DESC);

-- Allow Vercel (anon key) to read
ALTER TABLE cricket_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cricket_matches"
  ON cricket_matches FOR SELECT
  USING (true);
