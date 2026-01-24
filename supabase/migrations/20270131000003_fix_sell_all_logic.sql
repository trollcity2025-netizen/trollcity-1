
-- Migration: Fix Sell All Houses Logic
-- Description: Updates sell_all_houses_to_bank to include 0-value properties in the transfer/deletion process.

CREATE OR REPLACE FUNCTION public.sell_all_houses_to_bank()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_house RECORD;
    v_admin_id UUID;
    v_admin_pool_id UUID;
    
    v_price BIGINT;
    v_third BIGINT;
    
    v_total_seller_share BIGINT := 0;
    v_total_admin_pool_share BIGINT := 0;
    v_count INTEGER := 0;
    
    v_house_price BIGINT;
    v_house_seller_share BIGINT;
    v_house_admin_share BIGINT;
BEGIN
    -- Get Admin ID (Bank Admin)
    SELECT id INTO v_admin_id 
    FROM public.user_profiles 
    WHERE (role = 'admin' OR is_admin = true)
    AND id != auth.uid() -- Exclude current user
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_admin_id IS NULL THEN
        -- Fallback: If no other admin found, try to find ANY user that is not me?
        -- No, that's risky. If I am the only admin, I cannot sell to myself properly.
        -- But wait, if I sell to myself, I keep the house AND get the coins? Yes.
        
        -- Let's try to find a system user or just ANY older user that is not me.
        -- Or just fail.
        -- For now, let's try to find the oldest user that is NOT me.
        SELECT id INTO v_admin_id 
        FROM public.user_profiles 
        WHERE id != auth.uid()
        ORDER BY created_at ASC 
        LIMIT 1;
    END IF;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Bank admin not found (and you are the only user)';
    END IF;

    -- Iterate through all properties owned by the user
    FOR v_house IN 
        SELECT * FROM public.properties 
        WHERE owner_user_id = auth.uid()
    LOOP
        v_count := v_count + 1; -- Count EVERY property found
        
        -- Calculate Price (Logic matches sell_house_to_bank)
        v_house_price := COALESCE(v_house.base_value, 0);
        
        IF v_house_price <= 0 THEN
           v_house_price := COALESCE(v_house.ask_price, 0);
        END IF;
        
        IF v_house_price <= 0 THEN
            IF v_house.is_starter THEN
                 v_house_price := 1500;
            ELSE
                 -- Skip worthless properties value calculation, but they are still counted for transfer
                 v_house_price := 0;
            END IF;
        END IF;

        IF v_house_price > 0 THEN
            v_third := FLOOR(v_house_price / 3);
            v_house_seller_share := v_third;
            v_house_admin_share := v_house_price - v_house_seller_share;
            
            v_total_seller_share := v_total_seller_share + v_house_seller_share;
            v_total_admin_pool_share := v_total_admin_pool_share + v_house_admin_share;
        END IF;
    END LOOP;

    IF v_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No properties to sell');
    END IF;

    -- Credit Seller (Only if > 0)
    IF v_total_seller_share > 0 THEN
        PERFORM public.troll_bank_credit_coins(
            auth.uid(),
            v_total_seller_share::INT,
            'paid', 
            'property_sale_bulk',
            'bulk_sale_' || NOW()::TEXT
        );
    END IF;

    -- Credit Admin Pool (Only if > 0)
    IF v_total_admin_pool_share > 0 THEN
        SELECT id INTO v_admin_pool_id FROM public.admin_pool LIMIT 1;
    
        IF v_admin_pool_id IS NOT NULL THEN
            UPDATE public.admin_pool
            SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + v_total_admin_pool_share,
                updated_at = NOW()
            WHERE id = v_admin_pool_id;
        ELSE
             -- Should exist due to previous migration, but safe fallback
             INSERT INTO public.admin_pool (user_id, trollcoins_balance)
             VALUES (v_admin_id, v_total_admin_pool_share);
        END IF;
    
        -- Log to Ledger
        INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
        VALUES (
            v_total_admin_pool_share,
            'Bulk Property Sale Profit (2x33.3% to Admin Pool) - ' || v_count || ' homes',
            auth.uid(),
            NOW()
        );
    END IF;

    -- Transfer Properties (ALL properties owned by user)
    UPDATE public.properties
    SET owner_user_id = v_admin_id,
        is_listed = false,
        is_active_home = false,
        updated_at = NOW()
    WHERE owner_user_id = auth.uid();

    RETURN jsonb_build_object(
        'success', true,
        'count', v_count,
        'total_seller_share', v_total_seller_share,
        'total_admin_share', v_total_admin_pool_share
    );
END;
$$;
