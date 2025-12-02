-- Rename shift_start and shift_end to clock_in and clock_out for clarity
-- This matches the actual UI usage
-- Handles both cases: if columns already renamed, does nothing

DO $$
BEGIN
  -- Rename shift_start to clock_in if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'officer_shift_logs' AND column_name = 'shift_start'
  ) THEN
    ALTER TABLE officer_shift_logs RENAME COLUMN shift_start TO clock_in;
  END IF;

  -- Rename shift_end to clock_out if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'officer_shift_logs' AND column_name = 'shift_end'
  ) THEN
    ALTER TABLE officer_shift_logs RENAME COLUMN shift_end TO clock_out;
  END IF;
END $$;

-- Update indexes
DROP INDEX IF EXISTS idx_officer_shift_logs_active;
CREATE INDEX IF NOT EXISTS idx_officer_shift_logs_active 
  ON officer_shift_logs(officer_id, clock_out) 
  WHERE clock_out IS NULL;

-- Update comments
COMMENT ON COLUMN officer_shift_logs.clock_in IS 'Timestamp when shift started (clock in)';
COMMENT ON COLUMN officer_shift_logs.clock_out IS 'Timestamp when shift ended (clock out, null if active)';

