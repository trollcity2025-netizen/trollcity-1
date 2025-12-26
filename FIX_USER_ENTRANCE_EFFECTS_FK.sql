-- ==============================================
-- FIX USER ENTRANCE EFFECTS FOREIGN KEY
-- Copy and paste this file to fix the FK constraint
-- ==============================================

-- Drop and recreate user_entrance_effects with proper FK
DROP TABLE IF EXISTS user_entrance_effects CASCADE;

-- Recreate with correct foreign key reference to entrance_effects table
CREATE TABLE user_entrance_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  effect_id TEXT NOT NULL REFERENCES entrance_effects(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT false,
  activation_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, effect_id)
);

CREATE INDEX idx_user_entrance_effects_user ON user_entrance_effects(user_id);
CREATE INDEX idx_user_entrance_effects_active ON user_entrance_effects(user_id) WHERE is_active = true;

-- Enable RLS
ALTER TABLE user_entrance_effects ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own entrance effects"
  ON user_entrance_effects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entrance effects"
  ON user_entrance_effects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entrance effects"
  ON user_entrance_effects FOR UPDATE
  USING (auth.uid() = user_id);

SELECT 'user_entrance_effects table recreated successfully' as status;
