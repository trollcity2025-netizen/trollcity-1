-- Admin Royal Family System
-- Created: 2025-12-12
-- Purpose: Implement Wife/Husband titles based on gifting with duration perks and live crown effects

-- 1. Add gender field to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female'));

-- 2. Create admin_gift_totals table to track cumulative gifts to admin
CREATE TABLE IF NOT EXISTS admin_gift_totals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  total_paid_coins BIGINT DEFAULT 0,
  last_gift_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, admin_id)
);

-- 3. Create royal_family_titles table for current and historical titles
CREATE TABLE IF NOT EXISTS royal_family_titles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title_type VARCHAR(20) NOT NULL CHECK (title_type IN ('wife', 'husband', 'former_wife', 'former_husband')),
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  total_coins_at_assignment BIGINT NOT NULL,
  duration_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create royal_family_perks table for duration-based perks
CREATE TABLE IF NOT EXISTS royal_family_perks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title_id UUID NOT NULL REFERENCES royal_family_titles(id) ON DELETE CASCADE,
  perk_type VARCHAR(50) NOT NULL, -- 'profile_glow', 'chat_highlight', 'gift_bonus', 'entrance_text', 'chat_badge', 'vip_panel', 'legacy_badge'
  perk_level INTEGER NOT NULL, -- 1-5 corresponding to duration tiers
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create honorary_family_members table for admin-assigned members
CREATE TABLE IF NOT EXISTS honorary_family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES user_profiles(id),
  title VARCHAR(100) DEFAULT 'Honorary Family Member',
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, admin_id)
);

-- 6. Create royal_family_history view for legacy tracking
CREATE TABLE IF NOT EXISTS royal_family_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'assigned', 'transferred', 'dethroned', 'perk_unlocked'
  title_type VARCHAR(20),
  details JSONB DEFAULT '{}',
  event_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_gift_totals_user_admin ON admin_gift_totals(user_id, admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_gift_totals_total_coins ON admin_gift_totals(total_paid_coins DESC);
CREATE INDEX IF NOT EXISTS idx_royal_family_titles_user_admin ON royal_family_titles(user_id, admin_id);
CREATE INDEX IF NOT EXISTS idx_royal_family_titles_active ON royal_family_titles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_royal_family_perks_title ON royal_family_perks(title_id);
CREATE INDEX IF NOT EXISTS idx_honorary_family_members_active ON honorary_family_members(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_royal_family_history_user ON royal_family_history(user_id);

-- 8. Enable RLS
ALTER TABLE admin_gift_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE royal_family_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE royal_family_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE honorary_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE royal_family_history ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies
-- Admin gift totals: Users can view their own, admins can view all
CREATE POLICY "Users can view their own gift totals"
  ON admin_gift_totals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all gift totals"
  ON admin_gift_totals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Royal family titles: Everyone can view active titles
CREATE POLICY "Everyone can view royal family titles"
  ON royal_family_titles FOR SELECT
  USING (true);

-- Royal family perks: Users can view their own, admins can view all
CREATE POLICY "Users can view their own perks"
  ON royal_family_perks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM royal_family_titles rft
      WHERE rft.id = royal_family_perks.title_id
      AND rft.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all perks"
  ON royal_family_perks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Honorary family members: Everyone can view active members
CREATE POLICY "Everyone can view honorary family members"
  ON honorary_family_members FOR SELECT
  USING (is_active = true);

-- Royal family history: Users can view their own history, admins can view all
CREATE POLICY "Users can view their own history"
  ON royal_family_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all history"
  ON royal_family_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 10. Function to process gift to admin and update royal family status
CREATE OR REPLACE FUNCTION process_admin_gift(
  p_gifter_id UUID,
  p_admin_id UUID,
  p_paid_coins BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_total BIGINT;
  v_threshold BIGINT := 50000;
  v_current_title RECORD;
  v_new_title_holder UUID;
  v_gifter_gender VARCHAR(10);
  v_title_type VARCHAR(20);
BEGIN
  -- Get gifter's gender
  SELECT gender INTO v_gifter_gender
  FROM user_profiles
  WHERE id = p_gifter_id;

  IF v_gifter_gender IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gender not set for gifter');
  END IF;

  -- Update or insert gift total
  INSERT INTO admin_gift_totals (user_id, admin_id, total_paid_coins, last_gift_at, updated_at)
  VALUES (p_gifter_id, p_admin_id, p_paid_coins, NOW(), NOW())
  ON CONFLICT (user_id, admin_id)
  DO UPDATE SET
    total_paid_coins = admin_gift_totals.total_paid_coins + p_paid_coins,
    last_gift_at = NOW(),
    updated_at = NOW()
  RETURNING total_paid_coins INTO v_current_total;

  -- Check if gifter qualifies for royal title (50k threshold)
  IF v_current_total >= v_threshold THEN
    -- Determine title type based on gender
    v_title_type := CASE WHEN v_gifter_gender = 'female' THEN 'wife' ELSE 'husband' END;

    -- Find current active title holder
    SELECT user_id INTO v_current_title
    FROM royal_family_titles
    WHERE admin_id = p_admin_id AND is_active = true
    AND title_type IN ('wife', 'husband');

    -- Find the user with the highest total now
    SELECT agt.user_id INTO v_new_title_holder
    FROM admin_gift_totals agt
    WHERE agt.admin_id = p_admin_id AND agt.total_paid_coins >= v_threshold
    ORDER BY agt.total_paid_coins DESC
    LIMIT 1;

    -- If the top gifter changed, transfer the title
    IF v_current_title IS NULL OR v_current_title.user_id != v_new_title_holder THEN
      -- Deactivate current title if exists
      IF v_current_title IS NOT NULL THEN
        UPDATE royal_family_titles
        SET is_active = false,
            unassigned_at = NOW(),
            updated_at = NOW()
        WHERE user_id = v_current_title.user_id
          AND admin_id = p_admin_id
          AND is_active = true
          AND title_type IN ('wife', 'husband');

        -- Convert to former title
        UPDATE royal_family_titles
        SET title_type = CASE WHEN title_type = 'wife' THEN 'former_wife' ELSE 'former_husband' END,
            is_active = false,
            unassigned_at = NOW(),
            updated_at = NOW()
        WHERE user_id = v_current_title.user_id
          AND admin_id = p_admin_id
          AND title_type IN ('wife', 'husband');

        -- Log dethronement
        INSERT INTO royal_family_history (
          user_id, admin_id, event_type, title_type, details
        ) VALUES (
          v_current_title.user_id, p_admin_id, 'dethroned',
          CASE WHEN (SELECT gender FROM user_profiles WHERE id = v_current_title.user_id) = 'female' THEN 'wife' ELSE 'husband' END,
          jsonb_build_object('reason', 'surpassed', 'new_holder', v_new_title_holder, 'old_total', v_current_total)
        );
      END IF;

      -- Assign new title
      INSERT INTO royal_family_titles (
        user_id, admin_id, title_type, total_coins_at_assignment
      ) VALUES (
        v_new_title_holder, p_admin_id, v_title_type, v_current_total
      );

      -- Log assignment
      INSERT INTO royal_family_history (
        user_id, admin_id, event_type, title_type, details
      ) VALUES (
        v_new_title_holder, p_admin_id, 'assigned', v_title_type,
        jsonb_build_object('total_coins', v_current_total, 'threshold', v_threshold)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_total', v_current_total,
    'qualifies', v_current_total >= v_threshold
  );
END;
$$;

-- 11. Function to update title duration and unlock perks
CREATE OR REPLACE FUNCTION update_royal_family_duration()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title RECORD;
  v_duration_days INTEGER;
  v_current_perk_level INTEGER;
  v_updated_count INTEGER := 0;
BEGIN
  -- Update duration for all active titles
  FOR v_title IN
    SELECT id, user_id, admin_id, assigned_at
    FROM royal_family_titles
    WHERE is_active = true
    AND title_type IN ('wife', 'husband')
  LOOP
    -- Calculate duration in days
    v_duration_days := EXTRACT(EPOCH FROM (NOW() - v_title.assigned_at)) / 86400;

    -- Update duration
    UPDATE royal_family_titles
    SET duration_days = v_duration_days,
        updated_at = NOW()
    WHERE id = v_title.id;

    -- Get current perk level
    SELECT COALESCE(MAX(perk_level), 0) INTO v_current_perk_level
    FROM royal_family_perks
    WHERE title_id = v_title.id;

    -- Unlock perks based on duration tiers
    -- Tier 1: 7 days
    IF v_duration_days >= 7 AND v_current_perk_level < 1 THEN
      INSERT INTO royal_family_perks (title_id, perk_type, perk_level)
      VALUES
        (v_title.id, 'profile_glow', 1),
        (v_title.id, 'chat_highlight', 1);
      v_updated_count := v_updated_count + 1;
    END IF;

    -- Tier 2: 14 days
    IF v_duration_days >= 14 AND v_current_perk_level < 2 THEN
      INSERT INTO royal_family_perks (title_id, perk_type, perk_level)
      VALUES
        (v_title.id, 'gift_bonus', 2),
        (v_title.id, 'entrance_text', 2);
      v_updated_count := v_updated_count + 1;
    END IF;

    -- Tier 3: 30 days
    IF v_duration_days >= 30 AND v_current_perk_level < 3 THEN
      INSERT INTO royal_family_perks (title_id, perk_type, perk_level)
      VALUES
        (v_title.id, 'chat_badge', 3);
      v_updated_count := v_updated_count + 1;
    END IF;

    -- Tier 4: 60 days
    IF v_duration_days >= 60 AND v_current_perk_level < 4 THEN
      INSERT INTO royal_family_perks (title_id, perk_type, perk_level)
      VALUES
        (v_title.id, 'vip_panel', 4),
        (v_title.id, 'crown_upgrade', 4);
      v_updated_count := v_updated_count + 1;
    END IF;

    -- Tier 5: 90 days
    IF v_duration_days >= 90 AND v_current_perk_level < 5 THEN
      INSERT INTO royal_family_perks (title_id, perk_type, perk_level)
      VALUES
        (v_title.id, 'legacy_badge', 5);
      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;

  RETURN v_updated_count;
END;
$$;

-- 12. Function to get current royal family status
CREATE OR REPLACE FUNCTION get_royal_family_status(p_admin_id UUID DEFAULT NULL)
RETURNS TABLE (
  admin_id UUID,
  current_wife JSONB,
  current_husband JSONB,
  gift_leaderboard JSONB,
  honorary_members JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If no admin specified, get all admins with royal families
  IF p_admin_id IS NULL THEN
    RETURN QUERY
    SELECT
      up.id as admin_id,
      -- Current wife
      CASE WHEN wf.user_id IS NOT NULL THEN
        jsonb_build_object(
          'user_id', wf.user_id,
          'username', wf_up.username,
          'total_coins', agt_wife.total_paid_coins,
          'duration_days', wf.duration_days,
          'assigned_at', wf.assigned_at
        )
      ELSE NULL END as current_wife,
      -- Current husband
      CASE WHEN hm.user_id IS NOT NULL THEN
        jsonb_build_object(
          'user_id', hm.user_id,
          'username', hm_up.username,
          'total_coins', agt_husband.total_paid_coins,
          'duration_days', hm.duration_days,
          'assigned_at', hm.assigned_at
        )
      ELSE NULL END as current_husband,
      -- Gift leaderboard (top 10)
      (SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', agt.user_id,
          'username', up_gift.username,
          'total_coins', agt.total_paid_coins,
          'gender', up_gift.gender,
          'last_gift_at', agt.last_gift_at
        )
      ) FROM (
        SELECT * FROM admin_gift_totals
        WHERE admin_id = up.id AND total_paid_coins >= 50000
        ORDER BY total_paid_coins DESC
        LIMIT 10
      ) agt
      LEFT JOIN user_profiles up_gift ON agt.user_id = up_gift.id
      ) as gift_leaderboard,
      -- Honorary members
      (SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', hfm.user_id,
          'username', hfm_up.username,
          'title', hfm.title,
          'assigned_at', hfm.assigned_at
        )
      ) FROM honorary_family_members hfm
      LEFT JOIN user_profiles hfm_up ON hfm.user_id = hfm_up.id
      WHERE hfm.admin_id = up.id AND hfm.is_active = true
      ) as honorary_members
    FROM user_profiles up
    LEFT JOIN royal_family_titles wf ON wf.admin_id = up.id AND wf.title_type = 'wife' AND wf.is_active = true
    LEFT JOIN user_profiles wf_up ON wf.user_id = wf_up.id
    LEFT JOIN admin_gift_totals agt_wife ON agt_wife.user_id = wf.user_id AND agt_wife.admin_id = up.id
    LEFT JOIN royal_family_titles hm ON hm.admin_id = up.id AND hm.title_type = 'husband' AND hm.is_active = true
    LEFT JOIN user_profiles hm_up ON hm.user_id = hm_up.id
    LEFT JOIN admin_gift_totals agt_husband ON agt_husband.user_id = hm.user_id AND agt_husband.admin_id = up.id
    WHERE up.role = 'admin';
  ELSE
    -- Specific admin
    RETURN QUERY
    SELECT
      p_admin_id as admin_id,
      -- Current wife
      CASE WHEN wf.user_id IS NOT NULL THEN
        jsonb_build_object(
          'user_id', wf.user_id,
          'username', wf_up.username,
          'total_coins', agt_wife.total_paid_coins,
          'duration_days', wf.duration_days,
          'assigned_at', wf.assigned_at
        )
      ELSE NULL END as current_wife,
      -- Current husband
      CASE WHEN hm.user_id IS NOT NULL THEN
        jsonb_build_object(
          'user_id', hm.user_id,
          'username', hm_up.username,
          'total_coins', agt_husband.total_paid_coins,
          'duration_days', hm.duration_days,
          'assigned_at', hm.assigned_at
        )
      ELSE NULL END as current_husband,
      -- Gift leaderboard (top 10)
      (SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', agt.user_id,
          'username', up_gift.username,
          'total_coins', agt.total_paid_coins,
          'gender', up_gift.gender,
          'last_gift_at', agt.last_gift_at
        )
      ) FROM (
        SELECT * FROM admin_gift_totals
        WHERE admin_id = p_admin_id AND total_paid_coins >= 50000
        ORDER BY total_paid_coins DESC
        LIMIT 10
      ) agt
      LEFT JOIN user_profiles up_gift ON agt.user_id = up_gift.id
      ) as gift_leaderboard,
      -- Honorary members
      (SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', hfm.user_id,
          'username', hfm_up.username,
          'title', hfm.title,
          'assigned_at', hfm.assigned_at
        )
      ) FROM honorary_family_members hfm
      LEFT JOIN user_profiles hfm_up ON hfm.user_id = hfm_up.id
      WHERE hfm.admin_id = p_admin_id AND hfm.is_active = true
      ) as honorary_members
    FROM user_profiles up
    LEFT JOIN royal_family_titles wf ON wf.admin_id = p_admin_id AND wf.title_type = 'wife' AND wf.is_active = true
    LEFT JOIN user_profiles wf_up ON wf.user_id = wf_up.id
    LEFT JOIN admin_gift_totals agt_wife ON agt_wife.user_id = wf.user_id AND agt_wife.admin_id = p_admin_id
    LEFT JOIN royal_family_titles hm ON hm.admin_id = p_admin_id AND hm.title_type = 'husband' AND hm.is_active = true
    LEFT JOIN user_profiles hm_up ON hm.user_id = hm_up.id
    LEFT JOIN admin_gift_totals agt_husband ON agt_husband.user_id = hm.user_id AND agt_husband.admin_id = p_admin_id
    WHERE up.id = p_admin_id;
  END IF;
END;
$$;

-- 13. Function to manage honorary family members
CREATE OR REPLACE FUNCTION manage_honorary_family_member(
  p_user_id UUID,
  p_admin_id UUID,
  p_action VARCHAR(20), -- 'add', 'remove', 'update_title'
  p_title VARCHAR(100) DEFAULT 'Honorary Family Member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_check BOOLEAN;
BEGIN
  -- Check if caller is admin
  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_admin_check;

  IF NOT v_admin_check THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can manage honorary family members');
  END IF;

  IF p_action = 'add' THEN
    INSERT INTO honorary_family_members (user_id, admin_id, assigned_by, title)
    VALUES (p_user_id, p_admin_id, auth.uid(), p_title)
    ON CONFLICT (user_id, admin_id)
    DO UPDATE SET
      title = p_title,
      assigned_by = auth.uid(),
      assigned_at = NOW(),
      is_active = true,
      removed_at = NULL,
      updated_at = NOW();

    RETURN jsonb_build_object('success', true, 'action', 'added');

  ELSIF p_action = 'remove' THEN
    UPDATE honorary_family_members
    SET is_active = false,
        removed_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id AND admin_id = p_admin_id;

    RETURN jsonb_build_object('success', true, 'action', 'removed');

  ELSIF p_action = 'update_title' THEN
    UPDATE honorary_family_members
    SET title = p_title,
        updated_at = NOW()
    WHERE user_id = p_user_id AND admin_id = p_admin_id AND is_active = true;

    RETURN jsonb_build_object('success', true, 'action', 'updated');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
END;
$$;

-- 14. Grant permissions
GRANT EXECUTE ON FUNCTION process_admin_gift(UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_royal_family_duration() TO authenticated;
GRANT EXECUTE ON FUNCTION get_royal_family_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_honorary_family_member(UUID, UUID, VARCHAR, VARCHAR) TO authenticated;

-- Grant select on tables
GRANT SELECT ON admin_gift_totals TO authenticated;
GRANT SELECT ON royal_family_titles TO authenticated;
GRANT SELECT ON royal_family_perks TO authenticated;
GRANT SELECT ON honorary_family_members TO authenticated;
GRANT SELECT ON royal_family_history TO authenticated;

-- 15. Add comments
COMMENT ON TABLE admin_gift_totals IS 'Tracks cumulative paid coin gifts to admins for royal family qualification';
COMMENT ON TABLE royal_family_titles IS 'Current and historical royal family titles (Wife/Husband)';
COMMENT ON TABLE royal_family_perks IS 'Duration-based cosmetic perks for royal family members';
COMMENT ON TABLE honorary_family_members IS 'Admin-assigned honorary family members';
COMMENT ON TABLE royal_family_history IS 'Audit log of royal family title changes and events';
COMMENT ON FUNCTION process_admin_gift IS 'Processes gifts to admin and automatically manages royal family titles';
COMMENT ON FUNCTION update_royal_family_duration IS 'Updates title durations and unlocks perks based on time held';
COMMENT ON FUNCTION get_royal_family_status IS 'Returns current royal family status for an admin';
COMMENT ON FUNCTION manage_honorary_family_member IS 'Admin function to add/remove honorary family members';

-- 16. Create views for easy querying
CREATE OR REPLACE VIEW current_royal_family AS
SELECT
  rft.*,
  up.username,
  up.avatar_url,
  agt.total_paid_coins,
  agt.last_gift_at
FROM royal_family_titles rft
LEFT JOIN user_profiles up ON rft.user_id = up.id
LEFT JOIN admin_gift_totals agt ON agt.user_id = rft.user_id AND agt.admin_id = rft.admin_id
WHERE rft.is_active = true
ORDER BY rft.assigned_at DESC;

CREATE OR REPLACE VIEW royal_family_leaderboard AS
SELECT
  agt.*,
  up.username,
  up.avatar_url,
  up.gender,
  ROW_NUMBER() OVER (PARTITION BY agt.admin_id ORDER BY agt.total_paid_coins DESC) as rank
FROM admin_gift_totals agt
LEFT JOIN user_profiles up ON agt.user_id = up.id
WHERE agt.total_paid_coins >= 50000
ORDER BY agt.admin_id, agt.total_paid_coins DESC;

GRANT SELECT ON current_royal_family TO authenticated;
GRANT SELECT ON royal_family_leaderboard TO authenticated;