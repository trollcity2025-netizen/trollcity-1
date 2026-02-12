-- Ensure set_stream_box_count RPC exists for box updates

CREATE OR REPLACE FUNCTION public.set_stream_box_count(
    p_stream_id UUID,
    p_new_box_count INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.streams
    SET box_count = p_new_box_count
    WHERE id = p_stream_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_stream_box_count(UUID, INTEGER) TO authenticated;
