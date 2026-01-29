CREATE OR REPLACE FUNCTION public.purchase_admin_for_week()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cost INTEGER := 200000; -- Updated to 200k
    v_balance INTEGER;
BEGIN
    -- Check balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
    END IF;

    -- Check if already in queue
    IF EXISTS (SELECT 1 FROM public.admin_for_week_queue WHERE user_id = v_user_id AND status IN ('queued', 'active')) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are already in the queue or active');
    END IF;

    -- Deduct coins
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_cost WHERE id = v_user_id;
    
    -- Add to ledger
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
    VALUES (v_user_id, -v_cost, 'purchase', 'store', 'Purchase Admin For A Week');

    -- Add to queue
    INSERT INTO public.admin_for_week_queue (user_id, status)
    VALUES (v_user_id, 'queued');

    RETURN jsonb_build_object('success', true);
END;
$$;
