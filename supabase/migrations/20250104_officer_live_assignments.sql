-- Create officer_live_assignments table to track when officers join/leave streams
CREATE TABLE IF NOT EXISTS officer_live_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' or 'left'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('active', 'left'))
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_officer_live_assignments_officer_id ON officer_live_assignments(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_live_assignments_stream_id ON officer_live_assignments(stream_id);
CREATE INDEX IF NOT EXISTS idx_officer_live_assignments_status ON officer_live_assignments(status);
CREATE INDEX IF NOT EXISTS idx_officer_live_assignments_officer_stream ON officer_live_assignments(officer_id, stream_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_officer_live_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER officer_live_assignments_updated_at
  BEFORE UPDATE ON officer_live_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_officer_live_assignments_updated_at();

-- Add comment
COMMENT ON TABLE officer_live_assignments IS 'Tracks when troll officers join and leave live streams for admin monitoring';

