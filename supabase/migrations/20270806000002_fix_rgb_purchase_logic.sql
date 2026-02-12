-- Fix purchase_rgb_broadcast logic to prevent double charging
-- Previous version in 20270801000000_comprehensive_fixes.sql deducted coins every time p_enable was true, ignoring prior purchases.

DROP FUNCTION IF EXISTS public.purchase_rgb_broadcast(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.purchase_rgb_broadcast(
    p_stream_id UUID,
    p_enable BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cost INTEGER := 500;
    v_user_id UUID;
    v_balance INTEGER;
    v_stream RECORD;
BEGIN
    v_user_id := auth.uid();
    
    -- Get stream details
    SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stream not found');
    END IF;

    -- Verify ownership
    IF v_stream.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;

    IF p_enable THEN
        -- Only charge if NOT already purchased
        IF NOT COALESCE(v_stream.rgb_purchased, false) THEN
            -- Check Balance
            SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
            
            IF v_balance < v_cost THEN
                RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
            END IF;

            -- Deduct Coins
            UPDATE public.user_profiles
            SET troll_coins = troll_coins - v_cost
            WHERE id = v_user_id;
            
            -- Mark as purchased
            UPDATE public.streams
            SET rgb_purchased = true
            WHERE id = p_stream_id;
        END IF;

        -- Enable effect
        UPDATE public.streams
        SET has_rgb_effect = true
        WHERE id = p_stream_id;
        
        RETURN jsonb_build_object('success', true, 'message', CASE WHEN v_stream.rgb_purchased THEN 'RGB Enabled' ELSE 'Purchased and Enabled' END);
    ELSE
        -- Disable effect
        UPDATE public.streams
        SET has_rgb_effect = false
        WHERE id = p_stream_id;
        
        RETURN jsonb_build_object('success', true, 'message', 'RGB Disabled');
    END IF;
END;
$$;
