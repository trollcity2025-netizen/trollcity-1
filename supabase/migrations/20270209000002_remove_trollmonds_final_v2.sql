-- Migration: Remove Trollmonds Currency and Cleanup
-- Replaces 20260212_remove_trollmonds_final.sql
-- Description: Permanently removes the trollmonds column, related tables, and updates gift logic to use Troll Coins.

-- 1. Update process_gift_with_lucky to remove trollmonds logic and award Troll Coins instead
CREATE OR REPLACE FUNCTION public.process_gift_with_lucky(
    p_sender_id uuid,
    p_receiver_id uuid,
    p_paid_coins bigint,
    p_gift_type text DEFAULT 'standard'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result jsonb;
    v_credit_result jsonb;
    v_lucky_multiplier integer;
    v_coins_returned bigint := 0;
    v_admin_check boolean := false;
    v_sender_balance bigint;
    v_credit_bonus_result jsonb;
BEGIN
    -- Input validation
    IF p_paid_coins <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid coin amount');
    END IF;

    IF p_sender_id = p_receiver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot send gift to yourself');
    END IF;

    -- Check if receiver is admin
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = p_receiver_id AND role = 'admin') INTO v_admin_check;

    -- 1. Spend coins (Atomic deduction via Troll Bank)
    SELECT public.troll_bank_spend_coins_secure(
        p_sender_id,
        p_paid_coins::int,
        'paid',
        'gift_sent',
        null,
        jsonb_build_object('receiver_id', p_receiver_id, 'gift_type', p_gift_type)
    ) INTO v_spend_result;

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN jsonb_build_object('success', false, 'error', v_spend_result->>'error');
    END IF;

    v_sender_balance := (v_spend_result->>'new_balance')::bigint;

    -- 2. Credit receiver
    SELECT public.troll_bank_credit_coins(
        p_receiver_id,
        p_paid_coins::int,
        'gifted',
        'gift_received',
        null
    ) INTO v_credit_result;

    -- 3. Update receiver's total_earned_coins
    UPDATE user_profiles
    SET total_earned_coins = COALESCE(total_earned_coins, 0) + p_paid_coins
    WHERE id = p_receiver_id;

    -- 4. Lucky Multiplier Logic (Modified to return Troll Coins)
    BEGIN
        SELECT public.calculate_lucky_multiplier(p_paid_coins) INTO v_lucky_multiplier;
    EXCEPTION WHEN OTHERS THEN
        v_lucky_multiplier := NULL;
    END;

    IF v_lucky_multiplier IS NOT NULL THEN
        v_coins_returned := p_paid_coins * v_lucky_multiplier;
        
        -- Credit Troll Coins back to sender (Lucky Bonus)
        SELECT public.troll_bank_credit_coins(
            p_sender_id,
            v_coins_returned::int,
            'reward',
            'lucky_gift_bonus',
            null,
            jsonb_build_object('multiplier', v_lucky_multiplier, 'original_gift', p_paid_coins)
        ) INTO v_credit_bonus_result;
        
        -- Update sender balance reference
        IF (v_credit_bonus_result->>'success')::boolean THEN
             v_sender_balance := (v_credit_bonus_result->>'new_balance')::bigint;
        END IF;
    END IF;

    -- 5. Process admin gift if needed
    IF v_admin_check THEN
        BEGIN
            PERFORM public.process_admin_gift(p_sender_id, p_receiver_id, p_paid_coins);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'spent_coins', p_paid_coins,
        'lucky_multiplier', v_lucky_multiplier,
        'coins_returned', v_coins_returned,
        'new_paid_balance', v_sender_balance
    );
END;
$$;

-- 2. Drop deprecated tables and functions
DROP TABLE IF EXISTS lucky_trollmond_events;
DROP TABLE IF EXISTS trollmond_transactions;

-- Drop all overloads of spend_trollmonds
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS func_signature
             FROM pg_proc
             WHERE proname = 'spend_trollmonds'
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.func_signature;
    END LOOP;
END $$;

-- 3. Drop trollmonds column safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'trollmonds') THEN
    ALTER TABLE user_profiles DROP COLUMN trollmonds;
  END IF;
END $$;
