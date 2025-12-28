-- RPC function to end court session
CREATE OR REPLACE FUNCTION end_court_session(p_session_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE court_sessions
  SET status = 'ended', ended_at = NOW()
  WHERE id = p_session_id::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to update court judge
CREATE OR REPLACE FUNCTION update_court_judge(p_session_id TEXT, p_judge_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE court_sessions
  SET judge_id = p_judge_id
  WHERE id = p_session_id::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
