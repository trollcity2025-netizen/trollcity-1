-- Add popularity column to streams table
ALTER TABLE streams
  ADD COLUMN IF NOT EXISTS popularity INTEGER DEFAULT 0 CHECK (popularity >= 0 AND popularity <= 1000000);

-- Create index for popularity queries
CREATE INDEX IF NOT EXISTS idx_streams_popularity ON streams(popularity DESC);

