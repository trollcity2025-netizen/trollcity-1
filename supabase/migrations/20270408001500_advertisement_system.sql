-- Advertisement System for Troll City
-- Users can submit ads for 1000 troll coins, last 7 days, admin approval required

CREATE TABLE IF NOT EXISTS public.user_advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, denied, expired
    cost_paid BIGINT NOT NULL DEFAULT 1000,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    denied_at TIMESTAMP WITH TIME ZONE,
    denied_reason TEXT,
    approved_by UUID REFERENCES public.user_profiles(id),
    clicks_count INTEGER DEFAULT 0,
    impressions_count INTEGER DEFAULT 0,
    placement TEXT NOT NULL DEFAULT 'any' -- any, sidebar, banner
);

-- RLS Policies
ALTER TABLE public.user_advertisements ENABLE ROW LEVEL SECURITY;

-- Users can view their own ads
CREATE POLICY "Users can view their own advertisements" ON public.user_advertisements
    FOR SELECT USING (user_id = auth.uid());

-- Users can create ads
CREATE POLICY "Users can submit advertisements" ON public.user_advertisements
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins can view all ads
CREATE POLICY "Admins can view all advertisements" ON public.user_advertisements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND (role IN ('admin', 'secretary', 'lead_troll_officer') OR is_admin = true)
        )
    );

-- Admins can update ads (approve/deny)
CREATE POLICY "Admins can manage advertisements" ON public.user_advertisements
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND (role IN ('admin', 'secretary', 'lead_troll_officer') OR is_admin = true)
        )
    );

-- Everyone can view approved active ads
CREATE POLICY "Everyone can view approved active advertisements" ON public.user_advertisements
    FOR SELECT USING (status = 'approved' AND expires_at > NOW());

-- Function to approve ad and set expiry date
CREATE OR REPLACE FUNCTION public.approve_advertisement(
    p_ad_id UUID,
    p_placement TEXT DEFAULT 'any'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    SELECT (role IN ('admin', 'secretary', 'lead_troll_officer') OR is_admin = true)
    INTO v_is_admin
    FROM public.user_profiles
    WHERE id = auth.uid();

    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'message', 'Permission denied');
    END IF;

    UPDATE public.user_advertisements
    SET 
        status = 'approved',
        approved_at = NOW(),
        approved_by = auth.uid(),
        expires_at = NOW() + INTERVAL '7 days',
        placement = p_placement,
        updated_at = NOW()
    WHERE id = p_ad_id;

    RETURN jsonb_build_object('success', true, 'message', 'Advertisement approved successfully');
END;
$$;

-- Function to deny ad
CREATE OR REPLACE FUNCTION public.deny_advertisement(
    p_ad_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    SELECT (role IN ('admin', 'secretary', 'lead_troll_officer') OR is_admin = true)
    INTO v_is_admin
    FROM public.user_profiles
    WHERE id = auth.uid();

    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'message', 'Permission denied');
    END IF;

    UPDATE public.user_advertisements
    SET 
        status = 'denied',
        denied_at = NOW(),
        denied_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_ad_id;

    RETURN jsonb_build_object('success', true, 'message', 'Advertisement denied');
END;
$$;

-- Function to submit new ad (deducts coins automatically)
CREATE OR REPLACE FUNCTION public.submit_advertisement(
    p_title TEXT,
    p_subtitle TEXT,
    p_description TEXT,
    p_image_url TEXT,
    p_link_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_balance BIGINT;
    v_ad_id UUID;
BEGIN
    -- Check user balance
    SELECT troll_coins INTO v_user_balance
    FROM public.user_profiles
    WHERE id = auth.uid();

    IF v_user_balance < 1000 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins. Ads cost 1000 Troll Coins.');
    END IF;

    -- Deduct coins
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - 1000
    WHERE id = auth.uid();

    -- Create ad record
    INSERT INTO public.user_advertisements (
        user_id, title, subtitle, description, image_url, link_url, cost_paid
    ) VALUES (
        auth.uid(), p_title, p_subtitle, p_description, p_image_url, p_link_url, 1000
    ) RETURNING id INTO v_ad_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Advertisement submitted successfully and pending approval',
        'ad_id', v_ad_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_advertisement(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_advertisement(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deny_advertisement(UUID, TEXT) TO authenticated;
