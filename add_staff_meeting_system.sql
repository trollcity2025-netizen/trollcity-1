-- Staff Meeting System Database Schema
-- This creates tables for staff meeting scheduling and room management

-- Table to store scheduled staff meetings
CREATE TABLE IF NOT EXISTS staff_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) DEFAULT 'Company Meeting',
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  room_name VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  max_participants INTEGER DEFAULT 9,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to track meeting participants
CREATE TABLE IF NOT EXISTS staff_meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES staff_meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(meeting_id, user_id)
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_staff_meetings_status ON staff_meetings(status);
CREATE INDEX IF NOT EXISTS idx_staff_meetings_scheduled_at ON staff_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_staff_meeting_participants_meeting ON staff_meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_staff_meeting_participants_user ON staff_meeting_participants(user_id);

-- Function to check if a user can access staff meetings
CREATE OR REPLACE FUNCTION can_access_staff_meeting(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  profile RECORD;
BEGIN
  -- Get user profile
  SELECT * INTO profile FROM user_profiles WHERE id = user_id;
  
  IF profile IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user has any staff role
  IF profile.role = 'admin' OR profile.is_admin = TRUE THEN
    RETURN TRUE;
  END IF;
  
  IF profile.is_troll_officer = TRUE OR profile.is_lead_officer = TRUE THEN
    RETURN TRUE;
  END IF;
  
  IF profile.is_pastor = TRUE THEN
    RETURN TRUE;
  END IF;
  
  IF profile.role = 'secretary' THEN
    RETURN TRUE;
  END IF;
  
  IF profile.is_troller = TRUE THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can START a staff meeting (Admin, CEO, Lead Troll Officers only)
CREATE OR REPLACE FUNCTION can_start_staff_meeting(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  profile RECORD;
BEGIN
  SELECT * INTO profile FROM user_profiles WHERE id = user_id;
  
  IF profile IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admin can always start
  IF profile.role = 'admin' OR profile.is_admin = TRUE THEN
    RETURN TRUE;
  END IF;
  
  -- Lead officers can start
  IF profile.is_lead_officer = TRUE OR profile.officer_role = 'lead_officer' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can SCHEDULE a staff meeting (Admin, Lead Troll Officers, Secretary)
CREATE OR REPLACE FUNCTION can_schedule_staff_meeting(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  profile RECORD;
BEGIN
  SELECT * INTO profile FROM user_profiles WHERE id = user_id;
  
  IF profile IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admin can always schedule
  IF profile.role = 'admin' OR profile.is_admin = TRUE THEN
    RETURN TRUE;
  END IF;
  
  -- Lead officers can schedule
  IF profile.is_lead_officer = TRUE OR profile.officer_role = 'lead_officer' THEN
    RETURN TRUE;
  END IF;
  
  -- Secretary can schedule
  IF profile.role = 'secretary' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's staff meeting permission level
-- Returns: 'none', 'join_only', 'schedule', 'start'
CREATE OR REPLACE FUNCTION get_staff_meeting_permission(user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  profile RECORD;
BEGIN
  SELECT * INTO profile FROM user_profiles WHERE id = user_id;
  
  IF profile IS NULL THEN
    RETURN 'none';
  END IF;
  
  -- Admin can do everything
  IF profile.role = 'admin' OR profile.is_admin = TRUE THEN
    RETURN 'start';
  END IF;
  
  -- Lead officers can start and schedule
  IF profile.is_lead_officer = TRUE OR profile.officer_role = 'lead_officer' THEN
    RETURN 'start';
  END IF;
  
  -- Secretary can schedule
  IF profile.role = 'secretary' THEN
    RETURN 'schedule';
  END IF;
  
  -- Officers, pastors, trollers can join
  IF profile.is_troll_officer = TRUE OR profile.is_pastor = TRUE OR profile.is_troller = TRUE THEN
    RETURN 'join_only';
  END IF;
  
  RETURN 'none';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if meeting room is at capacity
CREATE OR REPLACE FUNCTION is_staff_meeting_full(meeting_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  max_count INTEGER;
BEGIN
  SELECT COUNT(*), m.max_participants 
  INTO current_count, max_count 
  FROM staff_meeting_participants p
  JOIN staff_meetings m ON m.id = p.meeting_id
  WHERE p.meeting_id = meeting_id AND p.is_active = TRUE
  GROUP BY m.max_participants;
  
  RETURN current_count >= max_count;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE staff_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_meeting_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_meetings
CREATE POLICY "Staff can view staff meetings" ON staff_meetings
  FOR SELECT USING (can_access_staff_meeting(auth.uid()));

CREATE POLICY "Authorized users can insert staff meetings" ON staff_meetings
  FOR INSERT WITH CHECK (can_schedule_staff_meeting(auth.uid()));

CREATE POLICY "Starters can update staff meetings" ON staff_meetings
  FOR UPDATE USING (can_start_staff_meeting(auth.uid()));

-- RLS Policies for staff_meeting_participants
CREATE POLICY "Staff can view participants" ON staff_meeting_participants
  FOR SELECT USING (can_access_staff_meeting(auth.uid()));

CREATE POLICY "Participants can insert themselves" ON staff_meeting_participants
  FOR INSERT WITH CHECK (staff_meeting_participants.user_id = auth.uid() AND can_access_staff_meeting(auth.uid()));

CREATE POLICY "Participants can update their own status" ON staff_meeting_participants
  FOR UPDATE USING (staff_meeting_participants.user_id = auth.uid());

COMMENT ON TABLE staff_meetings IS 'Scheduled and active staff meetings';
COMMENT ON TABLE staff_meeting_participants IS 'Tracks which staff members have joined meetings';
COMMENT ON FUNCTION can_access_staff_meeting IS 'Determines if user can access staff meeting system';
COMMENT ON FUNCTION can_start_staff_meeting IS 'Determines if user can START a staff meeting (Admin, Lead Officers)';
COMMENT ON FUNCTION can_schedule_staff_meeting IS 'Determines if user can SCHEDULE a staff meeting (Admin, Lead Officers, Secretary)';
COMMENT ON FUNCTION get_staff_meeting_permission IS 'Returns user permission level: none, join_only, schedule, start';
