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
CREATE OR REPLACE FUNCTION public.sell_vehicle(p_user_car_id UUID) -- Changed parameter name
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_car RECORD; -- Changed to v_user_car
    v_car_shell RECORD; -- New variable for car_shell details
    v_sell_price INTEGER;
BEGIN
    v_user_id := auth.uid();
    
    -- Check authentication
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Get user car and verify ownership
    SELECT * INTO v_user_car FROM public.user_cars -- Changed to user_cars
    WHERE id = p_user_car_id AND user_id = v_user_id;
    
    IF v_user_car IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car not found or not owned by you');
    END IF;

    -- Get car shell details for pricing
    SELECT * INTO v_car_shell FROM public.car_shells_catalog WHERE id = v_user_car.shell_id; -- Changed to car_shells_catalog and shell_id
    
    -- Calculate sell price (50% of base price of the car shell)
    v_sell_price := FLOOR(v_car_shell.price * 0.5);

    -- 1. Delete user car (Cascades to user_car_parts, titles, registrations, insurance due to FK constraints)
    DELETE FROM public.user_cars WHERE id = p_user_car_id; -- Changed to user_cars

    -- 2. Add Coins
    UPDATE public.user_profiles 
    SET money = money + v_sell_price -- Changed troll_coins to money
    WHERE id = v_user_id;

    -- 3. Log Transaction
    INSERT INTO public.vehicle_transactions (user_id, type, amount, details)
    VALUES (
        v_user_id, 
        'sale', 
        v_sell_price, 
        jsonb_build_object(
            'user_car_id', p_user_car_id, -- Changed to user_car_id
            'shell_id', v_user_car.shell_id, -- Changed to shell_id
            'car_name', v_car_shell.name, -- Changed to v_car_shell.name
            'reason', 'User sold to dealer'
        )
    );

    -- 4. Coin Transaction Log
    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (
        v_user_id, 
        v_sell_price, 
        'sale', 
        'Sold ' || v_car_shell.name || ' to KTAuto' -- Changed to v_car_shell.name
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Car sold for ' || v_sell_price || ' coins',
        'amount', v_sell_price
    );
END;
$$;

-- 3. Upgrade Vehicle RPC
CREATE OR REPLACE FUNCTION public.upgrade_vehicle(
    p_user_car_id UUID, 
    p_upgrade_type TEXT -- 'engine', 'armor', 'rims', 'brakes', 'suspension'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN jsonb_build_object('success', false, 'message', 'This RPC is deprecated. Please use install_car_part instead.');
END;
$$;

-- New RPC for installing car parts
CREATE OR REPLACE FUNCTION public.install_car_part(
    p_user_car_id UUID,
    p_part_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_car RECORD;
    v_car_part RECORD;
    v_cost INTEGER;
    v_user_money INTEGER;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Get user car and verify ownership
    SELECT * INTO v_user_car FROM public.user_cars 
    WHERE id = p_user_car_id AND user_id = v_user_id;
    
    IF v_user_car IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User car not found or not owned by you');
    END IF;

    -- Get part details
    SELECT * INTO v_car_part FROM public.car_parts_catalog WHERE id = p_part_id;

    IF v_car_part IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car part not found in catalog');
    END IF;

    -- Check if a part of the same type is already installed (basic check for now)
    -- This assumes only one of each part_type can be installed per car.
    IF EXISTS (SELECT 1 FROM public.user_car_parts ucp JOIN public.car_parts_catalog cpc ON ucp.part_id = cpc.id WHERE ucp.user_car_id = p_user_car_id AND cpc.part_type = v_car_part.part_type) THEN
        RETURN jsonb_build_object('success', false, 'message', 'A part of this type is already installed on the car. Please remove it first.');
    END IF;

    v_cost := v_car_part.price;

    -- Check balance
    SELECT money INTO v_user_money FROM public.user_profiles WHERE id = v_user_id;
    
    IF v_user_money < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds: ' || v_cost || ' required');
    END IF;

    -- Deduct coins
    UPDATE public.user_profiles 
    SET money = money - v_cost 
    WHERE id = v_user_id;

    -- Install part
    INSERT INTO public.user_car_parts (user_car_id, part_id)
    VALUES (p_user_car_id, p_part_id);

    -- Log transaction
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (
        v_user_id, 
        v_cost, 
        'debit', 
        'Installed part ' || v_car_part.name || ' on user car ' || p_user_car_id
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Car part installed successfully',
        'part_name', v_car_part.name,
        'cost', v_cost
    );
END;
$$;

-- New RPC for identifying and flagging cars for repossession
CREATE OR REPLACE FUNCTION public.repo_sweep()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_flagged_count INTEGER := 0;
BEGIN
    UPDATE public.user_cars
    SET 
        repo_status = 'flagged',
        impounded_at = NOW(),
        impound_reason = 'Insurance expired'
    WHERE 
        insurance_status = 'expired' 
        AND repo_status = 'none'
    RETURNING 1 INTO v_flagged_count; -- Get count of updated rows

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Repo sweep completed',
        'flagged_cars_count', v_flagged_count
    );
END;
$$;

-- New RPC for purchasing a repossessed vehicle
CREATE OR REPLACE FUNCTION public.buy_repossessed_vehicle(
    p_user_car_id UUID,
    p_plate_type TEXT DEFAULT 'temp'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_car public.user_cars%ROWTYPE;
    v_car_shell public.car_shells_catalog%ROWTYPE;
    v_purchase_price INTEGER;
    v_user_money INTEGER;
    v_title_id UUID;
    v_registration_id UUID;
    v_insurance_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Verify the car is flagged for repossession
    SELECT * INTO v_user_car FROM public.user_cars WHERE id = p_user_car_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car not found.');
    END IF;

    IF v_user_car.repo_status <> 'flagged' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car is not available for repossession purchase.');
    END IF;

    -- Get car shell details to calculate price
    SELECT * INTO v_car_shell FROM public.car_shells_catalog WHERE id = v_user_car.shell_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car shell not found.');
    END IF;

    -- Calculate purchase price (e.g., 75% of original shell price)
    v_purchase_price := FLOOR(v_car_shell.price * 0.75);

    -- Check user's money
    SELECT money INTO v_user_money FROM public.user_profiles WHERE id = v_user_id;

    IF v_user_money < v_purchase_price THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds to purchase repossessed vehicle.');
    END IF;

    -- Deduct money from buyer
    UPDATE public.user_profiles
    SET money = money - v_purchase_price
    WHERE id = v_user_id;

    -- Transfer ownership and reset car status
    UPDATE public.user_cars
    SET 
        user_id = v_user_id,
        repo_status = 'none',
        insurance_status = 'active',
        is_impounded = FALSE,
        impounded_at = NULL,
        impound_reason = NULL,
        is_listed_for_sale = FALSE,
        asking_price = NULL,
        listed_at = NULL,
        title_status = 'draft',
        notary_id = NULL,
        notarized_at = NULL
    WHERE id = p_user_car_id;

    -- Create new Title
    INSERT INTO public.titles (user_id, vehicle_id, created_at)
    VALUES (v_user_id, p_user_car_id, NOW())
    RETURNING id INTO v_title_id;

    -- Create new Registration
    INSERT INTO public.registrations (user_id, vehicle_id, plate_type, created_at)
    VALUES (v_user_id, p_user_car_id, p_plate_type, NOW())
    RETURNING id INTO v_registration_id;

    -- Create new Insurance Policy (Basic - 30 days)
    INSERT INTO public.insurance_policies (user_id, vehicle_id, policy_start_date, policy_end_date, premium_cost, status)
    VALUES (v_user_id, p_user_car_id, NOW(), NOW() + INTERVAL '30 days', 100, 'active')
    RETURNING id INTO v_insurance_id;

    -- Log the purchase
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (v_user_id, v_purchase_price, 'debit', 'Purchased repossessed car ' || v_car_shell.name);

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Repossessed vehicle purchased successfully!',
        'user_car_id', p_user_car_id,
        'purchase_price', v_purchase_price
    );
END;
$$;

-- RPC for listing a user car for sale
CREATE OR REPLACE FUNCTION public.list_user_car_for_sale(
    p_user_car_id UUID,
    p_asking_price INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_car public.user_cars%ROWTYPE;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Verify car exists and belongs to the user
    SELECT * INTO v_user_car FROM public.user_cars WHERE id = p_user_car_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car not found or not owned by you.');
    END IF;

    IF p_asking_price <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Asking price must be positive.');
    END IF;

    -- Update car to be listed for sale
    UPDATE public.user_cars
    SET 
        is_listed_for_sale = TRUE,
        asking_price = p_asking_price,
        listed_at = NOW()
    WHERE id = p_user_car_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Car listed for sale successfully!',
        'user_car_id', p_user_car_id,
        'asking_price', p_asking_price
    );
END;
$$;

-- RPC for unlisting a user car from sale
CREATE OR REPLACE FUNCTION public.unlist_user_car_for_sale(
    p_user_car_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_car public.user_cars%ROWTYPE;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Verify car exists and belongs to the user
    SELECT * INTO v_user_car FROM public.user_cars WHERE id = p_user_car_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car not found or not owned by you.');
    END IF;

    -- Update car to be unlisted from sale
    UPDATE public.user_cars
    SET 
        is_listed_for_sale = FALSE,
        asking_price = NULL,
        listed_at = NULL
    WHERE id = p_user_car_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Car unlisted from sale successfully!',
        'user_car_id', p_user_car_id
    );
END;
$$;