-- Ensure agreement version tracking exists
ALTER TABLE public.user_agreements
ADD COLUMN IF NOT EXISTS agreement_version text DEFAULT '1.0';

-- Record agreement acceptance and set profile flag
CREATE OR REPLACE FUNCTION public.record_agreement_acceptance(
  p_user_id uuid,
  p_agreement_version text DEFAULT '1.0',
  p_ip_address text DEFAULT null,
  p_user_agent text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agreement_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.user_agreements (
    id,
    user_id,
    agreement_version,
    agreed_at,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    v_agreement_id,
    p_user_id,
    COALESCE(p_agreement_version, '1.0'),
    now(),
    p_ip_address,
    p_user_agent,
    now()
  );

  UPDATE public.user_profiles
  SET terms_accepted = true,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN v_agreement_id;
END;
$$;

-- Check agreement acceptance for a given version
CREATE OR REPLACE FUNCTION public.has_accepted_agreement(
  p_user_id uuid,
  p_agreement_version text DEFAULT '1.0'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_agreements
    WHERE user_id = p_user_id
      AND agreement_version = COALESCE(p_agreement_version, '1.0')
  );
$$;

GRANT EXECUTE ON FUNCTION public.record_agreement_acceptance(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_accepted_agreement(uuid, text) TO authenticated;
