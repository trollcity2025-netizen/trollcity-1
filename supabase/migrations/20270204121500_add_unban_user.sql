-- Function to unban a user
CREATE OR REPLACE FUNCTION unban_user(p_stream_id TEXT, p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
    DELETE FROM stream_bans WHERE stream_id = p_stream_id AND user_id = p_user_id;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
