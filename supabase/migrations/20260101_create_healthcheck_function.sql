-- Create a simple health check RPC function that returns { ok: true }
-- This function is publicly accessible and doesn't require any RLS permissions

CREATE OR REPLACE FUNCTION healthcheck()
RETURNS json
LANGUAGE sql
SECURITY DEFINER -- Run with elevated privileges
AS $$
  SELECT json_build_object('ok', true, 'timestamp', now(), 'status', 'healthy');
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION healthcheck() TO anon;
GRANT EXECUTE ON FUNCTION healthcheck() TO authenticated;