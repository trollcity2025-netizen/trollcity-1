-- Officer Tier System with Badges
-- Update officer_level descriptions and ensure proper structure

-- Ensure officer_level exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'officer_level') THEN
    ALTER TABLE user_profiles ADD COLUMN officer_level INTEGER DEFAULT 1 CHECK (officer_level >= 1 AND officer_level <= 3);
  END IF;
END $$;

-- Add officer_tier_badge column for visual badge
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'officer_tier_badge') THEN
    ALTER TABLE user_profiles ADD COLUMN officer_tier_badge TEXT DEFAULT 'blue' CHECK (officer_tier_badge IN ('blue', 'orange', 'red'));
  END IF;
END $$;

-- Function to update officer tier badge based on level
CREATE OR REPLACE FUNCTION update_officer_tier_badge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.officer_level IS NOT NULL THEN
    NEW.officer_tier_badge := CASE
      WHEN NEW.officer_level = 1 THEN 'blue'
      WHEN NEW.officer_level = 2 THEN 'orange'
      WHEN NEW.officer_level = 3 THEN 'red'
      ELSE 'blue'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_officer_tier_badge ON user_profiles;
CREATE TRIGGER trigger_update_officer_tier_badge
  BEFORE INSERT OR UPDATE OF officer_level ON user_profiles
  FOR EACH ROW
  WHEN (NEW.is_troll_officer = TRUE OR NEW.role = 'troll_officer')
  EXECUTE FUNCTION update_officer_tier_badge();

-- Update existing officers to have correct badge
UPDATE user_profiles
SET officer_tier_badge = CASE
  WHEN officer_level = 1 THEN 'blue'
  WHEN officer_level = 2 THEN 'orange'
  WHEN officer_level = 3 THEN 'red'
  ELSE 'blue'
END
WHERE (is_troll_officer = TRUE OR role = 'troll_officer')
AND officer_tier_badge IS NULL;

