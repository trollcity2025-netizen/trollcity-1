-- Clear top streams functionality
-- This can be called to reset top streams

CREATE OR REPLACE FUNCTION clear_top_streams()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear any top streams tracking (if you have a top_streams table)
  -- Or reset stream rankings
  UPDATE streams
  SET is_featured = FALSE,
      featured_until = NULL
  WHERE is_featured = TRUE;

  RETURN jsonb_build_object('success', TRUE, 'message', 'Top streams cleared');
END;
$$;

GRANT EXECUTE ON FUNCTION clear_top_streams() TO authenticated;

