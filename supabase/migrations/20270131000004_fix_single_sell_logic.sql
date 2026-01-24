
-- Migration: Fix Single Sell House Logic (Prevent Self-Dealing)
-- Description: Updates sell_house_to_bank to prevent admins from selling to themselves and keeping the property.

CREATE OR REPLACE FUNCTION public.sell_house_to_bank(
    house_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_house RECORD;
    v_seller_id UUID;
    v_admin_id UUID;
    v_price BIGINT;
    v_third BIGINT;
    v_seller_share BIGINT;
    v_admin_pool_share_1 BIGINT;
    v_admin_pool_share_2 BIGINT;
    v_admin_pool_total BIGINT;
    v_admin_pool_id UUID;
BEGIN
    -- Get House Details
    SELECT * INTO v_house FROM public.properties WHERE id = house_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    v_seller_id := v_house.owner_user_id;
    
    IF v_seller_id <> auth.uid() THEN
        RAISE EXCEPTION 'You do not own this property';
    END IF;

    -- Get Admin ID (Bank Admin) - Exclude current user
    SELECT id INTO v_admin_id 
    FROM public.user_profiles 
    WHERE (role = 'admin' OR is_admin = true)
    AND id != auth.uid()
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_admin_id IS NULL THEN
         -- Fallback: Try to find ANY other user (oldest non-me user) to act as bank holder
         SELECT id INTO v_admin_id 
         FROM public.user_profiles 
         WHERE id != auth.uid()
         ORDER BY created_at ASC 
         LIMIT 1;
    END IF;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Bank admin/user not found (cannot sell to yourself)';
    END IF;

    -- Calculate Values
    v_price := COALESCE(v_house.base_value, 0);
    
    IF v_price <= 0 THEN
       v_price := COALESCE(v_house.ask_price, 0);
    END IF;
    
    IF v_price <= 0 THEN
        IF v_house.is_starter THEN
             v_price := 1500;
        ELSE
             RAISE EXCEPTION 'Property has no value';
        END IF;
    END IF;

    v_third := FLOOR(v_price / 3);
    v_seller_share := v_third;
    v_admin_pool_share_1 := v_third;
    v_admin_pool_share_2 := v_price - v_seller_share - v_admin_pool_share_1;
    v_admin_pool_total := v_admin_pool_share_1 + v_admin_pool_share_2;

    -- Pay Seller (1/3)
    PERFORM public.troll_bank_credit_coins(
        v_seller_id,
        v_seller_share::INT,
        'paid', 
        'property_sale_seller',
        house_id::TEXT
    );

    -- Ensure Admin Pool Exists
    SELECT id INTO v_admin_pool_id FROM public.admin_pool LIMIT 1;

    IF v_admin_pool_id IS NULL THEN
        -- Create pool owned by the bank admin
        INSERT INTO public.admin_pool (user_id, trollcoins_balance)
        VALUES (v_admin_id, 0)
        RETURNING id INTO v_admin_pool_id;
    END IF;

    -- Update Admin Pool (2/3)
    UPDATE public.admin_pool
    SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + v_admin_pool_total,
        updated_at = NOW()
    WHERE id = v_admin_pool_id;

    -- Log to Ledger
    INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
    VALUES (
        v_admin_pool_total,
        'Property Sale Profit (2x33.3% to Admin Pool) - House ' || house_id,
        v_seller_id,
        NOW()
    );

    -- Transfer Property
    UPDATE public.properties
    SET owner_user_id = v_admin_id,
        is_listed = false,
        is_active_home = false,
        updated_at = NOW()
    WHERE id = house_id;

    RETURN jsonb_build_object(
        'success', true,
        'seller_share', v_seller_share,
        'admin_pool_share_1', v_admin_pool_share_1,
        'admin_pool_share_2', v_admin_pool_share_2
    );
END;
$$;
