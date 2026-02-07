-- Create stream_bans table if not exists
CREATE TABLE IF NOT EXISTS public.stream_bans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT,
    banned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Null for permaban, timestamp for kick/tempban
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.stream_bans ENABLE ROW LEVEL SECURITY;

-- Policies for stream_bans
CREATE POLICY "Stream bans are viewable by everyone" 
ON public.stream_bans FOR SELECT 
USING (true);

CREATE POLICY "Hosts and mods can insert bans" 
ON public.stream_bans FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.streams 
        WHERE id = stream_bans.stream_id 
        AND (user_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM public.user_profiles WHERE role IN ('admin', 'moderator', 'troll_officer')))
    )
);

CREATE POLICY "Hosts and mods can delete bans" 
ON public.stream_bans FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.streams 
        WHERE id = stream_bans.stream_id 
        AND (user_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM public.user_profiles WHERE role IN ('admin', 'moderator', 'troll_officer')))
    )
);

-- Fix End Stream RPC
CREATE OR REPLACE FUNCTION public.end_stream(p_stream_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    -- Check if user is admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = v_user_id AND (role IN ('admin', 'superadmin') OR is_admin = true)
    ) INTO v_is_admin;

    -- Update stream if owner or admin
    UPDATE public.streams
    SET 
        status = 'ended',
        is_live = false,
        ended_at = NOW()
    WHERE 
        id = p_stream_id 
        AND (user_id = v_user_id OR v_is_admin = true);

    IF FOUND THEN
        RETURN QUERY SELECT true, 'Stream ended successfully'::TEXT;
    ELSE
        RETURN QUERY SELECT false, 'Permission denied or stream not found'::TEXT;
    END IF;
END;
$$;

-- Fix Visuals: Ensure user_perks are viewable
CREATE POLICY "User perks are viewable by everyone" 
ON public.user_perks FOR SELECT 
USING (true);

-- Fix Visuals: Purchase/Toggle RGB RPC
CREATE OR REPLACE FUNCTION public.purchase_rgb_broadcast(p_stream_id UUID, p_enable BOOLEAN)
RETURNS TABLE (success BOOLEAN, message TEXT, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_stream_owner UUID;
    v_has_purchased BOOLEAN;
    v_price CONSTANT INTEGER := 10;
BEGIN
    v_user_id := auth.uid();
    
    -- Check stream ownership
    SELECT user_id, rgb_purchased INTO v_stream_owner, v_has_purchased
    FROM public.streams WHERE id = p_stream_id;
    
    IF v_stream_owner IS NULL THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Stream not found'::TEXT;
        RETURN;
    END IF;
    
    IF v_stream_owner != v_user_id THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Not stream owner'::TEXT;
        RETURN;
    END IF;

    -- If enabling
    IF p_enable THEN
        -- Check if already purchased
        IF v_has_purchased THEN
            UPDATE public.streams SET has_rgb_effect = true WHERE id = p_stream_id;
            RETURN QUERY SELECT true, 'RGB Enabled'::TEXT, NULL::TEXT;
        ELSE
            -- Try to charge
            IF (SELECT troll_coins FROM public.user_profiles WHERE user_id = v_user_id) >= v_price THEN
                -- Deduct coins
                UPDATE public.user_profiles 
                SET troll_coins = troll_coins - v_price 
                WHERE user_id = v_user_id;
                
                -- Mark purchased and enabled
                UPDATE public.streams 
                SET rgb_purchased = true, has_rgb_effect = true 
                WHERE id = p_stream_id;
                
                RETURN QUERY SELECT true, 'Purchased and Enabled'::TEXT, NULL::TEXT;
            ELSE
                RETURN QUERY SELECT false, NULL::TEXT, 'Insufficient funds (10 Coins required)'::TEXT;
            END IF;
        END IF;
    ELSE
        -- Disabling
        UPDATE public.streams SET has_rgb_effect = false WHERE id = p_stream_id;
        RETURN QUERY SELECT true, 'RGB Disabled'::TEXT, NULL::TEXT;
    END IF;
END;
$$;
