-- Migration to support Officer Operations and Management
-- 1. Create officer_patrols
-- 2. Create officer_chat_messages
-- 3. Create creator_panic_alerts
-- 4. Create role_change_log
-- 5. Create officer_badges
-- 6. Add necessary columns to user_profiles and officer_work_sessions
-- 7. Create RPCs

-- 1. Officer Patrols
CREATE TABLE IF NOT EXISTS officer_patrols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  patrol_type TEXT NOT NULL,
  priority_level INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Officer Chat Messages (for internal officer comms)
CREATE TABLE IF NOT EXISTS officer_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'chat', -- chat, alert, command
  priority TEXT DEFAULT 'normal', -- normal, high, urgent
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Creator Panic Alerts
CREATE TABLE IF NOT EXISTS creator_panic_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- critical, high, medium, low
  description TEXT,
  status TEXT DEFAULT 'active', -- active, assigned, resolved
  assigned_officer_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 4. Role Change Log
CREATE TABLE IF NOT EXISTS role_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  old_role TEXT,
  new_role TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Officer Badges
CREATE TABLE IF NOT EXISTS officer_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  awarded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- 6. Ensure columns exist on user_profiles and officer_work_sessions
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_officer_active') THEN
    ALTER TABLE user_profiles ADD COLUMN is_officer_active BOOLEAN DEFAULT TRUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_lead_officer') THEN
    ALTER TABLE user_profiles ADD COLUMN is_lead_officer BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'troll_role') THEN
    ALTER TABLE user_profiles ADD COLUMN troll_role TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'officer_work_sessions' AND column_name = 'shift_type') THEN
    ALTER TABLE officer_work_sessions ADD COLUMN shift_type TEXT DEFAULT 'Standard';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'officer_work_sessions' AND column_name = 'patrol_area') THEN
    ALTER TABLE officer_work_sessions ADD COLUMN patrol_area TEXT DEFAULT 'General';
  END IF;
END $$;

-- 7. RPCs

-- assign_officer_patrol
CREATE OR REPLACE FUNCTION assign_officer_patrol(
  p_officer_id UUID,
  p_patrol_type TEXT,
  p_instructions TEXT
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO officer_patrols (officer_id, patrol_type, instructions, status)
  VALUES (p_officer_id, p_patrol_type, p_instructions, 'pending')
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- send_officer_chat_message
CREATE OR REPLACE FUNCTION send_officer_chat_message(
  p_sender_id UUID,
  p_content TEXT,
  p_priority TEXT DEFAULT 'normal'
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO officer_chat_messages (sender_id, content, priority)
  VALUES (p_sender_id, p_content, p_priority)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- create_officer_shift (Maps to officer_shift_slots for scheduling)
CREATE OR REPLACE FUNCTION create_officer_shift(
  p_officer_id UUID,
  p_shift_start TIMESTAMPTZ,
  p_shift_end TIMESTAMPTZ,
  p_patrol_area TEXT
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO officer_shift_slots (officer_id, start_time, end_time, shift_type, status)
  VALUES (p_officer_id, p_shift_start, p_shift_end, p_patrol_area, 'scheduled')
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- set_user_role
DROP FUNCTION IF EXISTS set_user_role(uuid, text, text);

CREATE OR REPLACE FUNCTION set_user_role(
  target_user UUID,
  new_role TEXT,
  reason TEXT
) RETURNS VOID AS $$
DECLARE
  v_old_role TEXT;
  v_admin_id UUID;
BEGIN
  -- Get current user (admin)
  v_admin_id := auth.uid();
  
  -- Check permissions (simple check, RLS should handle more)
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_admin_id AND (role = 'admin' OR is_admin = true)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get old role
  SELECT role INTO v_old_role FROM user_profiles WHERE id = target_user;

  -- Update role
  UPDATE user_profiles 
  SET role = new_role 
  WHERE id = target_user;

  -- Log change
  INSERT INTO role_change_log (target_user, changed_by, old_role, new_role, reason)
  VALUES (target_user, v_admin_id, v_old_role, new_role, reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- set_officer_status
CREATE OR REPLACE FUNCTION set_officer_status(
  target_user_id UUID,
  new_status BOOLEAN,
  reason TEXT
) RETURNS VOID AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_admin_id AND (role = 'admin' OR is_admin = true)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE user_profiles
  SET is_officer_active = new_status
  WHERE id = target_user_id;

  -- Log action (reusing role_change_log for status changes effectively)
  INSERT INTO role_change_log (target_user, changed_by, old_role, new_role, reason)
  VALUES (target_user_id, v_admin_id, 'STATUS_CHANGE', CASE WHEN new_status THEN 'ACTIVE' ELSE 'SUSPENDED' END, reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies (Basic)

ALTER TABLE officer_patrols ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_panic_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_badges ENABLE ROW LEVEL SECURITY;

-- Patrols: Officers/Admins can read all. Admins can insert/update.
CREATE POLICY "Officers view patrols" ON officer_patrols FOR SELECT USING (true); -- Simplify for now, usually restricted
DROP POLICY IF EXISTS "Admins manage patrols" ON officer_patrols;
CREATE POLICY "Admins manage patrols" ON officer_patrols FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
);

-- Chat: Officers can read/write.
DROP POLICY IF EXISTS "Officers chat" ON officer_chat_messages;
CREATE POLICY "Officers chat" ON officer_chat_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'moderator', 'troll_officer') OR is_troll_officer = true))
);

-- Panic Alerts: Creators can insert. Officers/Admins can view/update.
DROP POLICY IF EXISTS "Creators create alerts" ON creator_panic_alerts;
CREATE POLICY "Creators create alerts" ON creator_panic_alerts FOR INSERT WITH CHECK (auth.uid() = creator_id);
DROP POLICY IF EXISTS "Officers view alerts" ON creator_panic_alerts;
CREATE POLICY "Officers view alerts" ON creator_panic_alerts FOR SELECT USING (
  auth.uid() = creator_id OR
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'moderator', 'troll_officer') OR is_troll_officer = true))
);
DROP POLICY IF EXISTS "Officers update alerts" ON creator_panic_alerts;
CREATE POLICY "Officers update alerts" ON creator_panic_alerts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'moderator', 'troll_officer') OR is_troll_officer = true))
);

-- Role Logs: Admins read
DROP POLICY IF EXISTS "Admins view logs" ON role_change_log;
CREATE POLICY "Admins view logs" ON role_change_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
);

-- Badges: Public read (or authenticated), Admin write
DROP POLICY IF EXISTS "Public view badges" ON officer_badges;
CREATE POLICY "Public view badges" ON officer_badges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage badges" ON officer_badges;
CREATE POLICY "Admins manage badges" ON officer_badges FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
);

