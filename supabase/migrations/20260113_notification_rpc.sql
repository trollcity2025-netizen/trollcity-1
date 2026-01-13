/* Allows safe insertion into notifications while enforcing basic validation */
CREATE OR REPLACE FUNCTION notify_user_rpc(
  p_target_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_is_read BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  metadata JSONB,
  is_read BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted RECORD;
BEGIN
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user is required';
  END IF;

  IF trim(p_type) = '' THEN
    RAISE EXCEPTION 'Notification type is required';
  END IF;

  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata,
    is_read,
    created_at,
    updated_at
  )
  VALUES (
    p_target_user_id,
    p_type,
    p_title,
    p_message,
    p_metadata,
    p_is_read,
    now(),
    now()
  )
  RETURNING * INTO inserted;

  RETURN QUERY SELECT
    inserted.id,
    inserted.user_id,
    inserted.type,
    inserted.title,
    inserted.message,
    inserted.metadata,
    inserted.is_read,
    inserted.created_at,
    inserted.updated_at;
END;
$$;
