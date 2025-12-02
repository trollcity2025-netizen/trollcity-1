-- IP Address Banning System for Troll Officers
-- Allows officers to ban IP addresses for violations

-- Create IP bans table
CREATE TABLE IF NOT EXISTS ip_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL,
  banned_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  ban_reason text NOT NULL, -- 'nudity', 'fraud', 'death_threats', 'abuse', 'other'
  ban_details text, -- Additional details about the ban
  banned_until timestamptz, -- NULL = permanent ban
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for fast IP lookups
CREATE INDEX IF NOT EXISTS idx_ip_bans_ip_address ON ip_bans(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_bans_is_active ON ip_bans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ip_bans_banned_by ON ip_bans(banned_by);

-- Enable RLS
ALTER TABLE ip_bans ENABLE ROW LEVEL SECURITY;

-- Only admins can view IP bans and IP addresses
CREATE POLICY "Only admins can view IP bans"
  ON ip_bans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Only officers and admins can create IP bans
CREATE POLICY "Officers and admins can create IP bans"
  ON ip_bans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR is_troll_officer = true)
    )
  );

-- Only officers and admins can update IP bans
CREATE POLICY "Officers and admins can update IP bans"
  ON ip_bans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR is_troll_officer = true)
    )
  );

-- Add IP address tracking to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_known_ip inet,
  ADD COLUMN IF NOT EXISTS ip_address_history jsonb DEFAULT '[]'::jsonb;

-- Create index for IP lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_known_ip ON user_profiles(last_known_ip);

-- Note: IP address visibility is controlled in the frontend
-- Officers can still ban IPs via ban_ip_address() function (uses SECURITY DEFINER)
-- but the frontend will hide IP addresses from officers

-- Function to check if an IP is banned
CREATE OR REPLACE FUNCTION is_ip_banned(p_ip_address inet)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ban_count integer;
BEGIN
  SELECT COUNT(*) INTO v_ban_count
  FROM ip_bans
  WHERE ip_address = p_ip_address
    AND is_active = true
    AND (banned_until IS NULL OR banned_until > now());
  
  RETURN v_ban_count > 0;
END;
$$;

-- Function for officers to ban an IP address
CREATE OR REPLACE FUNCTION ban_ip_address(
  p_ip_address inet,
  p_ban_reason text,
  p_officer_id uuid,
  p_ban_details text DEFAULT NULL,
  p_banned_until timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_officer_profile user_profiles%ROWTYPE;
  v_existing_ban ip_bans%ROWTYPE;
  v_affected_users integer;
BEGIN
  -- Verify officer has permission
  SELECT * INTO v_officer_profile
  FROM user_profiles
  WHERE id = p_officer_id
    AND (is_admin = true OR is_troll_officer = true);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You do not have permission to ban IP addresses.'
    );
  END IF;

  -- Check if IP is already banned
  SELECT * INTO v_existing_ban
  FROM ip_bans
  WHERE ip_address = p_ip_address
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  -- Count affected users before banning
  SELECT COUNT(*) INTO v_affected_users
  FROM user_profiles
  WHERE last_known_ip = p_ip_address;

  IF FOUND THEN
    -- Update existing ban
    UPDATE ip_bans
    SET 
      ban_reason = p_ban_reason,
      ban_details = COALESCE(p_ban_details, ban_details),
      banned_until = COALESCE(p_banned_until, banned_until),
      banned_by = p_officer_id,
      updated_at = now()
    WHERE id = v_existing_ban.id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'IP ban updated',
      'ban_id', v_existing_ban.id,
      'affected_users', v_affected_users
    );
  ELSE
    -- Create new ban
    INSERT INTO ip_bans (
      ip_address,
      banned_by,
      ban_reason,
      ban_details,
      banned_until
    ) VALUES (
      p_ip_address,
      p_officer_id,
      p_ban_reason,
      p_ban_details,
      p_banned_until
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'IP address banned successfully',
      'affected_users', v_affected_users
    );
  END IF;
END;
$$;

-- Function to unban an IP address
CREATE OR REPLACE FUNCTION unban_ip_address(
  p_ip_address inet,
  p_officer_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_officer_profile user_profiles%ROWTYPE;
BEGIN
  -- Verify officer has permission
  SELECT * INTO v_officer_profile
  FROM user_profiles
  WHERE id = p_officer_id
    AND (is_admin = true OR is_troll_officer = true);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You do not have permission to unban IP addresses.'
    );
  END IF;

  -- Deactivate all active bans for this IP
  UPDATE ip_bans
  SET 
    is_active = false,
    updated_at = now()
  WHERE ip_address = p_ip_address
    AND is_active = true;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'IP address unbanned successfully'
  );
END;
$$;

-- Function to get IP ban history
CREATE OR REPLACE FUNCTION get_ip_ban_history(
  p_ip_address inet DEFAULT NULL,
  p_officer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  ip_address inet,
  banned_by uuid,
  ban_reason text,
  ban_details text,
  banned_until timestamptz,
  is_active boolean,
  created_at timestamptz,
  officer_username text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ib.id,
    ib.ip_address,
    ib.banned_by,
    ib.ban_reason,
    ib.ban_details,
    ib.banned_until,
    ib.is_active,
    ib.created_at,
    up.username as officer_username
  FROM ip_bans ib
  LEFT JOIN user_profiles up ON ib.banned_by = up.id
  WHERE 
    (p_ip_address IS NULL OR ib.ip_address = p_ip_address)
    AND (p_officer_id IS NULL OR ib.banned_by = p_officer_id)
  ORDER BY ib.created_at DESC;
END;
$$;

-- Add comments
COMMENT ON TABLE ip_bans IS 'IP address bans issued by troll officers and admins';
COMMENT ON FUNCTION ban_ip_address IS 'Allows officers to ban IP addresses for violations';
COMMENT ON FUNCTION unban_ip_address IS 'Allows officers to unban IP addresses';
COMMENT ON FUNCTION is_ip_banned IS 'Checks if an IP address is currently banned';

