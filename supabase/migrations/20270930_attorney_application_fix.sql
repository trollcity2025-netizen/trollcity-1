-- ============================================================================
-- ATTORNEY APPLICATION SUBMIT FUNCTION FIX
-- Updated to accept full application data, bypassing RLS
-- ============================================================================

DROP FUNCTION IF EXISTS public.submit_attorney_application_full(JSONB);
CREATE OR REPLACE FUNCTION public.submit_attorney_application_full(
  p_application_data JSONB
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_attorney_fee INTEGER;
  v_is_pro_bono BOOLEAN;
  v_existing_app RECORD;
  v_app_id UUID;
BEGIN
  -- Extract fields from JSON
  v_user_id := p_application_data->>'user_id';
  v_attorney_fee := (p_application_data->>'attorney_fee')::INTEGER;
  v_is_pro_bono := (p_application_data->>'is_pro_bono')::BOOLEAN;

  RAISE NOTICE 'Submitting ATTORNEY application for user_id: %', v_user_id;

  -- Check if user already has a pending application
  SELECT id INTO v_existing_app 
  FROM attorney_applications 
  WHERE user_id = v_user_id AND status = 'pending';

  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'You already have a pending attorney application');
  END IF;

  -- Check if user is already an attorney
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id AND is_attorney = true) THEN
    RETURN json_build_object('success', false, 'error', 'You are already an attorney');
  END IF;

  -- Insert the application with full data into ATTORNEY table
  RAISE NOTICE 'Inserting into attorney_applications table';
  INSERT INTO attorney_applications (user_id, attorney_fee, is_pro_bono, status, data)
  VALUES (v_user_id, v_attorney_fee, v_is_pro_bono, 'pending', p_application_data->'data')
  RETURNING id INTO v_app_id;

  RAISE NOTICE 'Attorney application inserted with id: %', v_app_id;

  RETURN json_build_object('success', true, 'message', 'Attorney application submitted successfully', 'app_id', v_app_id);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in submit_attorney_application_full: %', SQLERRM;
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT ALL ON FUNCTION public.submit_attorney_application_full(JSONB) TO authenticated;