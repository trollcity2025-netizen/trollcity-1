BEGIN;

CREATE TABLE IF NOT EXISTS troll_wars_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('easy', 'medium', 'hard')),
  category text NOT NULL,
  progress_type text NOT NULL CHECK (progress_type IN ('count', 'boolean', 'time', 'score', 'ai_evaluated')),
  target_value numeric(18,4) NOT NULL DEFAULT 0,
  is_repeatable boolean NOT NULL DEFAULT false,
  reset_cycle text NOT NULL DEFAULT 'weekly',
  reward_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  failure_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS troll_wars_weekly_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start timestamptz NOT NULL,
  week_end timestamptz NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_troll_wars_weekly_cycles_range
  ON troll_wars_weekly_cycles (week_start, week_end);

CREATE TABLE IF NOT EXISTS troll_wars_task_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES troll_wars_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  weekly_cycle_id uuid NOT NULL REFERENCES troll_wars_weekly_cycles(id) ON DELETE CASCADE,
  progress_value numeric(18,4) NOT NULL DEFAULT 0,
  completion_percentage numeric(5,2) NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  is_failed boolean NOT NULL DEFAULT false,
  last_event_type text,
  last_event_metadata jsonb DEFAULT '{}'::jsonb,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_troll_wars_task_progress_unique
  ON troll_wars_task_progress (task_id, user_id, weekly_cycle_id);

CREATE INDEX IF NOT EXISTS idx_troll_wars_task_progress_user
  ON troll_wars_task_progress (user_id, weekly_cycle_id);

CREATE TABLE IF NOT EXISTS troll_wars_ai_battle_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  task_id uuid REFERENCES troll_wars_tasks(id) ON DELETE SET NULL,
  battle_type text NOT NULL,
  input_payload jsonb NOT NULL,
  ai_model text NOT NULL,
  ai_temperature numeric(4,2),
  random_seed bigint,
  outcome jsonb NOT NULL,
  score numeric(18,4),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_troll_wars_ai_battle_logs_user
  ON troll_wars_ai_battle_logs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS troll_wars_economy_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  task_id uuid REFERENCES troll_wars_tasks(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  delta_coins bigint,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_troll_wars_economy_logs_user
  ON troll_wars_economy_logs (user_id, created_at DESC);

ALTER TABLE troll_wars_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_wars_weekly_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_wars_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_wars_ai_battle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_wars_economy_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage troll wars tasks"
  ON troll_wars_tasks FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view active troll wars tasks"
  ON troll_wars_tasks FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can manage own troll wars progress"
  ON troll_wars_task_progress FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all troll wars progress"
  ON troll_wars_task_progress FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage weekly cycles"
  ON troll_wars_weekly_cycles FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own AI battle logs"
  ON troll_wars_ai_battle_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all AI battle logs"
  ON troll_wars_ai_battle_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own troll wars economy logs"
  ON troll_wars_economy_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all troll wars economy logs"
  ON troll_wars_economy_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION troll_wars_current_week()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  week_start_ts timestamptz;
  week_end_ts timestamptz;
  cycle_id uuid;
BEGIN
  week_start_ts := date_trunc('week', now());
  week_end_ts := week_start_ts + interval '7 days';

  SELECT id INTO cycle_id
  FROM troll_wars_weekly_cycles
  WHERE week_start = week_start_ts AND week_end = week_end_ts
  LIMIT 1;

  IF cycle_id IS NULL THEN
    INSERT INTO troll_wars_weekly_cycles (week_start, week_end, label, is_active)
    VALUES (week_start_ts, week_end_ts, to_char(week_start_ts, '"Week of" YYYY-MM-DD'), true)
    RETURNING id INTO cycle_id;
  END IF;

  RETURN cycle_id;
END;
$$;

COMMIT;

