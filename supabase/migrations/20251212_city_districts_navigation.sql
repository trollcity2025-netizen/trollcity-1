-- City Districts Navigation System
-- Created: 2025-12-12
-- Purpose: Create district-based navigation with role-based access and onboarding tours

-- 1. Create city_districts table
CREATE TABLE IF NOT EXISTS city_districts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'MapPin',
  color VARCHAR(20) DEFAULT '#6366f1',
  background_image_url TEXT,
  required_role VARCHAR(50) DEFAULT 'user', -- 'user', 'troll_officer', 'admin', 'family_member'
  required_permissions TEXT[], -- Array of specific permissions needed
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  features JSONB DEFAULT '{}', -- Available features in this district
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create district_features table for granular feature access
CREATE TABLE IF NOT EXISTS district_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  district_id UUID NOT NULL REFERENCES city_districts(id) ON DELETE CASCADE,
  feature_name VARCHAR(100) NOT NULL,
  feature_type VARCHAR(50) NOT NULL, -- 'page', 'component', 'action'
  route_path VARCHAR(200),
  required_role VARCHAR(50) DEFAULT 'user',
  required_permissions TEXT[],
  is_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create user_district_progress table for onboarding tours
CREATE TABLE IF NOT EXISTS user_district_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES city_districts(id) ON DELETE CASCADE,
  onboarding_completed BOOLEAN DEFAULT false,
  features_explored TEXT[], -- Array of explored feature names
  last_visited_at TIMESTAMPTZ DEFAULT NOW(),
  visit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, district_id)
);

-- 4. Create district_announcements table
CREATE TABLE IF NOT EXISTS district_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  district_id UUID REFERENCES city_districts(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  announcement_type VARCHAR(50) DEFAULT 'info', -- 'info', 'warning', 'success', 'event'
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_city_districts_active ON city_districts(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_city_districts_role ON city_districts(required_role);
CREATE INDEX IF NOT EXISTS idx_district_features_district ON district_features(district_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_user_district_progress_user ON user_district_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_district_announcements_district ON district_announcements(district_id, is_active);

-- 6. Enable RLS
ALTER TABLE city_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_district_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_announcements ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for city_districts
CREATE POLICY "Everyone can view active districts"
  ON city_districts FOR SELECT
  USING (is_active = true);

-- Only admins can manage districts
CREATE POLICY "Admins can manage districts"
  ON city_districts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 8. RLS Policies for district_features
CREATE POLICY "Users can view features for accessible districts"
  ON district_features FOR SELECT
  USING (
    is_enabled = true AND
    EXISTS (
      SELECT 1 FROM city_districts cd
      WHERE cd.id = district_id
      AND cd.is_active = true
      AND (
        cd.required_role = 'user' OR
        cd.required_role = (SELECT role FROM user_profiles WHERE id = auth.uid()) OR
        (cd.required_role = 'family_member' AND EXISTS (
          SELECT 1 FROM applications a
          WHERE a.user_id = auth.uid() AND a.type = 'troll_family' AND a.status = 'approved'
        ))
      )
    )
  );

CREATE POLICY "Admins can manage district features"
  ON district_features FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 9. RLS Policies for user_district_progress
CREATE POLICY "Users can view their own progress"
  ON user_district_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own progress"
  ON user_district_progress FOR ALL
  USING (user_id = auth.uid());

-- 10. RLS Policies for district_announcements
CREATE POLICY "Users can view announcements for accessible districts"
  ON district_announcements FOR SELECT
  USING (
    is_active = true AND
    (district_id IS NULL OR EXISTS (
      SELECT 1 FROM city_districts cd
      WHERE cd.id = district_announcements.district_id
      AND cd.is_active = true
    ))
  );

CREATE POLICY "Admins and officers can manage announcements"
  ON district_announcements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'officer')
    )
  );

-- 11. Insert default districts
INSERT INTO city_districts (name, display_name, description, icon, color, required_role, sort_order, features) VALUES
('main_plaza', 'Main Plaza', 'The heart of Troll City - live streams, marketplace, and community hub', 'Home', '#10b981', 'user', 1, '{
  "live_streams": true,
  "marketplace": true,
  "leaderboard": true,
  "wall": true,
  "troll_wheel": true
}'),
('entertainment_district', 'Entertainment District', 'Games, shows, and entertainment - Tromody Show, Troll Wheel, and more', 'FerrisWheel', '#f59e0b', 'user', 2, '{
  "tromody_show": true,
  "troll_wheel": true,
  "games": true,
  "entertainment": true
}'),
('commerce_district', 'Commerce District', 'Buy, sell, and trade - Coin Store, Marketplace, and Trollmonds', 'Store', '#3b82f6', 'user', 3, '{
  "coin_store": true,
  "marketplace": true,
  "trollmonds_store": true,
  "inventory": true,
  "sell_on_troll_city": true
}'),
('justice_district', 'Justice District', 'Troll Court, legal matters, and dispute resolution', 'Scale', '#ef4444', 'user', 4, '{
  "troll_court": true,
  "applications": true,
  "support": true,
  "safety": true
}'),
('officer_quarters', 'Officer Quarters', 'Troll Officer operations, moderation, and law enforcement', 'Shield', '#dc2626', 'troll_officer', 5, '{
  "officer_lounge": true,
  "moderation": true,
  "reports": true,
  "officer_dashboard": true
}'),
('family_neighborhood', 'Family Neighborhood', 'Troll Family community, wars, and exclusive content', 'Users', '#8b5cf6', 'family_member', 6, '{
  "family_lounge": true,
  "family_wars": true,
  "family_leaderboard": true,
  "family_shop": true
}'),
('admin_tower', 'Admin Tower', 'Administrative controls and system management', 'Crown', '#7c3aed', 'admin', 7, '{
  "admin_dashboard": true,
  "admin_hq": true,
  "control_center": true,
  "marketplace_admin": true,
  "applications_admin": true
}');

-- 12. Insert district features
INSERT INTO district_features (district_id, feature_name, feature_type, route_path, required_role, sort_order) VALUES
-- Main Plaza features
((SELECT id FROM city_districts WHERE name = 'main_plaza'), 'Live Streams', 'page', '/live', 'user', 1),
((SELECT id FROM city_districts WHERE name = 'main_plaza'), 'Messages', 'page', '/messages', 'user', 2),
((SELECT id FROM city_districts WHERE name = 'main_plaza'), 'Following', 'page', '/following', 'user', 3),
((SELECT id FROM city_districts WHERE name = 'main_plaza'), 'Leaderboard', 'page', '/leaderboard', 'user', 4),
((SELECT id FROM city_districts WHERE name = 'main_plaza'), 'Troll City Wall', 'page', '/wall', 'user', 5),

-- Entertainment District features
((SELECT id FROM city_districts WHERE name = 'entertainment_district'), 'Tromody Show', 'page', '/tromody', 'user', 1),
((SELECT id FROM city_districts WHERE name = 'entertainment_district'), 'Troll Wheel', 'page', '/troll-wheel', 'user', 2),

-- Commerce District features
((SELECT id FROM city_districts WHERE name = 'commerce_district'), 'Coin Store', 'page', '/store', 'user', 1),
((SELECT id FROM city_districts WHERE name = 'commerce_district'), 'Marketplace', 'page', '/marketplace', 'user', 2),
((SELECT id FROM city_districts WHERE name = 'commerce_district'), 'Trollmonds Store', 'page', '/trollmonds-store', 'user', 3),
((SELECT id FROM city_districts WHERE name = 'commerce_district'), 'My Inventory', 'page', '/inventory', 'user', 4),
((SELECT id FROM city_districts WHERE name = 'commerce_district'), 'Sell on Troll City', 'page', '/sell', 'user', 5),

-- Justice District features
((SELECT id FROM city_districts WHERE name = 'justice_district'), 'Troll Court', 'page', '/troll-court', 'user', 1),
((SELECT id FROM city_districts WHERE name = 'justice_district'), 'Applications', 'page', '/apply', 'user', 2),
((SELECT id FROM city_districts WHERE name = 'justice_district'), 'Support', 'page', '/support', 'user', 3),
((SELECT id FROM city_districts WHERE name = 'justice_district'), 'Safety & Policies', 'page', '/safety', 'user', 4),

-- Officer Quarters features
((SELECT id FROM city_districts WHERE name = 'officer_quarters'), 'Officer Lounge', 'page', '/officer/lounge', 'troll_officer', 1),
((SELECT id FROM city_districts WHERE name = 'officer_quarters'), 'Officer Moderation', 'page', '/officer/moderation', 'troll_officer', 2),
((SELECT id FROM city_districts WHERE name = 'officer_quarters'), 'Officer Dashboard', 'page', '/officer/dashboard', 'troll_officer', 3),

-- Family Neighborhood features
((SELECT id FROM city_districts WHERE name = 'family_neighborhood'), 'Family Lounge', 'page', '/family/lounge', 'family_member', 1),
((SELECT id FROM city_districts WHERE name = 'family_neighborhood'), 'Family War Hub', 'page', '/family/wars-hub', 'family_member', 2),
((SELECT id FROM city_districts WHERE name = 'family_neighborhood'), 'Family Leaderboard', 'page', '/family/leaderboard', 'family_member', 3),
((SELECT id FROM city_districts WHERE name = 'family_neighborhood'), 'Family Shop', 'page', '/family/shop', 'family_member', 4),

-- Admin Tower features
((SELECT id FROM city_districts WHERE name = 'admin_tower'), 'Admin Dashboard', 'page', '/admin', 'admin', 1),
((SELECT id FROM city_districts WHERE name = 'admin_tower'), 'Admin HQ', 'page', '/admin/hq', 'admin', 2),
((SELECT id FROM city_districts WHERE name = 'admin_tower'), 'City Control Center', 'page', '/admin/control-center', 'admin', 3),
((SELECT id FROM city_districts WHERE name = 'admin_tower'), 'Marketplace Admin', 'page', '/admin/marketplace', 'admin', 4),
((SELECT id FROM city_districts WHERE name = 'admin_tower'), 'Applications Admin', 'page', '/admin/applications', 'admin', 5);

-- 13. Function to get accessible districts for a user
CREATE OR REPLACE FUNCTION get_user_accessible_districts(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  display_name VARCHAR(100),
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  required_role VARCHAR(50),
  features JSONB,
  onboarding_completed BOOLEAN,
  visit_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cd.id,
    cd.name,
    cd.display_name,
    cd.description,
    cd.icon,
    cd.color,
    cd.required_role,
    cd.features,
    COALESCE(udp.onboarding_completed, false) as onboarding_completed,
    COALESCE(udp.visit_count, 0) as visit_count
  FROM city_districts cd
  LEFT JOIN user_district_progress udp ON cd.id = udp.district_id AND udp.user_id = p_user_id
  WHERE cd.is_active = true
    AND (
      cd.required_role = 'user' OR
      cd.required_role = (SELECT role FROM user_profiles WHERE id = p_user_id) OR
      (cd.required_role = 'family_member' AND EXISTS (
        SELECT 1 FROM applications a
        WHERE a.user_id = p_user_id AND a.type = 'troll_family' AND a.status = 'approved'
      ))
    )
  ORDER BY cd.sort_order;
END;
$$;

-- 14. Function to update district progress
CREATE OR REPLACE FUNCTION update_district_progress(
  p_user_id UUID,
  p_district_id UUID,
  p_onboarding_completed BOOLEAN DEFAULT NULL,
  p_feature_explored VARCHAR(100) DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_progress RECORD;
BEGIN
  -- Get or create progress record
  SELECT * INTO v_progress
  FROM user_district_progress
  WHERE user_id = p_user_id AND district_id = p_district_id;

  IF NOT FOUND THEN
    -- Create new progress record
    INSERT INTO user_district_progress (
      user_id, district_id, onboarding_completed, features_explored, visit_count, last_visited_at
    ) VALUES (
      p_user_id, p_district_id,
      COALESCE(p_onboarding_completed, false),
      CASE WHEN p_feature_explored IS NOT NULL THEN ARRAY[p_feature_explored] ELSE ARRAY[]::TEXT[] END,
      1, NOW()
    );
  ELSE
    -- Update existing progress
    UPDATE user_district_progress
    SET
      onboarding_completed = COALESCE(p_onboarding_completed, onboarding_completed),
      features_explored = CASE
        WHEN p_feature_explored IS NOT NULL AND NOT (p_feature_explored = ANY(features_explored))
        THEN features_explored || p_feature_explored
        ELSE features_explored
      END,
      visit_count = visit_count + 1,
      last_visited_at = NOW(),
      updated_at = NOW()
    WHERE user_id = p_user_id AND district_id = p_district_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'District progress updated');
END;
$$;

-- 15. Function to get district onboarding tour steps
CREATE OR REPLACE FUNCTION get_district_onboarding_tour(p_district_name VARCHAR(100))
RETURNS TABLE (
  step_number INTEGER,
  title VARCHAR(200),
  description TEXT,
  target_feature VARCHAR(100),
  route_path VARCHAR(200),
  action_type VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return onboarding steps based on district
  CASE p_district_name
    WHEN 'main_plaza' THEN
      RETURN QUERY VALUES
        (1, 'Welcome to Main Plaza', 'This is the heart of Troll City! Here you can watch live streams, browse the marketplace, and connect with the community.', 'live_streams', '/live', 'highlight'),
        (2, 'Live Streams', 'Watch your favorite creators and discover new talent in real-time.', 'live_streams', '/live', 'navigate'),
        (3, 'Marketplace', 'Buy and sell items with other Troll City members.', 'marketplace', '/marketplace', 'navigate'),
        (4, 'Leaderboard', 'See how you rank among the Troll City elite.', 'leaderboard', '/leaderboard', 'navigate'),
        (5, 'Troll City Wall', 'Share posts and connect with the community.', 'wall', '/wall', 'navigate');

    WHEN 'commerce_district' THEN
      RETURN QUERY VALUES
        (1, 'Commerce District', 'Welcome to the shopping hub of Troll City! Here you can buy coins, browse items, and manage your inventory.', 'coin_store', '/store', 'highlight'),
        (2, 'Coin Store', 'Purchase Troll Coins to enhance your experience.', 'coin_store', '/store', 'navigate'),
        (3, 'Marketplace', 'Discover unique items from fellow Trolls.', 'marketplace', '/marketplace', 'navigate'),
        (4, 'Your Inventory', 'Manage your purchased items and digital goods.', 'inventory', '/inventory', 'navigate'),
        (5, 'Start Selling', 'Turn your creativity into coins by selling on Troll City.', 'sell_on_troll_city', '/sell', 'navigate');

    WHEN 'officer_quarters' THEN
      RETURN QUERY VALUES
        (1, 'Officer Quarters', 'Welcome to the Troll Officer headquarters! This is where law enforcement and moderation happens.', 'officer_lounge', '/officer/lounge', 'highlight'),
        (2, 'Officer Lounge', 'Connect with fellow officers and access exclusive resources.', 'officer_lounge', '/officer/lounge', 'navigate'),
        (3, 'Moderation Tools', 'Help maintain Troll City by moderating content and users.', 'moderation', '/officer/moderation', 'navigate'),
        (4, 'Officer Dashboard', 'Track your performance and access officer-specific features.', 'officer_dashboard', '/officer/dashboard', 'navigate');

    WHEN 'family_neighborhood' THEN
      RETURN QUERY VALUES
        (1, 'Family Neighborhood', 'Welcome to the exclusive Troll Family community! Connect with your family and compete in epic wars.', 'family_lounge', '/family/lounge', 'highlight'),
        (2, 'Family Lounge', 'Hang out with your family members and plan your next move.', 'family_lounge', '/family/lounge', 'navigate'),
        (3, 'War Hub', 'Join family wars and battle for supremacy!', 'family_wars', '/family/wars-hub', 'navigate'),
        (4, 'Family Shop', 'Purchase exclusive family items and upgrades.', 'family_shop', '/family/shop', 'navigate');

    ELSE
      -- Default empty tour
      RETURN QUERY SELECT 1, 'Welcome!', 'Explore this district and discover its features.', '', '', 'highlight'::VARCHAR(50) LIMIT 0;
  END CASE;
END;
$$;

-- 16. Grant permissions
GRANT EXECUTE ON FUNCTION get_user_accessible_districts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_district_progress(UUID, UUID, BOOLEAN, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_district_onboarding_tour(VARCHAR) TO authenticated;

-- Grant select on tables
GRANT SELECT ON city_districts TO authenticated;
GRANT SELECT ON district_features TO authenticated;
GRANT SELECT ON district_announcements TO authenticated;

-- 17. Add comments
COMMENT ON TABLE city_districts IS 'Districts/areas within Troll City with role-based access';
COMMENT ON TABLE district_features IS 'Specific features available within each district';
COMMENT ON TABLE user_district_progress IS 'User progress and onboarding status for each district';
COMMENT ON TABLE district_announcements IS 'Announcements and notifications for specific districts';
COMMENT ON FUNCTION get_user_accessible_districts IS 'Returns districts accessible to a specific user based on their role and permissions';
COMMENT ON FUNCTION update_district_progress IS 'Updates user progress in a district (visits, onboarding completion, features explored)';
COMMENT ON FUNCTION get_district_onboarding_tour IS 'Returns onboarding tour steps for a specific district';

-- 18. Create view for district navigation
CREATE OR REPLACE VIEW district_navigation AS
SELECT
  cd.id,
  cd.name,
  cd.display_name,
  cd.description,
  cd.icon,
  cd.color,
  cd.required_role,
  cd.sort_order,
  cd.features,
  COUNT(df.id) as feature_count,
  COUNT(da.id) as announcement_count
FROM city_districts cd
LEFT JOIN district_features df ON cd.id = df.district_id AND df.is_enabled = true
LEFT JOIN district_announcements da ON cd.id = da.district_id AND da.is_active = true
WHERE cd.is_active = true
GROUP BY cd.id, cd.name, cd.display_name, cd.description, cd.icon, cd.color, cd.required_role, cd.sort_order, cd.features
ORDER BY cd.sort_order;

GRANT SELECT ON district_navigation TO authenticated;