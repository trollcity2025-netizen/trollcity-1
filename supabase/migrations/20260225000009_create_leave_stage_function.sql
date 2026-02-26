
CREATE OR REPLACE FUNCTION leave_stage_and_fill_next(p_session_id uuid, p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_slot TEXT;
BEGIN
  -- Find the slot of the leaving performer
  SELECT slot INTO v_slot FROM mai_stage_slots
  WHERE session_id = p_session_id AND user_id = p_user_id;

  IF v_slot IS NULL THEN
    -- Performer not on stage, do nothing
    RETURN;
  END IF;

  -- Remove user from the stage slot
  DELETE FROM mai_stage_slots
  WHERE session_id = p_session_id AND user_id = p_user_id;

  -- Update their status in the queue
  UPDATE mai_queue
  SET status = 'completed'
  WHERE session_id = p_session_id AND user_id = p_user_id;

  -- Increment the auditions completed count
  UPDATE mai_show_sessions
  SET auditions_completed = auditions_completed + 1
  WHERE id = p_session_id;

  -- Now, fill the empty slot
  DECLARE
    next_performer_id uuid;
  BEGIN
    -- Find the next user in the queue
    SELECT user_id INTO next_performer_id
    FROM mai_queue
    WHERE session_id = p_session_id AND status = 'waiting'
    ORDER BY position
    LIMIT 1;

    IF next_performer_id IS NOT NULL THEN
      -- Use the existing function to fill the slot
      PERFORM fill_stage_slot(p_session_id, next_performer_id, v_slot);
    END IF;
  END;

END;
$$ LANGUAGE plpgsql;
