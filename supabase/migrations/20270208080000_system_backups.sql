
-- Create system_backup_requests table for tracking backup operations
CREATE TABLE IF NOT EXISTS system_backup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID REFERENCES user_profiles(id),
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  details JSONB
);

ALTER TABLE system_backup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage backup requests" ON system_backup_requests;
CREATE POLICY "Admins can manage backup requests" ON system_backup_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

-- Function to simulate backup processing (optional, for demo purposes if no real worker exists yet)
-- In a real system, an external worker/Edge Function would pick this up.
CREATE OR REPLACE FUNCTION trigger_manual_backup(p_admin_id UUID)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Check admin
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = p_admin_id AND (role = 'admin' OR is_admin = true)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO system_backup_requests (requested_by, status, details)
  VALUES (p_admin_id, 'pending', '{"type": "manual_full_dump"}')
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
