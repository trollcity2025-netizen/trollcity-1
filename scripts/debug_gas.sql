DO $$
DECLARE
    v_user_id UUID;
    v_start_gas NUMERIC;
    v_after_refill NUMERIC;
    v_after_consume NUMERIC;
    v_refill_res JSONB;
    v_consume_res JSONB;
BEGIN
    -- 1. Pick a user (limit 1)
    SELECT id INTO v_user_id FROM public.user_profiles LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No users found';
    END IF;
    
    RAISE NOTICE 'Testing user: %', v_user_id;

    -- 2. Reset Gas to 0
    UPDATE public.user_profiles SET gas_balance = 0 WHERE id = v_user_id;
    
    SELECT gas_balance INTO v_start_gas FROM public.user_profiles WHERE id = v_user_id;
    RAISE NOTICE 'Start Gas: %', v_start_gas;

    -- 3. Mock Auth
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    PERFORM set_config('role', 'authenticated', true);

    -- 4. Refill Gas (100%)
    v_refill_res := public.refill_gas(100);
    RAISE NOTICE 'Refill Result: %', v_refill_res;
    
    SELECT gas_balance INTO v_after_refill FROM public.user_profiles WHERE id = v_user_id;
    RAISE NOTICE 'Gas After Refill: %', v_after_refill;

    -- 5. Consume Gas (5%)
    v_consume_res := public.consume_gas(5);
    RAISE NOTICE 'Consume Result: %', v_consume_res;
    
    SELECT gas_balance INTO v_after_consume FROM public.user_profiles WHERE id = v_user_id;
    RAISE NOTICE 'Gas After Consume: %', v_after_consume;
    
    -- Check if it dropped to 0 unexpectedly
    IF v_after_consume < 90 THEN
        RAISE EXCEPTION 'ALERT: Gas dropped too low! Expected ~95, got %', v_after_consume;
    END IF;

END $$;
