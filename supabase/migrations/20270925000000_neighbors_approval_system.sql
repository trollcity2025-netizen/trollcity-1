-- Migration: Add approval system for neighbors businesses, events, and user content
-- Also adds badge system for event participants

-- 1. Add approval columns to neighbors_businesses
ALTER TABLE neighbors_businesses 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS established_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reports_count INTEGER DEFAULT 0;

-- 2. Add approval columns to neighbors_events
ALTER TABLE neighbors_events 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Add approval columns to neighbors_hiring (job postings)
ALTER TABLE neighbors_hiring 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 4. Create table for user content approvals (posts, jobs, etc.)
CREATE TABLE IF NOT EXISTS user_content_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'event', 'job', 'business', 'profile_update')),
  content_id UUID NOT NULL,
  title TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(content_type, content_id)
);

-- 5. Create table for business reports
CREATE TABLE IF NOT EXISTS business_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES neighbors_businesses(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'investigated', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);

-- 6. Create table for badge awards from events
CREATE TABLE IF NOT EXISTS neighbor_event_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES neighbors_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  badge_type TEXT NOT NULL DEFAULT 'event_participant',
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(event_id, user_id, badge_type)
);

-- 7. Add RLS policies for new tables
ALTER TABLE user_content_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighbor_event_badges ENABLE ROW LEVEL SECURITY;

-- User content approvals policies
CREATE POLICY "Users can view their own content approvals"
ON user_content_approvals
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can submit content for approval"
ON user_content_approvals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Secretary can view all
CREATE POLICY "Secretaries can view all content approvals"
ON user_content_approvals
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM secretary_assignments WHERE secretary_id = auth.uid())
  OR auth.uid() IN (SELECT id FROM auth.users WHERE role = 'admin')
);

-- Secretaries can approve/reject
CREATE POLICY "Secretaries can update content approvals"
ON user_content_approvals
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM secretary_assignments WHERE secretary_id = auth.uid())
  OR auth.uid() IN (SELECT id FROM auth.users WHERE role = 'admin')
);

-- Business reports policies
CREATE POLICY "Anyone can create business reports"
ON business_reports
FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Public can view resolved business reports"
ON business_reports
FOR SELECT
USING (status IN ('resolved', 'dismissed'));

CREATE POLICY "Business owners can view reports for their businesses"
ON business_reports
FOR SELECT
USING (
  auth.uid() IN (SELECT owner_user_id FROM neighbors_businesses WHERE id = business_id)
);

CREATE POLICY "Secretaries can manage all business reports"
ON business_reports
FOR ALL
USING (
  EXISTS (SELECT 1 FROM secretary_assignments WHERE secretary_id = auth.uid())
  OR auth.uid() IN (SELECT id FROM auth.users WHERE role = 'admin')
);

-- Neighbor event badges policies
CREATE POLICY "Anyone can view event badges"
ON neighbor_event_badges
FOR SELECT
USING (true);

CREATE POLICY "System can award event badges"
ON neighbor_event_badges
FOR INSERT
WITH CHECK (true);

-- 8. Create function to check if business can post freely (established 1 month with no reports)
CREATE OR REPLACE FUNCTION can_business_post_freely(p_business_id UUID)
RETURNS BOOLEAN AS $
DECLARE
  v_business neighbors_businesses;
  v_months_active INTEGER;
  v_reports_count INTEGER;
BEGIN
  SELECT * INTO v_business FROM neighbors_businesses WHERE id = p_business_id;
  
  IF v_business IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if business is approved
  IF v_business.approval_status != 'approved' THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate months since establishment (or creation if established_at is null)
  SELECT EXTRACT(MONTH FROM NOW() - COALESCE(v_business.established_at, v_business.created_at))::INTEGER INTO v_months_active;
  
  -- Get reports count
  SELECT COUNT(*)::INTEGER INTO v_reports_count 
  FROM business_reports 
  WHERE business_id = p_business_id 
    AND status IN ('pending', 'investigated');
  
  -- Business can post freely if established for 1+ month with no pending/investigated reports
  RETURN v_months_active >= 1 AND v_reports_count = 0;
END;
$ LANGUAGE plpgsql STABLE;

-- Update the get_nearby_neighbors_events function to filter by approval
CREATE OR REPLACE FUNCTION get_nearby_neighbors_events(lat DOUBLE PRECISION, lng DOUBLE PRECISION, radius DOUBLE PRECISION)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  city TEXT,
  state TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  max_participants INTEGER,
  reward_coins INTEGER,
  created_by_user_id UUID,
  business_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  approval_status TEXT,
  distance DOUBLE PRECISION
) AS $
BEGIN
  RETURN QUERY
  SELECT
    ne.id,
    ne.title,
    ne.description,
    ne.category,
    ne.latitude,
    ne.longitude,
    ne.city,
    ne.state,
    ne.start_time,
    ne.end_time,
    ne.duration_minutes,
    ne.max_participants,
    ne.reward_coins,
    ne.created_by_user_id,
    ne.business_id,
    ne.status,
    ne.created_at,
    ne.approval_status,
    ST_Distance(
      ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')'),
      ST_GeographyFromText('POINT(' || ne.longitude || ' ' || ne.latitude || ')')
    ) / 1000 AS distance
  FROM neighbors_events ne
  WHERE
    ne.status = 'active'
    AND ne.approval_status = 'approved'
    AND ST_Distance(
      ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')'),
      ST_GeographyFromText('POINT(' || ne.longitude || ' ' || ne.latitude || ')')
    ) / 1000 <= radius;
END;
$ LANGUAGE plpgsql STABLE;

-- 9. Create function to approve/reject business
CREATE OR REPLACE FUNCTION approve_neighbor_business(
  p_business_id UUID,
  p_approved_by UUID,
  p_approved BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_approved THEN
    UPDATE neighbors_businesses
    SET 
      approval_status = 'approved',
      approved_at = NOW(),
      approved_by = p_approved_by,
      established_at = NOW(),
      verified = TRUE
    WHERE id = p_business_id;
  ELSE
    UPDATE neighbors_businesses
    SET 
      approval_status = 'rejected',
      rejected_at = NOW(),
      approved_by = p_approved_by,
      rejection_reason = p_rejection_reason
    WHERE id = p_business_id;
  END IF;
  
  RETURN p_approved;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 10. Create function to approve/reject event
CREATE OR REPLACE FUNCTION approve_neighbor_event(
  p_event_id UUID,
  p_approved_by UUID,
  p_approved BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_approved THEN
    UPDATE neighbors_events
    SET 
      approval_status = 'approved',
      approved_at = NOW(),
      approved_by = p_approved_by
    WHERE id = p_event_id;
  ELSE
    UPDATE neighbors_events
    SET 
      approval_status = 'rejected',
      rejected_at = NOW(),
      approved_by = p_approved_by,
      rejection_reason = p_rejection_reason
    WHERE id = p_event_id;
  END IF;
  
  RETURN p_approved;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 11. Create function to approve/reject job posting
CREATE OR REPLACE FUNCTION approve_neighbor_job(
  p_job_id UUID,
  p_approved_by UUID,
  p_approved BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_approved THEN
    UPDATE neighbors_hiring
    SET 
      approval_status = 'approved',
      approved_at = NOW(),
      approved_by = p_approved_by
    WHERE id = p_job_id;
  ELSE
    UPDATE neighbors_hiring
    SET 
      approval_status = 'rejected',
      rejected_at = NOW(),
      approved_by = p_approved_by,
      rejection_reason = p_rejection_reason
    WHERE id = p_job_id;
  END IF;
  
  RETURN p_approved;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 12. Create view for secretary to see all pending approvals
CREATE OR REPLACE VIEW secretary_pending_approvals AS
SELECT 
  'business' AS approval_type,
  id,
  business_name AS title,
  description,
  owner_user_id AS submitted_by,
  created_at AS submitted_at,
  approval_status
FROM neighbors_businesses
WHERE approval_status = 'pending'

UNION ALL

SELECT 
  'event' AS approval_type,
  id,
  title,
  description,
  created_by_user_id AS submitted_by,
  created_at AS submitted_at,
  approval_status
FROM neighbors_events
WHERE approval_status = 'pending'

UNION ALL

SELECT 
  'job' AS approval_type,
  id,
  title,
  description,
  owner_user_id AS submitted_by,
  created_at AS submitted_at,
  approval_status
FROM neighbors_hiring
WHERE approval_status = 'pending';

-- 13. Create function to award event participant badge
CREATE OR REPLACE FUNCTION award_neighbor_event_badge(
  p_event_id UUID,
  p_user_id UUID,
  p_badge_type TEXT DEFAULT 'event_participant'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if already awarded
  IF EXISTS (
    SELECT 1 FROM neighbor_event_badges 
    WHERE event_id = p_event_id 
      AND user_id = p_user_id 
      AND badge_type = p_badge_type
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Award the badge
  INSERT INTO neighbor_event_badges (event_id, user_id, badge_type)
  VALUES (p_event_id, p_user_id, p_badge_type)
  ON CONFLICT (event_id, user_id, badge_type) DO NOTHING;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 14. Grant necessary permissions
GRANT SELECT ON secretary_pending_approvals TO authenticated;
GRANT EXECUTE ON FUNCTION can_business_post_freely(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_neighbor_business(UUID, UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_neighbor_event(UUID, UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_neighbor_job(UUID, UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION award_neighbor_event_badge(UUID, UUID, TEXT) TO authenticated;

-- 15. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_neighbors_businesses_approval_status ON neighbors_businesses(approval_status);
CREATE INDEX IF NOT EXISTS idx_neighbors_events_approval_status ON neighbors_events(approval_status);
CREATE INDEX IF NOT EXISTS idx_neighbors_hiring_approval_status ON neighbors_hiring(approval_status);
CREATE INDEX IF NOT EXISTS idx_user_content_approvals_status ON user_content_approvals(status);
CREATE INDEX IF NOT EXISTS idx_business_reports_status ON business_reports(status);
CREATE INDEX IF NOT EXISTS idx_neighbor_event_badges_user ON neighbor_event_badges(user_id);

-- 16. Create function to award badges when user participates in neighbor event
CREATE OR REPLACE FUNCTION handle_neighbor_event_participation()
RETURNS TRIGGER AS $
DECLARE
  v_event_count INTEGER;
  v_badge_slug TEXT;
  v_badge_id UUID;
BEGIN
  -- Check if this is a new participation (INSERT) and status is 'joined'
  IF TG_OP = 'INSERT' AND NEW.status = 'joined' THEN
    -- Count total events this user has participated in
    SELECT COUNT(*) INTO v_event_count
    FROM neighbors_participants
    WHERE user_id = NEW.user_id AND status = 'joined';
    
    -- Determine which badge to award based on count
    IF v_event_count = 1 THEN
      v_badge_slug := 'neighbor_event_first';
    ELSIF v_event_count = 5 THEN
      v_badge_slug := 'neighbor_event_regular';
    ELSIF v_event_count = 10 THEN
      v_badge_slug := 'neighbor_event_devoted';
    ELSIF v_event_count = 25 THEN
      v_badge_slug := 'neighbor_event_legend';
    END IF;
    
    -- If we have a badge to award
    IF v_badge_slug IS NOT NULL THEN
      -- Get badge id from catalog
      SELECT id INTO v_badge_id FROM badge_catalog WHERE slug = v_badge_slug;
      
      IF v_badge_id IS NOT NULL THEN
        -- Award the badge using the existing badge system
        INSERT INTO user_badges (user_id, badge_id, earned_at)
        VALUES (NEW.user_id, v_badge_id, NOW())
        ON CONFLICT (user_id, badge_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql VOLATILE;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_award_neighbor_event_badge ON neighbors_participants;
CREATE TRIGGER trigger_award_neighbor_event_badge
AFTER INSERT ON neighbors_participants
FOR EACH ROW
EXECUTE FUNCTION handle_neighbor_event_participation();

-- 17. Grant execute permissions
GRANT EXECUTE ON FUNCTION handle_neighbor_event_participation() TO authenticated;
