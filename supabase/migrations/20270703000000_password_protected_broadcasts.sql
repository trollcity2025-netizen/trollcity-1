-- Add password protection columns to streams table
ALTER TABLE public.streams 
ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Create RPC function to hash password (for use when creating protected broadcast)
CREATE OR REPLACE FUNCTION public.crypt_password(
  p_password TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN crypt(p_password, gen_salt('bf'));
END;
$$;

-- Create RPC function to validate broadcast password
CREATE OR REPLACE FUNCTION public.validate_broadcast_password(
  p_stream_id UUID,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
  v_is_valid BOOLEAN := false;
BEGIN
  -- Get stream info
  SELECT id, password_hash, is_protected INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id;

  -- If stream doesn't exist, return error
  IF v_stream IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Broadcast not found'
    );
  END IF;

  -- If stream is not protected, allow access
  IF v_stream.is_protected = false OR v_stream.password_hash IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'No password required'
    );
  END IF;

  -- Validate password using crypt
  IF p_password IS NOT NULL AND v_stream.password_hash IS NOT NULL THEN
    IF v_stream.password_hash = crypt(p_password, v_stream.password_hash) THEN
      v_is_valid := true;
    END IF;
  END IF;

  IF v_is_valid THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Password validated'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Incorrect password'
    );
  END IF;
END;
$$;

-- Grant execute permission to everyone
GRANT EXECUTE ON FUNCTION public.validate_broadcast_password TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crypt_password TO anon, authenticated;

-- Add comments
COMMENT ON COLUMN public.streams.password_hash IS 'Hashed password - NEVER exposed to clients';
COMMENT ON COLUMN public.streams.is_protected IS 'Whether broadcast requires password to join';
