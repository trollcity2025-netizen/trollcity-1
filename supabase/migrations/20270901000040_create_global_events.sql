CREATE TABLE IF NOT EXISTS global_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title TEXT NOT NULL,
  icon TEXT,
  priority INTEGER DEFAULT 1
);

ALTER TABLE global_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global events are viewable by everyone" ON global_events
  FOR SELECT
  USING (true);
