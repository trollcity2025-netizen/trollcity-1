-- 0. Fix Foreign Key on vehicle_transactions to allow deletion of vehicles
-- We change it to SET NULL so we keep the transaction history but lose the link to the deleted car
DO $$
BEGIN
    -- Check if the constraint exists and is not ON DELETE SET NULL/CASCADE (hard to check directly, so we just recreate it)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'vehicle_transactions_user_vehicle_id_fkey' 
        AND table_name = 'vehicle_transactions'
    ) THEN
        ALTER TABLE public.vehicle_transactions 
        DROP CONSTRAINT vehicle_transactions_user_vehicle_id_fkey;
        
        ALTER TABLE public.vehicle_transactions
        ADD CONSTRAINT vehicle_transactions_user_vehicle_id_fkey
        FOREIGN KEY (user_vehicle_id)
        REFERENCES public.user_vehicles(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 1. Ensure 'mods' column exists on user_vehicles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_vehicles' 
        AND column_name = 'mods'
    ) THEN
        ALTER TABLE public.user_vehicles ADD COLUMN mods JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Sell Vehicle RPC
CREATE OR REPLACE FUNCTION public.sell_vehicle(p_user_vehicle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_vehicle RECORD;
    v_catalog RECORD;
    v_sell_price INTEGER;
BEGIN
    v_user_id := auth.uid();
    
    -- Check authentication
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Get vehicle and verify ownership
    SELECT * INTO v_vehicle FROM public.user_vehicles 
    WHERE id = p_user_vehicle_id AND user_id = v_user_id;
    
    IF v_vehicle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found or not owned by you');
    END IF;

    -- Get catalog details for pricing
    SELECT * INTO v_catalog FROM public.vehicles_catalog WHERE id = v_vehicle.catalog_id;
    
    -- Calculate sell price (50% of base price)
    v_sell_price := FLOOR(v_catalog.price * 0.5);

    -- 1. Delete vehicle (Cascades to titles, registrations, insurance due to FK constraints)
    -- vehicle_transactions will set user_vehicle_id to NULL due to the fix above
    DELETE FROM public.user_vehicles WHERE id = p_user_vehicle_id;

    -- 2. Add Coins
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins + v_sell_price 
    WHERE id = v_user_id;

    -- 3. Log Transaction
    INSERT INTO public.vehicle_transactions (user_id, type, amount, details)
    VALUES (
        v_user_id, 
        'sale', 
        v_sell_price, 
        jsonb_build_object(
            'vehicle_id', p_user_vehicle_id,
            'catalog_id', v_vehicle.catalog_id,
            'car_name', v_catalog.name,
            'reason', 'User sold to dealer'
        )
    );

    -- 4. Coin Transaction Log
    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (
        v_user_id, 
        v_sell_price, 
        'sale', 
        'Sold ' || v_catalog.name || ' to KTAuto'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Vehicle sold for ' || v_sell_price || ' coins',
        'amount', v_sell_price
    );
END;
$$;

-- 3. Upgrade Vehicle RPC
CREATE OR REPLACE FUNCTION public.upgrade_vehicle(
    p_user_vehicle_id UUID, 
    p_upgrade_type TEXT -- 'engine', 'armor', 'rims', 'brakes', 'suspension'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_vehicle RECORD;
    v_catalog RECORD;
    v_cost INTEGER;
    v_current_level INTEGER;
    v_new_mods JSONB;
    v_user_balance BIGINT;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Get vehicle
    SELECT * INTO v_vehicle FROM public.user_vehicles 
    WHERE id = p_user_vehicle_id AND user_id = v_user_id;
    
    IF v_vehicle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found');
    END IF;

    -- Get catalog for pricing base
    SELECT * INTO v_catalog FROM public.vehicles_catalog WHERE id = v_vehicle.catalog_id;

    -- Get current level from mods JSONB
    v_current_level := COALESCE((v_vehicle.mods->>p_upgrade_type)::INTEGER, 0);

    IF v_current_level >= 3 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Max level reached for this upgrade');
    END IF;

    -- Determine cost (10% of base price * next level, min 1000)
    -- Level 1 cost: 10%
    -- Level 2 cost: 20%
    -- Level 3 cost: 30%
    v_cost := GREATEST(FLOOR(v_catalog.price * 0.1), 1000) * (v_current_level + 1);

    -- Check balance
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id;
    
    IF v_user_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds: ' || v_cost || ' required');
    END IF;

    -- Deduct coins
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - v_cost 
    WHERE id = v_user_id;

    -- Update mods
    v_new_mods := jsonb_set(
        COALESCE(v_vehicle.mods, '{}'::jsonb), 
        ARRAY[p_upgrade_type], 
        to_jsonb(v_current_level + 1)
    );

    UPDATE public.user_vehicles
    SET mods = v_new_mods
    WHERE id = p_user_vehicle_id;

    -- Log
    INSERT INTO public.vehicle_transactions (user_id, user_vehicle_id, type, amount, details)
    VALUES (
        v_user_id, 
        p_user_vehicle_id, 
        'upgrade', 
        v_cost, 
        jsonb_build_object(
            'upgrade_type', p_upgrade_type,
            'level', v_current_level + 1
        )
    );

    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (
        v_user_id, 
        -v_cost, 
        'upgrade', 
        'Upgraded ' || p_upgrade_type || ' to lvl ' || (v_current_level + 1) || ' on ' || v_catalog.name
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Vehicle upgraded successfully',
        'new_level', v_current_level + 1,
        'cost', v_cost
    );
END;
$$;