BEGIN;

CREATE TABLE IF NOT EXISTS officer_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE officer_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow officers and admin to select"
ON officer_chat_messages
FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM user_profiles WHERE role IN ('troll_officer','admin')
  )
);

CREATE POLICY "Allow officers/admin to insert"
ON officer_chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM user_profiles WHERE role IN ('troll_officer','admin')
  )
);

COMMIT;

