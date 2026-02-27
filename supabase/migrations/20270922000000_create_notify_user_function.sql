CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata, created_at, is_read)
  VALUES (p_user_id, p_type, p_title, p_message, COALESCE(p_metadata, '{}'::jsonb), NOW(), FALSE);
END;
$$;
