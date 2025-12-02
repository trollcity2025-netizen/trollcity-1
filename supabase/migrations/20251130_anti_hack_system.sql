-- Anti-Hack Security System
-- Auto-detects and auto-bans: auto-clickers, VPN, malware, URL/IP manipulation

-- Security settings table
CREATE TABLE IF NOT EXISTS security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Insert default security settings
INSERT INTO security_settings (setting_key, setting_value)
VALUES 
  ('anti_hack_enabled', 'true'::jsonb),
  ('admin_toggle_code', '1903'::jsonb),
  ('auto_ban_enabled', 'true'::jsonb),
  ('vpn_detection_enabled', 'true'::jsonb),
  ('auto_clicker_detection_enabled', 'true'::jsonb),
  ('url_manipulation_detection_enabled', 'true'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- Security events log
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL, -- 'auto_clicker', 'vpn_detected', 'url_manipulation', 'ip_spoofing', 'malware_detected'
  severity text NOT NULL, -- 'low', 'medium', 'high', 'critical'
  ip_address inet,
  user_agent text,
  url text,
  details jsonb,
  auto_banned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);

-- Enable RLS
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view/update security settings
CREATE POLICY "Only admins can manage security settings"
  ON security_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Only admins can view security events
CREATE POLICY "Only admins can view security events"
  ON security_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Anyone can insert security events (for detection)
CREATE POLICY "Anyone can log security events"
  ON security_events FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Function to check if anti-hack is enabled
CREATE OR REPLACE FUNCTION is_anti_hack_enabled()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT (setting_value->>'value')::boolean INTO v_enabled
  FROM security_settings
  WHERE setting_key = 'anti_hack_enabled';
  
  RETURN COALESCE(v_enabled, true); -- Default to enabled
END;
$$;

-- Function to log security event and auto-ban if needed
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id uuid,
  p_event_type text,
  p_severity text,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_url text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auto_ban_enabled boolean;
  v_event_count integer;
  v_should_ban boolean := false;
  v_ban_result jsonb;
BEGIN
  -- Check if anti-hack is enabled
  IF NOT is_anti_hack_enabled() THEN
    RETURN jsonb_build_object('logged', true, 'auto_ban_skipped', true);
  END IF;

  -- Log the event
  INSERT INTO security_events (
    user_id,
    event_type,
    severity,
    ip_address,
    user_agent,
    url,
    details
  ) VALUES (
    p_user_id,
    p_event_type,
    p_severity,
    p_ip_address,
    p_user_agent,
    p_url,
    p_details
  );

  -- Check if auto-ban is enabled
  SELECT (setting_value->>'value')::boolean INTO v_auto_ban_enabled
  FROM security_settings
  WHERE setting_key = 'auto_ban_enabled';
  
  IF NOT COALESCE(v_auto_ban_enabled, true) THEN
    RETURN jsonb_build_object('logged', true, 'auto_ban_disabled', true);
  END IF;

  -- Auto-ban logic based on severity and event count
  IF p_severity IN ('high', 'critical') THEN
    v_should_ban := true;
  ELSIF p_severity = 'medium' THEN
    -- Ban if user has 3+ medium severity events in last hour
    SELECT COUNT(*) INTO v_event_count
    FROM security_events
    WHERE user_id = p_user_id
      AND severity = 'medium'
      AND created_at > now() - interval '1 hour';
    
    IF v_event_count >= 3 THEN
      v_should_ban := true;
    END IF;
  ELSIF p_severity = 'low' THEN
    -- Ban if user has 10+ low severity events in last hour
    SELECT COUNT(*) INTO v_event_count
    FROM security_events
    WHERE user_id = p_user_id
      AND severity = 'low'
      AND created_at > now() - interval '1 hour';
    
    IF v_event_count >= 10 THEN
      v_should_ban := true;
    END IF;
  END IF;

  -- Auto-ban if needed
  IF v_should_ban AND p_user_id IS NOT NULL AND p_ip_address IS NOT NULL THEN
    -- Ban IP address
    v_ban_result := ban_ip_address(
      p_ip_address := p_ip_address,
      p_ban_reason := 'auto_ban',
      p_officer_id := '00000000-0000-0000-0000-000000000000'::uuid, -- System
      p_ban_details := jsonb_build_object(
        'event_type', p_event_type,
        'severity', p_severity,
        'auto_banned', true
      ),
      p_banned_until := NULL -- Permanent
    );

    -- Ban user account
    UPDATE user_profiles
    SET 
      is_banned = true,
      banned_until = NULL
    WHERE id = p_user_id;

    -- Mark event as auto-banned
    UPDATE security_events
    SET auto_banned = true
    WHERE id = (SELECT id FROM security_events ORDER BY created_at DESC LIMIT 1);

    RETURN jsonb_build_object(
      'logged', true,
      'auto_banned', true,
      'ip_banned', (v_ban_result->>'success')::boolean,
      'user_banned', true
    );
  END IF;

  RETURN jsonb_build_object('logged', true, 'auto_banned', false);
END;
$$;

-- Function to toggle anti-hack system (requires code 1903)
CREATE OR REPLACE FUNCTION toggle_anti_hack_system(
  p_code text,
  p_enabled boolean,
  p_admin_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_profile user_profiles%ROWTYPE;
  v_correct_code text;
BEGIN
  -- Verify admin
  SELECT * INTO v_admin_profile
  FROM user_profiles
  WHERE id = p_admin_id
    AND is_admin = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can toggle security system'
    );
  END IF;

  -- Get correct code
  SELECT (setting_value->>'value')::text INTO v_correct_code
  FROM security_settings
  WHERE setting_key = 'admin_toggle_code';

  -- Verify code
  IF p_code != COALESCE(v_correct_code, '1903') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid security code'
    );
  END IF;

  -- Update setting
  UPDATE security_settings
  SET 
    setting_value = jsonb_build_object('value', p_enabled),
    updated_at = now()
  WHERE setting_key = 'anti_hack_enabled';

  RETURN jsonb_build_object(
    'success', true,
    'enabled', p_enabled,
    'message', CASE WHEN p_enabled THEN 'Anti-hack system enabled' ELSE 'Anti-hack system disabled' END
  );
END;
$$;

-- Add comments
COMMENT ON TABLE security_settings IS 'Security system configuration';
COMMENT ON TABLE security_events IS 'Log of all security events and detected threats';
COMMENT ON FUNCTION log_security_event IS 'Logs security events and auto-bans if threat is detected';
COMMENT ON FUNCTION toggle_anti_hack_system IS 'Toggles anti-hack system with admin code 1903';

