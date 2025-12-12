-- Create Tromody battles table to track comedy battle results
CREATE TABLE IF NOT EXISTS tromody_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id text NOT NULL UNIQUE, -- Unique identifier for each battle session
  left_user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  right_user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  winner_user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  left_gifts_received bigint DEFAULT 0,
  right_gifts_received bigint DEFAULT 0,
  battle_duration_seconds integer DEFAULT 180,
  battle_started_at timestamptz DEFAULT NOW(),
  battle_ended_at timestamptz,
  created_at timestamptz DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tromody_battles_left_user ON tromody_battles(left_user_id);
CREATE INDEX IF NOT EXISTS idx_tromody_battles_right_user ON tromody_battles(right_user_id);
CREATE INDEX IF NOT EXISTS idx_tromody_battles_winner ON tromody_battles(winner_user_id);
CREATE INDEX IF NOT EXISTS idx_tromody_battles_started_at ON tromody_battles(battle_started_at DESC);

-- Enable RLS
ALTER TABLE tromody_battles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view battles they participated in" ON tromody_battles
  FOR SELECT USING (auth.uid() = left_user_id OR auth.uid() = right_user_id);

CREATE POLICY "Admins can view all battles" ON tromody_battles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Comments
COMMENT ON TABLE tromody_battles IS 'Records of completed Tromody comedy battles';
COMMENT ON COLUMN tromody_battles.battle_id IS 'Unique identifier for each battle session';
COMMENT ON COLUMN tromody_battles.left_gifts_received IS 'Total gifts received by left side participant';
COMMENT ON COLUMN tromody_battles.right_gifts_received IS 'Total gifts received by right side participant';