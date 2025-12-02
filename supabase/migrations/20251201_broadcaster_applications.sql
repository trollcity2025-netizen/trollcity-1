-- Broadcaster Applications System
-- This migration creates the broadcaster_applications table and related functions

-- Create broadcaster_applications table
CREATE TABLE IF NOT EXISTS public.broadcaster_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT,
  date_of_birth DATE,
  address TEXT,
  ssn_last_four TEXT, -- Last 4 digits only for verification
  ssn_verified BOOLEAN DEFAULT false,
  id_verification_submitted BOOLEAN DEFAULT false,
  id_verification_url TEXT, -- Link to uploaded ID document
  tax_form_submitted BOOLEAN DEFAULT false,
  tax_form_url TEXT, -- Link to uploaded tax form
  bank_account_last_four TEXT, -- Last 4 digits only
  bank_routing_number TEXT, -- Masked
  bank_account_verified BOOLEAN DEFAULT false,
  ein TEXT, -- Employer Identification Number (for business)
  is_business BOOLEAN DEFAULT false,
  application_status TEXT DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.broadcaster_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view own broadcaster applications"
ON public.broadcaster_applications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own applications
CREATE POLICY "Users can create broadcaster applications"
ON public.broadcaster_applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending applications
CREATE POLICY "Users can update own pending applications"
ON public.broadcaster_applications
FOR UPDATE
USING (auth.uid() = user_id AND application_status = 'pending');

-- Admins can view all applications
CREATE POLICY "Admins can view all broadcaster applications"
ON public.broadcaster_applications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Admins can update all applications
CREATE POLICY "Admins can update all broadcaster applications"
ON public.broadcaster_applications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_broadcaster_applications_user_id ON public.broadcaster_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcaster_applications_status ON public.broadcaster_applications(application_status);
CREATE INDEX IF NOT EXISTS idx_broadcaster_applications_created_at ON public.broadcaster_applications(created_at DESC);

-- Function to approve broadcaster application
CREATE OR REPLACE FUNCTION approve_broadcaster(
  p_application_id UUID,
  p_reviewer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user_id from application
  SELECT user_id INTO v_user_id
  FROM broadcaster_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  -- Mark application approved
  UPDATE broadcaster_applications
  SET 
    application_status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = p_reviewer_id,
    updated_at = NOW()
  WHERE id = p_application_id;

  -- Grant user broadcaster status
  UPDATE user_profiles
  SET is_broadcaster = true, updated_at = NOW()
  WHERE id = v_user_id;

  -- Notify user (using message field if available, otherwise title)
  INSERT INTO notifications (user_id, message, type, read)
  VALUES (v_user_id, '🎉 Your broadcaster application has been approved! You can now Go Live.', 'success', false);

  RETURN jsonb_build_object('success', true, 'message', 'Broadcaster approved successfully!');
END;
$$;

-- Keep old function name for backward compatibility
CREATE OR REPLACE FUNCTION approve_broadcaster_application(
  p_application_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN approve_broadcaster(p_application_id, p_admin_id)::json;
END;
$$;

-- Function to reject broadcaster application
CREATE OR REPLACE FUNCTION reject_broadcaster_application(
  p_application_id UUID,
  p_admin_id UUID,
  p_rejection_reason TEXT,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_application RECORD;
BEGIN
  -- Get the application
  SELECT * INTO v_application
  FROM public.broadcaster_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_application.application_status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Application is not pending');
  END IF;

  -- Update application status
  UPDATE public.broadcaster_applications
  SET 
    application_status = 'rejected',
    reviewed_by = p_admin_id,
    reviewed_at = NOW(),
    rejection_reason = p_rejection_reason,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    updated_at = NOW()
  WHERE id = p_application_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Application rejected successfully'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION approve_broadcaster_application(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_broadcaster_application(UUID, UUID, TEXT, TEXT) TO authenticated;

-- Add is_broadcaster column to user_profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_broadcaster'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN is_broadcaster BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_broadcaster_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcaster_applications_updated_at
BEFORE UPDATE ON public.broadcaster_applications
FOR EACH ROW
EXECUTE FUNCTION update_broadcaster_applications_updated_at();

