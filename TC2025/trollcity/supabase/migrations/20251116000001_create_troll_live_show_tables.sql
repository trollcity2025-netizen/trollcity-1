-- Troll Live Show main table
CREATE TABLE troll_live_show (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  current_performer_id UUID REFERENCES auth.users(id),
  current_performer_start_time TIMESTAMPTZ,
  show_duration_minutes INTEGER DEFAULT 5,
  entry_fee_coins INTEGER DEFAULT 500,
  total_participants INTEGER DEFAULT 0,
  total_votes_cast INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id)
);

-- Troll Live Show waitlist
CREATE TABLE troll_live_show_waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  show_id UUID REFERENCES troll_live_show(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  position INTEGER NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'performing', 'completed', 'kicked', 'left')),
  entry_paid BOOLEAN DEFAULT false,
  performance_start_time TIMESTAMPTZ,
  performance_end_time TIMESTAMPTZ,
  votes_received INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  performance_duration_seconds INTEGER DEFAULT 0,
  gifts_received INTEGER DEFAULT 0,
  UNIQUE(show_id, user_id),
  UNIQUE(show_id, position)
);

-- Troll Live Show votes
CREATE TABLE troll_live_show_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  show_id UUID REFERENCES troll_live_show(id) ON DELETE CASCADE,
  waitlist_entry_id UUID REFERENCES troll_live_show_waitlist(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES auth.users(id) NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('keep', 'kick')),
  UNIQUE(show_id, waitlist_entry_id, voter_id)
);

-- User wins tracking
CREATE TABLE user_wins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  win_type TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  show_id UUID REFERENCES troll_live_show(id),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, show_id, win_type)
);

-- Add wins counter to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS wins_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_winnings INTEGER DEFAULT 0;

-- Indexes for performance
CREATE INDEX idx_troll_live_show_active ON troll_live_show(is_active);
CREATE INDEX idx_troll_live_show_waitlist_show_position ON troll_live_show_waitlist(show_id, position);
CREATE INDEX idx_troll_live_show_waitlist_show_status ON troll_live_show_waitlist(show_id, status);
CREATE INDEX idx_troll_live_show_votes_show_entry ON troll_live_show_votes(show_id, waitlist_entry_id);
CREATE INDEX idx_user_wins_user_id ON user_wins(user_id);

-- RLS Policies
ALTER TABLE troll_live_show ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_live_show_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_live_show_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wins ENABLE ROW LEVEL SECURITY;

-- Troll Live Show policies
CREATE POLICY "Anyone can view active shows" ON troll_live_show
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage shows" ON troll_live_show
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.is_admin = true OR profiles.role = 'admin')
    )
  );

-- Waitlist policies
CREATE POLICY "Anyone can view waitlist" ON troll_live_show_waitlist
  FOR SELECT USING (true);

CREATE POLICY "Users can join waitlist" ON troll_live_show_waitlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own waitlist entry" ON troll_live_show_waitlist
  FOR UPDATE USING (auth.uid() = user_id);

-- Votes policies
CREATE POLICY "Anyone can view votes" ON troll_live_show_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can cast votes" ON troll_live_show_votes
  FOR INSERT WITH CHECK (auth.uid() = voter_id);

CREATE POLICY "Users can update own votes" ON troll_live_show_votes
  FOR UPDATE USING (auth.uid() = voter_id);

-- User wins policies
CREATE POLICY "Anyone can view wins" ON user_wins
  FOR SELECT USING (true);

CREATE POLICY "Users can view own wins" ON user_wins
  FOR SELECT USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT ON troll_live_show TO anon, authenticated;
GRANT SELECT ON troll_live_show_waitlist TO anon, authenticated;
GRANT SELECT ON troll_live_show_votes TO anon, authenticated;
GRANT SELECT ON user_wins TO anon, authenticated;

GRANT INSERT ON troll_live_show_waitlist TO authenticated;
GRANT UPDATE ON troll_live_show_waitlist TO authenticated;
GRANT INSERT ON troll_live_show_votes TO authenticated;
GRANT UPDATE ON troll_live_show_votes TO authenticated;