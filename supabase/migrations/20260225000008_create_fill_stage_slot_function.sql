
CREATE OR REPLACE FUNCTION fill_stage_slot(p_session_id uuid, p_user_id uuid, p_slot text)
RETURNS void AS $$
BEGIN
  -- Add the performer to the stage slot
  INSERT INTO mai_stage_slots (session_id, user_id, slot, role)
  VALUES (p_session_id, p_user_id, p_slot, 'performer');

  -- Update the performer's status in the queue
  UPDATE mai_queue
  SET status = 'on_stage'
  WHERE session_id = p_session_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
