-- Seller Appeal System for Denied Applications

-- 1. Add appeal fields to applications table
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS appeal_requested boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS appeal_reason text,
ADD COLUMN IF NOT EXISTS appeal_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS appeal_reviewed_by uuid REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS appeal_reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS appeal_status text CHECK (appeal_status IN ('pending', 'approved', 'denied')),
ADD COLUMN IF NOT EXISTS appeal_notes text;

-- 2. Function to submit appeal for denied seller application
CREATE OR REPLACE FUNCTION submit_seller_appeal(
  p_application_id uuid,
  p_appeal_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application RECORD;
  v_days_since_denial integer;
BEGIN
  -- Get application details
  SELECT * INTO v_application
  FROM applications
  WHERE id = p_application_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_application.type != 'seller' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only seller applications can be appealed');
  END IF;

  IF v_application.status != 'denied' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only denied applications can be appealed');
  END IF;

  IF v_application.appeal_requested THEN
    RETURN jsonb_build_object('success', false, 'error', 'Appeal already submitted');
  END IF;

  -- Check if within 7 days of denial
  SELECT EXTRACT(EPOCH FROM (now() - v_application.updated_at)) / 86400 INTO v_days_since_denial;

  IF v_days_since_denial > 7 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Appeal must be submitted within 7 days of denial');
  END IF;

  -- Submit appeal
  UPDATE applications
  SET appeal_requested = true,
      appeal_reason = p_appeal_reason,
      appeal_requested_at = now(),
      appeal_status = 'pending',
      updated_at = now()
  WHERE id = p_application_id;

  -- Create notification for admins
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  )
  SELECT
    up.id,
    'seller_appeal_submitted',
    'Seller Appeal Submitted',
    'A seller has submitted an appeal for their denied application',
    jsonb_build_object('application_id', p_application_id, 'appeal_reason', p_appeal_reason)
  FROM user_profiles up
  WHERE up.role IN ('admin', 'officer');

  RETURN jsonb_build_object('success', true, 'message', 'Appeal submitted successfully');
END;
$$;

-- 3. Function for admins to review seller appeals
CREATE OR REPLACE FUNCTION review_seller_appeal(
  p_application_id uuid,
  p_action text, -- 'approve' or 'deny'
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application RECORD;
  v_admin_check boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'officer')
  ) INTO v_admin_check;

  IF NOT v_admin_check THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can review appeals');
  END IF;

  -- Get application details
  SELECT * INTO v_application
  FROM applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF NOT v_application.appeal_requested OR v_application.appeal_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending appeal for this application');
  END IF;

  -- Update appeal status
  UPDATE applications
  SET appeal_status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'denied' END,
      appeal_reviewed_by = auth.uid(),
      appeal_reviewed_at = now(),
      appeal_notes = p_notes,
      updated_at = now()
  WHERE id = p_application_id;

  -- If appeal is approved, approve the original application
  IF p_action = 'approve' THEN
    -- Update application status
    UPDATE applications
    SET status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_application_id;

    -- Grant seller permissions
    UPDATE user_profiles
    SET seller_verified = true,
        updated_at = now()
    WHERE id = v_application.user_id;

    -- Auto-create store
    INSERT INTO stores (owner_id, name, description)
    VALUES (
      v_application.user_id,
      COALESCE(v_application.data->>'store_name', v_application.data->>'storeName', 'Seller Store'),
      COALESCE(v_application.data->>'store_description', v_application.data->>'storeDescription', 'A seller store')
    );

    -- Create notification for user
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      v_application.user_id,
      'seller_appeal_approved',
      'Seller Application Approved',
      'Your seller application appeal has been approved! You can now create and manage your store.',
      jsonb_build_object('application_id', p_application_id)
    );
  ELSE
    -- Create notification for denied appeal
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      v_application.user_id,
      'seller_appeal_denied',
      'Seller Appeal Denied',
      'Your seller application appeal has been denied. ' || COALESCE(p_notes, ''),
      jsonb_build_object('application_id', p_application_id, 'notes', p_notes)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'action', p_action, 'notes', p_notes);
END;
$$;

-- 4. View for pending seller appeals (for admin dashboard)
CREATE OR REPLACE VIEW seller_appeals_queue AS
SELECT
  a.*,
  up.username,
  up.email,
  EXTRACT(EPOCH FROM (now() - a.appeal_requested_at)) / 86400 as days_since_appeal
FROM applications a
LEFT JOIN user_profiles up ON a.user_id = up.id
WHERE a.type = 'seller'
  AND a.appeal_requested = true
  AND a.appeal_status = 'pending'
ORDER BY a.appeal_requested_at ASC;

-- Grant permissions
GRANT EXECUTE ON FUNCTION submit_seller_appeal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION review_seller_appeal(uuid, text, text) TO authenticated;

-- Add comments
COMMENT ON FUNCTION submit_seller_appeal IS 'Allows users to submit appeals for denied seller applications within 7 days';
COMMENT ON FUNCTION review_seller_appeal IS 'Allows admins to approve or deny seller appeals';
COMMENT ON VIEW seller_appeals_queue IS 'Shows pending seller appeals for admin review';