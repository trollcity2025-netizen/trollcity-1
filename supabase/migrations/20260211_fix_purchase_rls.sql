-- Fix RLS policies for purchase tables
-- Allow authenticated users and service_role to insert purchase records

DROP POLICY IF EXISTS "Users can insert their own entrance effects" ON user_entrance_effects;
DROP POLICY IF EXISTS "Users can insert own effects" ON user_entrance_effects;

ALTER TABLE user_entrance_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entrance_insert" ON user_entrance_effects 
FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can insert their own perks" ON user_perks;
ALTER TABLE user_perks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perks_insert" ON user_perks 
FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can insert their own insurances" ON user_insurances;
ALTER TABLE user_insurances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance_insert" ON user_insurances 
FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');
