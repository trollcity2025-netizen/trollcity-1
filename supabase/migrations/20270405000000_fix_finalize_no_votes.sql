-- Fix finalize_president_election to not void election when no votes
-- Instead, appoint the candidate with the most votes (even if 0)

CREATE OR REPLACE FUNCTION public.finalize_president_election(p_election_id uuid)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_winner_id UUID;
  v_role_id UUID;
  v_candidate_count INT;
BEGIN
  -- Check permission (Admin/Secretary)
  if not exists (select 1 from user_profiles where id = auth.uid() and (is_admin = true or role = 'secretary')) then
     raise exception 'Not authorized';
  end if;

  -- Get role ID
  SELECT id INTO v_role_id FROM system_roles WHERE name = 'president';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'President role not found';
  END IF;

  -- Count approved candidates
  SELECT COUNT(*) INTO v_candidate_count
  FROM president_candidates 
  WHERE election_id = p_election_id AND status = 'approved';

  -- If no candidates, create a placeholder president (don't void)
  IF v_candidate_count = 0 THEN
    -- Find any candidate (pending or rejected) to appoint
    SELECT user_id INTO v_winner_id
    FROM president_candidates
    WHERE election_id = p_election_id
    ORDER BY created_at ASC
    LIMIT 1;

    -- If still no candidates, election can't proceed
    IF v_winner_id IS NULL THEN
      UPDATE president_elections SET status = 'void' WHERE id = p_election_id;
      RETURN;
    END IF;
  ELSE
    -- Get winner with MOST votes (even if 0 - don't void!)
    SELECT user_id INTO v_winner_id
    FROM president_candidates
    WHERE election_id = p_election_id AND status = 'approved'
    ORDER BY vote_count DESC, created_at ASC
    LIMIT 1;
  END IF;

  -- Expire old president(s)
  UPDATE user_role_grants
  SET expires_at = NOW()
  WHERE role_id = v_role_id 
    AND (expires_at IS NULL OR expires_at > NOW());

  -- Remove existing president badge from all users
  UPDATE user_profiles SET badge = NULL WHERE badge = 'president';

  -- Grant new president role (14 day term)
  INSERT INTO user_role_grants (user_id, role_id, expires_at)
  VALUES (v_winner_id, v_role_id, NOW() + INTERVAL '14 days');

  -- Award Badge and Gold Style
  UPDATE user_profiles
  SET badge = 'president', username_style = 'gold'
  WHERE id = v_winner_id;

  -- Update election status to finalized
  UPDATE president_elections 
  SET status = 'finalized', 
      winner_candidate_id = (SELECT id FROM president_candidates WHERE election_id = p_election_id AND user_id = v_winner_id LIMIT 1),
      updated_at = NOW()
  WHERE id = p_election_id;

  -- Log
  INSERT INTO president_audit_logs (action_type, description, actor_id)
  VALUES ('election_finalized', 'Election finalized. Winner: ' || v_winner_id, auth.uid());
END;
$$;