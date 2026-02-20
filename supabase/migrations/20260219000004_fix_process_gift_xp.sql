CREATE OR REPLACE FUNCTION process_gift_xp(transaction_id_in uuid, stream_id_in uuid)
RETURNS void AS $$
DECLARE
    sender_id_val uuid;
    recipient_id_val uuid;
    gift_id_val uuid;
    gift_name_val text;
    xp_to_award int;
    sender_xp int;
    recipient_xp int;
    gift_cost bigint; -- Changed to bigint
BEGIN
    -- 1. Get transaction details
    SELECT 
        metadata->>'sender_id', 
        metadata->>'recipient_id', 
        metadata->>'gift_id', 
        metadata->>'gift_name', 
        (metadata->>'cost')::bigint -- Changed to bigint
    INTO 
        sender_id_val, 
        recipient_id_val, 
        gift_id_val, 
        gift_name_val, 
        gift_cost
    FROM public.coin_transactions
    WHERE id = transaction_id_in
    AND type = 'gift_sent';

    IF sender_id_val IS NULL THEN
        RAISE EXCEPTION 'Gift transaction not found for ID: %', transaction_id_in;
    END IF;

    -- 2. Calculate XP based on gift cost
    xp_to_award := GREATEST(1, LEAST(100, FLOOR(gift_cost / 100)::int));
    sender_xp := xp_to_award;
    recipient_xp := xp_to_award * 2; -- Receiver gets more XP

    -- 3. Award XP
    UPDATE public.user_profiles
    SET xp = xp + sender_xp
    WHERE id = sender_id_val;

    UPDATE public.user_profiles
    SET xp = xp + recipient_xp
    WHERE id = recipient_id_val;

    -- 4. Evaluate badges for sender
    PERFORM evaluate_badges(sender_id_val);

END;
$$ LANGUAGE plpgsql;