CREATE TABLE mai_judge_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES mai_show_sessions(id) ON DELETE CASCADE,
  seat_number INT NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, seat_number)
);