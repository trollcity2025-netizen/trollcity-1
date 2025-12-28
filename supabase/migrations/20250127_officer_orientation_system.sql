-- Troll Officer Orientation & Quiz System
-- Required after application approval and before official officer status

-- Table: officer_orientations
CREATE TABLE IF NOT EXISTS officer_orientations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('assigned','in_progress','passed','failed')) DEFAULT 'assigned',
  assigned_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id) -- One orientation per user
);

-- Add missing columns if they don't exist
ALTER TABLE officer_orientations
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE officer_orientations
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'assigned';

ALTER TABLE officer_orientations
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE officer_orientations
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE officer_orientations
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE officer_orientations
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

ALTER TABLE officer_orientations
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;

ALTER TABLE officer_orientations
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE officer_orientations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_officer_orientations_user ON officer_orientations(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_orientations_status ON officer_orientations(status);

-- Enable RLS
ALTER TABLE officer_orientations ENABLE ROW LEVEL SECURITY;

-- Users can view their own orientation
CREATE POLICY "Users can view own orientation"
  ON officer_orientations FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own orientation
CREATE POLICY "Users can update own orientation"
  ON officer_orientations FOR UPDATE
  USING (user_id = auth.uid());

-- Admins can view all orientations
CREATE POLICY "Admins can view all orientations"
  ON officer_orientations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

GRANT ALL ON officer_orientations TO authenticated;

-- Table: officer_quiz_questions
CREATE TABLE IF NOT EXISTS officer_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('a','b','c','d')),
  explanation TEXT,
  category TEXT DEFAULT 'general',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns if they don't exist
ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS question_text TEXT;

ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS option_a TEXT;

ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS option_b TEXT;

ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS option_c TEXT;

ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS option_d TEXT;

ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS correct_answer TEXT;

ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS explanation TEXT;

ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE officer_quiz_questions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_officer_quiz_questions_active ON officer_quiz_questions(is_active, order_index);

-- Enable RLS
ALTER TABLE officer_quiz_questions ENABLE ROW LEVEL SECURITY;

-- Everyone can view active quiz questions
CREATE POLICY "Public can view active quiz questions"
  ON officer_quiz_questions FOR SELECT
  USING (is_active = true);

-- Admins can manage quiz questions
CREATE POLICY "Admins can manage quiz questions"
  ON officer_quiz_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

GRANT ALL ON officer_quiz_questions TO authenticated;

-- Table: officer_quiz_attempts
CREATE TABLE IF NOT EXISTS officer_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  orientation_id UUID NOT NULL REFERENCES officer_orientations(id) ON DELETE CASCADE,
  answers JSONB NOT NULL, -- {question_id: 'a'|'b'|'c'|'d', ...}
  score INTEGER NOT NULL, -- Percentage (0-100)
  passed BOOLEAN NOT NULL DEFAULT false,
  questions_answered INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  time_taken_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns if they don't exist
ALTER TABLE officer_quiz_attempts
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE officer_quiz_attempts
ADD COLUMN IF NOT EXISTS orientation_id UUID REFERENCES officer_orientations(id) ON DELETE CASCADE;

ALTER TABLE officer_quiz_attempts
ADD COLUMN IF NOT EXISTS answers JSONB;

ALTER TABLE officer_quiz_attempts
ADD COLUMN IF NOT EXISTS score INTEGER;

ALTER TABLE officer_quiz_attempts
ADD COLUMN IF NOT EXISTS passed BOOLEAN DEFAULT false;

ALTER TABLE officer_quiz_attempts
ADD COLUMN IF NOT EXISTS questions_answered INTEGER;

ALTER TABLE officer_quiz_attempts
ADD COLUMN IF NOT EXISTS correct_answers INTEGER;

ALTER TABLE officer_quiz_attempts
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE officer_quiz_attempts
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE officer_quiz_attempts
ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER;

ALTER TABLE officer_quiz_attempts
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_officer_quiz_attempts_user ON officer_quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_quiz_attempts_orientation ON officer_quiz_attempts(orientation_id);

-- Enable RLS
ALTER TABLE officer_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own attempts
CREATE POLICY "Users can view own quiz attempts"
  ON officer_quiz_attempts FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own attempts
CREATE POLICY "Users can insert own quiz attempts"
  ON officer_quiz_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view all attempts
CREATE POLICY "Admins can view all quiz attempts"
  ON officer_quiz_attempts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

GRANT ALL ON officer_quiz_attempts TO authenticated;

-- Function: Assign orientation to user
CREATE OR REPLACE FUNCTION assign_officer_orientation(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orientation_id UUID;
BEGIN
  -- Check if orientation already exists
  SELECT id INTO v_orientation_id
  FROM officer_orientations
  WHERE user_id = p_user_id;

  IF v_orientation_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Orientation already assigned',
      'orientation_id', v_orientation_id
    );
  END IF;

  -- Create new orientation
  INSERT INTO officer_orientations (user_id, status, assigned_at)
  VALUES (p_user_id, 'assigned', NOW())
  RETURNING id INTO v_orientation_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Orientation assigned successfully',
    'orientation_id', v_orientation_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION assign_officer_orientation(UUID) TO authenticated;

-- Function: Start orientation
CREATE OR REPLACE FUNCTION start_officer_orientation(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orientation RECORD;
BEGIN
  -- Get orientation
  SELECT * INTO v_orientation
  FROM officer_orientations
  WHERE user_id = p_user_id;

  IF v_orientation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orientation not found');
  END IF;

  IF v_orientation.status = 'passed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orientation already passed');
  END IF;

  IF v_orientation.attempts >= v_orientation.max_attempts THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum attempts reached');
  END IF;

  -- Update status to in_progress
  UPDATE officer_orientations
  SET 
    status = 'in_progress',
    started_at = COALESCE(started_at, NOW()),
    updated_at = NOW()
  WHERE id = v_orientation.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Orientation started',
    'orientation_id', v_orientation.id,
    'attempts', v_orientation.attempts,
    'max_attempts', v_orientation.max_attempts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION start_officer_orientation(UUID) TO authenticated;

-- Function: Submit quiz answers
DROP FUNCTION IF EXISTS submit_officer_quiz(UUID, JSONB, INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION submit_officer_quiz(
  p_user_id UUID,
  p_answers JSONB,
  p_time_taken_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orientation RECORD;
  v_question RECORD;
  v_answer TEXT;
  v_correct_count INTEGER := 0;
  v_total_questions INTEGER;
  v_score INTEGER;
  v_passed BOOLEAN;
  v_attempt_id UUID;
BEGIN
  -- Get orientation
  SELECT * INTO v_orientation
  FROM officer_orientations
  WHERE user_id = p_user_id AND status = 'in_progress';

  IF v_orientation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active orientation found');
  END IF;

  -- Check attempts
  IF v_orientation.attempts >= v_orientation.max_attempts THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum attempts reached');
  END IF;

  -- Count total active questions
  SELECT COUNT(*) INTO v_total_questions
  FROM officer_quiz_questions
  WHERE is_active = true;

  IF v_total_questions = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No quiz questions available');
  END IF;

  -- Grade answers by looping through questions
  FOR v_question IN 
    SELECT id, correct_answer
    FROM officer_quiz_questions
    WHERE is_active = true
    ORDER BY order_index, id
  LOOP
    v_answer := p_answers->>v_question.id::text;
    IF v_answer = v_question.correct_answer THEN
      v_correct_count := v_correct_count + 1;
    END IF;
  END LOOP;

  -- Calculate score
  v_score := ROUND((v_correct_count::NUMERIC / v_total_questions::NUMERIC) * 100);
  v_passed := v_score >= 80;

  -- Create attempt record
  INSERT INTO officer_quiz_attempts (
    user_id,
    orientation_id,
    answers,
    score,
    passed,
    questions_answered,
    correct_answers,
    completed_at,
    time_taken_seconds
  ) VALUES (
    p_user_id,
    v_orientation.id,
    p_answers,
    v_score,
    v_passed,
    v_total_questions,
    v_correct_count,
    NOW(),
    p_time_taken_seconds
  ) RETURNING id INTO v_attempt_id;

  -- Update orientation
  UPDATE officer_orientations
  SET 
    attempts = attempts + 1,
    status = CASE 
      WHEN v_passed THEN 'passed'
      WHEN attempts + 1 >= max_attempts THEN 'failed'
      ELSE 'assigned'
    END,
    completed_at = CASE WHEN v_passed THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = v_orientation.id;

  -- Call complete_orientation function
  PERFORM complete_orientation(p_user_id, v_passed);

  RETURN jsonb_build_object(
    'success', true,
    'passed', v_passed,
    'score', v_score,
    'correct_answers', v_correct_count,
    'total_questions', v_total_questions,
    'attempt_id', v_attempt_id,
    'attempts_remaining', GREATEST(0, v_orientation.max_attempts - v_orientation.attempts - 1),
    'message', CASE 
      WHEN v_passed THEN 'Congratulations! You passed the quiz and are now an active Troll Officer!'
      WHEN v_orientation.attempts + 1 >= v_orientation.max_attempts THEN 'You have reached the maximum number of attempts. Please contact an admin.'
      ELSE format('You scored %s%%. You need 80%% to pass. You have %s attempts remaining.', v_score, GREATEST(0, v_orientation.max_attempts - v_orientation.attempts - 1))
    END
  );
END;
$$;

-- Function: Complete orientation
CREATE OR REPLACE FUNCTION complete_orientation(p_user_id UUID, p_passed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_passed THEN
    UPDATE officer_orientations
    SET status='passed', completed_at=now(), updated_at=now()
    WHERE user_id = p_user_id;

    UPDATE user_profiles
    SET is_officer_active = TRUE, updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE officer_orientations
    SET status='failed', updated_at=now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_orientation(UUID, BOOLEAN) TO authenticated;

GRANT EXECUTE ON FUNCTION submit_officer_quiz(UUID, JSONB, INTEGER) TO authenticated;

-- Function: Get orientation status
CREATE OR REPLACE FUNCTION get_officer_orientation_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orientation RECORD;
  v_attempts_json JSONB;
BEGIN
  -- Get orientation
  SELECT * INTO v_orientation
  FROM officer_orientations
  WHERE user_id = p_user_id;

  IF v_orientation IS NULL THEN
    RETURN jsonb_build_object(
      'has_orientation', false,
      'status', null
    );
  END IF;

  -- Get recent attempts as JSON
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'score', a.score,
    'passed', a.passed,
    'completed_at', a.completed_at
  ) ORDER BY a.completed_at DESC), '[]'::jsonb) INTO v_attempts_json
  FROM officer_quiz_attempts a
  WHERE a.user_id = p_user_id
  LIMIT 5;

  RETURN jsonb_build_object(
    'has_orientation', true,
    'orientation_id', v_orientation.id,
    'status', v_orientation.status,
    'attempts', v_orientation.attempts,
    'max_attempts', v_orientation.max_attempts,
    'assigned_at', v_orientation.assigned_at,
    'started_at', v_orientation.started_at,
    'completed_at', v_orientation.completed_at,
    'recent_attempts', v_attempts_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_officer_orientation_status(UUID) TO authenticated;

-- Function: Get quiz questions
DROP FUNCTION IF EXISTS get_officer_quiz_questions() CASCADE;
CREATE OR REPLACE FUNCTION get_officer_quiz_questions()
RETURNS TABLE (
  id UUID,
  question_text TEXT,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  category TEXT,
  order_index INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.question_text,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.category,
    q.order_index
  FROM officer_quiz_questions q
  WHERE q.is_active = true
  ORDER BY q.order_index, q.id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_officer_quiz_questions() TO authenticated;

-- Seed default quiz questions
INSERT INTO officer_quiz_questions (question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, category, order_index) VALUES
('What is the primary duty of a Troll Officer?', 'To troll users and cause chaos', 'To maintain order, enforce rules, and protect the community', 'To promote their own content', 'To ignore all user reports', 'b', 'Troll Officers are responsible for maintaining order and protecting the community, not causing chaos.', 'duties', 1),
('When should you ban a user?', 'Immediately after any minor offense', 'Only after multiple warnings and serious violations', 'Never, bans are not allowed', 'Only if they disagree with you', 'b', 'Bans should only be used after warnings and for serious violations of community guidelines.', 'moderation', 2),
('What should you do if you receive a report?', 'Ignore it', 'Review it promptly and take appropriate action', 'Ban the reported user immediately', 'Share it publicly', 'b', 'All reports should be reviewed promptly and handled appropriately.', 'moderation', 3),
('Can Troll Officers accept gifts or payments from users?', 'Yes, always', 'No, this is a conflict of interest', 'Only from friends', 'Only if it''s a large amount', 'b', 'Troll Officers should not accept gifts or payments as it creates a conflict of interest.', 'ethics', 4),
('What is the minimum score required to pass the officer quiz?', '50%', '60%', '70%', '80%', 'd', 'You must score at least 80% to pass the quiz and become an active officer.', 'general', 5),
('How many attempts do you have to pass the quiz?', '1', '2', '3', 'Unlimited', 'c', 'You have a maximum of 3 attempts to pass the quiz.', 'general', 6),
('Should you share your officer account credentials with others?', 'Yes, if they are also officers', 'No, never share your credentials', 'Only with admins', 'Only with close friends', 'b', 'Never share your account credentials with anyone, as this compromises security.', 'security', 7),
('What should you do if you witness another officer abusing their power?', 'Ignore it', 'Report it to an admin immediately', 'Confront them publicly', 'Join in', 'b', 'Officer misconduct should be reported to admins immediately.', 'ethics', 8),
('Can you use your officer status to promote your own content?', 'Yes, always', 'No, this is an abuse of power', 'Only sometimes', 'Only if it''s really good content', 'b', 'Using officer status to promote personal content is an abuse of power.', 'ethics', 9),
('What is the purpose of the Troll Officer role?', 'To have special privileges', 'To serve and protect the community', 'To earn more coins', 'To gain popularity', 'b', 'The primary purpose is to serve and protect the Troll City community.', 'duties', 10)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE officer_orientations IS 'Tracks officer orientation assignments and completion status';
COMMENT ON TABLE officer_quiz_questions IS 'Stores quiz questions for officer orientation';
COMMENT ON TABLE officer_quiz_attempts IS 'Records quiz attempts and scores';
COMMENT ON FUNCTION assign_officer_orientation(UUID) IS 'Assigns orientation to a user after application approval';
COMMENT ON FUNCTION start_officer_orientation(UUID) IS 'Starts an orientation session';
COMMENT ON FUNCTION submit_officer_quiz(UUID, JSONB, INTEGER) IS 'Submits quiz answers and grades them';
COMMENT ON FUNCTION get_officer_orientation_status(UUID) IS 'Gets the current orientation status for a user';
COMMENT ON FUNCTION get_officer_quiz_questions() IS 'Gets all active quiz questions';

