-- Migration to support Vehicle Titles, Notarization, and Unique Car Sales

-- 1. Add Title columns to user_cars
ALTER TABLE public.user_cars
ADD COLUMN IF NOT EXISTS title_status TEXT DEFAULT 'draft' CHECK (title_status IN ('draft', 'pending_notarization', 'notarized')),
ADD COLUMN IF NOT EXISTS notary_id UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS notarized_at TIMESTAMPTZ;

-- 2. Add user_car_id to vehicle_listings to support selling specific instances
ALTER TABLE public.vehicle_listings
ADD COLUMN IF NOT EXISTS user_car_id UUID REFERENCES public.user_cars(id);

-- 3. RPC to Request Notarization
CREATE OR REPLACE FUNCTION public.request_vehicle_notarization(p_car_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_car public.user_cars%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    SELECT * INTO v_car FROM public.user_cars WHERE id = p_car_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car not found');
    END IF;

    IF v_car.user_id <> v_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'You do not own this car');
    END IF;

    IF v_car.title_status = 'notarized' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Title is already notarized');
    END IF;

    IF v_car.title_status = 'pending_notarization' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Notarization already requested');
    END IF;

    UPDATE public.user_cars
    SET title_status = 'pending_notarization'
    WHERE id = p_car_id;

    -- Create a task in executive_intake for secretaries
    INSERT INTO public.executive_intake (
        type,
        title,
        description,
        status,
        submitted_by,
        metadata
    ) VALUES (
        'vehicle_title',
        'Vehicle Title Notarization',
        'Request to notarize vehicle title for car ID ' || p_car_id,
        'pending',
        v_user_id,
        jsonb_build_object('car_id', p_car_id)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Notarization requested');
END;
$$;

-- 4. RPC for Secretary to Sign Title
CREATE OR REPLACE FUNCTION public.sign_vehicle_title(p_car_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_secretary_id UUID;
    v_car public.user_cars%ROWTYPE;
    v_is_secretary BOOLEAN;
BEGIN
    v_secretary_id := auth.uid();
    IF v_secretary_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Check if user is secretary (or admin)
    SELECT EXISTS (
        SELECT 1 FROM public.secretary_assignments WHERE secretary_id = v_secretary_id
    ) INTO v_is_secretary;

    -- Also allow admins/owners (optional, but sticking to secretary for now)
    -- Assuming admin check is separate or included in secretary assignments.
    -- For now strict secretary check.

    IF NOT v_is_secretary THEN
        -- Fallback: Check if admin via role or simple check (assuming public.is_admin function exists or similar)
        -- For this system, we'll assume secretary_assignments is the source of truth for this role.
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Secretary role required');
    END IF;

    SELECT * INTO v_car FROM public.user_cars WHERE id = p_car_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car not found');
    END IF;

    IF v_car.title_status = 'notarized' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Already notarized');
    END IF;

    UPDATE public.user_cars
    SET title_status = 'notarized',
        notary_id = v_secretary_id,
        notarized_at = NOW()
    WHERE id = p_car_id;

    -- Update the intake task if exists
    UPDATE public.executive_intake
    SET status = 'approved',
        resolved_at = NOW(),
        resolved_by = v_secretary_id
    WHERE type = 'vehicle_title' 
      AND (metadata->>'car_id')::UUID = p_car_id
      AND status = 'pending';

    RETURN jsonb_build_object('success', true, 'message', 'Title notarized successfully');
END;
$$;

-- 5. RPC to Get Car Details including Upgrades and Value
CREATE OR REPLACE FUNCTION public.get_vehicle_details(p_car_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_car public.user_cars%ROWTYPE;
    v_upgrades JSONB;
    v_upgrade_total INTEGER := 0;
    v_base_price INTEGER := 0; -- We might not have this easily in DB if it's in code, but we'll try.
    v_catalog_price INTEGER;
    v_owner_name TEXT;
    v_notary_name TEXT;
    v_car_model_id_int INTEGER;
BEGIN
    SELECT * INTO v_car FROM public.user_cars WHERE id = p_car_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car not found');
    END IF;

    -- Attempt to get owner name
    SELECT username INTO v_owner_name FROM public.user_profiles WHERE id = v_car.user_id;
    
    -- Attempt to get notary name
    IF v_car.notary_id IS NOT NULL THEN
        SELECT username INTO v_notary_name FROM public.user_profiles WHERE id = v_car.notary_id;
    END IF;

    -- Try to parse car_id as int to find upgrades
    BEGIN
        v_car_model_id_int := v_car.car_id::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_car_model_id_int := NULL;
    END;

    -- Fetch Upgrades
    -- Note: vehicle_upgrades uses integer vehicle_id (model id) + user_id. 
    -- This is imperfect for multiple cars of same model, but it's the current system.
    IF v_car_model_id_int IS NOT NULL THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'upgrade_type', upgrade_type,
                'cost', cost,
                'status', status
            )
        ), COALESCE(SUM(cost), 0)
        INTO v_upgrades, v_upgrade_total
        FROM public.vehicle_upgrades
        WHERE user_id = v_car.user_id 
          AND vehicle_id = v_car_model_id_int
          AND status = 'installed';
    END IF;

    -- Try to find base price from vehicles_catalog if exists, or just return 0 and let frontend handle
    -- (Frontend has the 'cars' array with prices)
    -- We'll return just the upgrade total and let frontend add base price.

    RETURN jsonb_build_object(
        'success', true,
        'car', to_jsonb(v_car),
        'owner_username', v_owner_name,
        'notary_username', v_notary_name,
        'upgrades', COALESCE(v_upgrades, '[]'::jsonb),
        'upgrade_value', v_upgrade_total
    );
END;
$$;

-- 6. RPC to Transfer Vehicle (for Auctions/Sales)
-- This replaces/enhances the old logic. It transfers the specific user_cars row.
CREATE OR REPLACE FUNCTION public.transfer_user_car(
    p_user_car_id UUID, -- Direct user_car ID
    p_buyer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_car public.user_cars%ROWTYPE;
    v_seller_id UUID;
BEGIN
    -- Verify car exists and get current owner (seller)
    SELECT * INTO v_user_car FROM public.user_cars WHERE id = p_user_car_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User car not found');
    END IF;

    v_seller_id := v_user_car.user_id;

    -- Ensure seller is not the buyer
    IF v_seller_id = p_buyer_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot transfer car to self');
    END IF;

    -- Transfer ownership
    UPDATE public.user_cars
    SET 
        user_id = p_buyer_id,
        is_listed_for_sale = FALSE, -- Car is no longer listed after transfer
        asking_price = NULL,        -- Clear asking price
        listed_at = NULL,           -- Clear listed timestamp
        title_status = 'draft',     -- Reset title status for new owner
        notary_id = NULL,
        notarized_at = NULL
    WHERE id = p_user_car_id;

    -- Log transaction for seller
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (
        v_seller_id, 
        0, -- Amount already handled by auction/marketplace logic
        'sale', 
        'Transferred ownership of car ' || p_user_car_id || ' to ' || p_buyer_id
    );

    -- Log transaction for buyer
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (
        p_buyer_id, 
        0, -- Amount already handled by auction/marketplace logic
        'purchase', 
        'Received ownership of car ' || p_user_car_id || ' from ' || v_seller_id
    );

    RETURN jsonb_build_object('success', true, 'message', 'Car transferred successfully');
END;
$$;
