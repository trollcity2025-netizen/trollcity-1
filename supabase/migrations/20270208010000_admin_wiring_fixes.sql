-- Migration: Admin Wiring Fixes
-- 1. Create admin_end_shift RPC for OfficerShiftsPanel
-- 2. Create view_admin_creator_tax_status for EarningsTaxOverview

-- 1. admin_end_shift
DROP FUNCTION IF EXISTS public.admin_end_shift(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_end_shift(
    p_shift_id uuid,
    p_reason text DEFAULT 'Admin ended shift'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_check boolean;
BEGIN
    -- Verify admin status directly
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true)
    ) INTO v_admin_check;

    IF NOT v_admin_check THEN
        RAISE EXCEPTION 'Only admins can end shifts manually';
    END IF;

    UPDATE public.officer_work_sessions
    SET 
        clock_out = now(),
        status = 'completed',
        auto_clocked_out = false
    WHERE id = p_shift_id
    AND clock_out IS NULL;
END;
$$;

-- 2. view_admin_creator_tax_status
-- Returns earnings grouped by user and year for tax reporting
CREATE OR REPLACE VIEW public.view_admin_creator_tax_status WITH (security_invoker = true) AS
SELECT 
    be.broadcaster_id as user_id,
    date_part('year', be.created_at) as tax_year,
    up.username,
    up.email,
    COALESCE(SUM(be.usd_value), 0) as total_earnings_usd,
    (COALESCE(SUM(be.usd_value), 0) >= 600) as is_irs_threshold_met,
    -- up.tax_form_url IS NOT NULL as has_tax_form,
    -- up.w9_status,
    CASE 
        -- WHEN up.tax_form_url IS NOT NULL THEN 'Submitted'
        WHEN COALESCE(SUM(be.usd_value), 0) >= 600 THEN 'Required'
        ELSE 'Not Required'
    END as document_status,
    MAX(be.created_at) as last_earning_date
FROM public.broadcaster_earnings be
LEFT JOIN public.user_profiles up ON be.broadcaster_id = up.id
GROUP BY be.broadcaster_id, date_part('year', be.created_at), up.username, up.email;
