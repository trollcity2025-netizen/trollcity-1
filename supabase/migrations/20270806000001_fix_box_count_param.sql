-- Fix parameter name mismatch for set_stream_box_count
-- Client code expects p_new_box_count, but previous migration changed it to p_count.

DROP FUNCTION IF EXISTS public.set_stream_box_count(UUID, INTEGER);

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
