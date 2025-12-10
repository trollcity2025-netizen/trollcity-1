-- Create onboarding_progress table
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  completed_steps JSONB DEFAULT '[]'::jsonb,
  personal_info JSONB,
  tax_info JSONB,
  payout_method JSONB,
  rules_acknowledged BOOLEAN DEFAULT false,
  digital_signature TEXT,
  simulation_score INTEGER,
  hr_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create onboarding_events table
CREATE TABLE IF NOT EXISTS onboarding_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  step_number INTEGER,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for onboarding_progress
CREATE POLICY "Users can view their own onboarding progress" ON onboarding_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding progress" ON onboarding_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all onboarding progress" ON onboarding_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "Admins can update all onboarding progress" ON onboarding_progress
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

-- RLS Policies for onboarding_events
CREATE POLICY "Users can view their own onboarding events" ON onboarding_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding events" ON onboarding_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all onboarding events" ON onboarding_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_current_step ON onboarding_progress(current_step);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_user_id ON onboarding_events(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_event_type ON onboarding_events(event_type);