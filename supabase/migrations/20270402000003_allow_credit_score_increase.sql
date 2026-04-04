-- Allow users to increase their own credit_score (not decrease it)
-- Allow authenticated users to update credit_used, credit_score for themselves
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Check restricted fields - ALLOW users to update their own credit_used and credit_score increase
    IF (NEW.banned_at IS DISTINCT FROM OLD.banned_at OR
       NEW.suspended_until IS DISTINCT FROM OLD.suspended_until OR
       NEW.clocked_in IS DISTINCT FROM OLD.clocked_in OR
       NEW.clocked_in_at IS DISTINCT FROM OLD.clocked_in_at OR
       NEW.staff_override_until IS DISTINCT FROM OLD.staff_override_until OR
       NEW.admin_override_until IS DISTINCT FROM OLD.admin_override_until OR
       NEW.marketplace_approved IS DISTINCT FROM OLD.marketplace_approved)
       AND NOT (auth.uid() = '8dff9f37-21b5-4b8e-adc2-b9286874be1a'::uuid) THEN
         RAISE EXCEPTION 'You are not authorized to modify restricted profile fields.';
    END IF;
    
    -- Also allow credit_score decrease by admin
    -- Note: When called via SECURITY DEFINER functions (like pay_credit_card),
    -- auth.uid() returns the function owner (admin), so we check if the user
    -- is updating their own profile (NEW.id) OR if it's the admin
    IF NEW.credit_score < OLD.credit_score 
       AND auth.uid() <> '8dff9f37-21b5-4b8e-adc2-b9286874be1a'::uuid
       AND auth.uid() <> NEW.id THEN
         RAISE EXCEPTION 'You are not authorized to modify restricted profile fields.';
    END IF;
    
    -- Allow users to increase their own credit_score (via SECURITY DEFINER functions)
    -- When a user calls pay_credit_card, it runs as admin (SECURITY DEFINER),
    -- but we want to allow credit_score increases for the user's own profile
    IF NEW.credit_score > OLD.credit_score 
       AND NEW.id <> '8dff9f37-21b5-4b8e-adc2-b9286874be1a'::uuid THEN
         -- This is a credit score increase for a non-admin user, which is allowed
         -- (typically via pay_credit_card function)
         RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.user_profiles;
CREATE TRIGGER tr_protect_profile_fields
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_fields();