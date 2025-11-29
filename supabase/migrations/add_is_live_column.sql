-- Add is_live column to streams table
ALTER TABLE streams ADD COLUMN IF NOT EXISTS is_live boolean DEFAULT true;

-- Update existing records: if status = 'live' then is_live = true, else false
UPDATE streams SET is_live = (status = 'live') WHERE is_live IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_streams_is_live ON streams(is_live);

-- Update the view to use is_live
CREATE OR REPLACE VIEW live_streams AS
  SELECT * FROM streams WHERE is_live = true;