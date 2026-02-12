-- Fix user_perks foreign key constraint
ALTER TABLE public.user_perks DROP CONSTRAINT IF EXISTS user_perks_perk_id_fkey;

-- Create missing function set_stream_box_count
CREATE OR REPLACE FUNCTION public.set_stream_box_count(
  p_stream_id UUID,
  p_new_box_count INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.streams
  SET box_count = p_new_box_count
  WHERE id = p_stream_id;
END;
$$;
