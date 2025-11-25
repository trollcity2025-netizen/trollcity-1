BEGIN;

CREATE OR REPLACE FUNCTION officer_send_message(p_message text)
RETURNS officer_chat_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('troll_officer','admin')
  )
  INSERT INTO officer_chat_messages(user_id, message)
  SELECT auth.uid(), p_message
  FROM allowed
  RETURNING officer_chat_messages.*;
$$;

COMMENT ON FUNCTION officer_send_message(text) IS 'Insert officer chat message; only allowed for roles troll_officer/admin';

COMMIT;

