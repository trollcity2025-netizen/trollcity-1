
CREATE OR REPLACE FUNCTION remove_user_from_court(p_user_id uuid, p_session_id text)
RETURNS void AS $$
BEGIN
  DELETE FROM public.court_boxes
  WHERE user_id = p_user_id AND session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
