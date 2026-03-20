-- Add battle_id column to broadcast_challenges table
ALTER TABLE broadcast_challenges 
ADD COLUMN IF NOT EXISTS battle_id UUID REFERENCES battles(id) ON DELETE SET NULL;

-- Add seat_index column to track which seat challenger was assigned
ALTER TABLE broadcast_challenges
ADD COLUMN IF NOT EXISTS seat_index INTEGER;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_broadcast_challenges_battle_id 
ON broadcast_challenges(battle_id) 
WHERE battle_id IS NOT NULL;

COMMENT ON COLUMN broadcast_challenges.battle_id IS 'Reference to the battle created when challenge is accepted';
COMMENT ON COLUMN broadcast_challenges.seat_index IS 'Seat index assigned to challenger when challenge is accepted';

-- Add is_challenger column to stream_seat_sessions table
ALTER TABLE stream_seat_sessions
ADD COLUMN IF NOT EXISTS is_challenger BOOLEAN DEFAULT false;

COMMENT ON COLUMN stream_seat_sessions.is_challenger IS 'Whether this seat was claimed by a challenger';
