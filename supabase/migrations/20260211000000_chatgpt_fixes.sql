-- Script to drop and recreate dependent views for BIGINT conversion
-- 1. Drop ALL potentially dependent views
DROP MATERIALIZED VIEW IF EXISTS public.user_earnings_summary CASCADE;
DROP VIEW IF EXISTS public.economy_summary CASCADE;
DROP VIEW IF EXISTS public.earnings_view CASCADE;
DROP VIEW IF EXISTS public.monthly_earnings_breakdown CASCADE;
DROP VIEW IF EXISTS public.creator_earnings CASCADE;
DROP VIEW IF EXISTS public.broadcaster_stats_public CASCADE;
DROP VIEW IF EXISTS public.battles_public CASCADE;
DROP VIEW IF EXISTS public.auction_bids_public CASCADE;
DROP VIEW IF EXISTS public.stream_seat_sessions_public CASCADE;
DROP VIEW IF EXISTS public.user_profiles_view CASCADE;

-- 2. BIGINT conversion for large balances
DO $$
BEGIN
    -- user_profiles
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'troll_coins') THEN
        ALTER TABLE public.user_profiles ALTER COLUMN troll_coins TYPE BIGINT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'free_coin_balance') THEN
        ALTER TABLE public.user_profiles ALTER COLUMN free_coin_balance TYPE BIGINT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'earned_coin_balance') THEN
        ALTER TABLE public.user_profiles ALTER COLUMN earned_coin_balance TYPE BIGINT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'paid_coin_balance') THEN
        ALTER TABLE public.user_profiles ALTER COLUMN paid_coin_balance TYPE BIGINT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'total_earned_coins') THEN
        ALTER TABLE public.user_profiles ALTER COLUMN total_earned_coins TYPE BIGINT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'trollmonds') THEN
        ALTER TABLE public.user_profiles ALTER COLUMN trollmonds TYPE BIGINT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'total_trollmonds') THEN
        ALTER TABLE public.user_profiles ALTER COLUMN total_trollmonds TYPE BIGINT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'paid_coins') THEN
        ALTER TABLE public.user_profiles ALTER COLUMN paid_coins TYPE BIGINT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'total_spent_coins') THEN
        ALTER TABLE public.user_profiles ALTER COLUMN total_spent_coins TYPE BIGINT;
    END IF;

    -- battles
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'score_challenger') THEN
        ALTER TABLE public.battles ALTER COLUMN score_challenger TYPE BIGINT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'score_opponent') THEN
        ALTER TABLE public.battles ALTER COLUMN score_opponent TYPE BIGINT;
    END IF;

    -- gift_ledger
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_ledger' AND column_name = 'cost_coins') THEN
        ALTER TABLE public.gift_ledger ALTER COLUMN cost_coins TYPE BIGINT;
    END IF;

    -- coin_transactions
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'amount') THEN
        ALTER TABLE public.coin_transactions ALTER COLUMN amount TYPE BIGINT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'fee') THEN
        ALTER TABLE public.coin_transactions ALTER COLUMN fee TYPE BIGINT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'balance_after') THEN
        ALTER TABLE public.coin_transactions ALTER COLUMN balance_after TYPE BIGINT;
    END IF;

    -- purchasable_items
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchasable_items' AND column_name = 'price_coins') THEN
        ALTER TABLE public.purchasable_items ALTER COLUMN price_coins TYPE BIGINT;
    END IF;
END $$;

-- 3. Broadcast Themes table
CREATE TABLE IF NOT EXISTS public.broadcast_themes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    preview_url text,
    is_premium boolean DEFAULT false,
    cost_coins bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broadcast_themes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view themes" ON public.broadcast_themes;
CREATE POLICY "Public can view themes" ON public.broadcast_themes FOR SELECT USING (true);

-- Seed themes
INSERT INTO public.broadcast_themes (name, preview_url, is_premium, cost_coins)
SELECT name, preview_url, is_premium, cost_coins FROM (
    VALUES 
    ('Classic Dark', 'https://example.com/themes/dark.jpg', false, 0),
    ('Neon Night', 'https://example.com/themes/neon.jpg', true, 1000),
    ('Ocean Breeze', 'https://example.com/themes/ocean.jpg', true, 500),
    ('Sunset Gold', 'https://example.com/themes/sunset.jpg', true, 750)
) AS t(name, preview_url, is_premium, cost_coins)
WHERE NOT EXISTS (SELECT 1 FROM public.broadcast_themes LIMIT 1);

-- 4. Recreate Essential Views (Simplified for stability)
CREATE OR REPLACE VIEW public.economy_summary WITH (security_invoker=true) AS
WITH 
  revenue_stats AS (
    SELECT COALESCE(SUM(usd_amount), 0) as total_revenue_usd FROM public.coin_transactions WHERE type = 'store_purchase' AND status = 'completed'
  ),
  circulation_stats AS (
    SELECT COALESCE(SUM(troll_coins + free_coin_balance), 0) as total_coins_in_circulation FROM public.user_profiles
  ),
  gift_stats AS (
    SELECT COALESCE(SUM(ABS(amount)), 0) as total_gift_coins_spent FROM public.coin_transactions WHERE type = 'gift'
  )
SELECT 
  rs.total_revenue_usd,
  cs.total_coins_in_circulation,
  gs.total_gift_coins_spent
FROM revenue_stats rs, circulation_stats cs, gift_stats gs;

CREATE OR REPLACE VIEW public.earnings_view AS
SELECT 
    id AS user_id,
    username,
    avatar_url,
    troll_coins AS current_coin_balance,
    total_earned_coins AS lifetime_earned_coins
FROM public.user_profiles
WHERE is_broadcaster = true OR total_earned_coins > 0;

CREATE MATERIALIZED VIEW public.user_earnings_summary AS
SELECT 
    id AS user_id,
    username,
    troll_coins AS current_coin_balance,
    total_earned_coins AS total_coins_earned
FROM public.user_profiles;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_earnings_summary_user_id ON public.user_earnings_summary(user_id);

-- 5. RPCs
CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
    p_sender_id uuid,
    p_stream_id uuid,
    p_gift_id uuid,
    p_txn_key text
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gift_cost BIGINT;
    v_receiver_id uuid;
    v_battle_id uuid;
    v_is_challenger boolean;
    v_sender_balance BIGINT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.gift_ledger WHERE txn_key = p_txn_key) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Duplicate transaction');
    END IF;

    SELECT price_coins INTO v_gift_cost FROM public.purchasable_items WHERE id = p_gift_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Gift not found'; END IF;

    SELECT broadcaster_id INTO v_receiver_id FROM public.streams WHERE id = p_stream_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stream not found'; END IF;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_gift_cost
    WHERE id = p_sender_id AND troll_coins >= v_gift_cost
    RETURNING troll_coins INTO v_sender_balance;

    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    INSERT INTO public.gift_ledger (sender_id, receiver_id, stream_id, gift_id, cost_coins, txn_key)
    VALUES (p_sender_id, v_receiver_id, p_stream_id, p_gift_id, v_gift_cost, p_txn_key);

    SELECT id, (challenger_stream_id = p_stream_id) INTO v_battle_id, v_is_challenger
    FROM public.battles
    WHERE (challenger_stream_id = p_stream_id OR opponent_stream_id = p_stream_id)
      AND status = 'active'
    LIMIT 1;

    IF v_battle_id IS NOT NULL THEN
        IF v_is_challenger THEN
            UPDATE public.battles SET score_challenger = score_challenger + v_gift_cost WHERE id = v_battle_id;
        ELSE
            UPDATE public.battles SET score_opponent = score_opponent + v_gift_cost WHERE id = v_battle_id;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'new_balance', v_sender_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_battle(p_battle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_challenger_stream_id uuid;
    v_opponent_stream_id uuid;
BEGIN
    SELECT challenger_stream_id, opponent_stream_id INTO v_challenger_stream_id, v_opponent_stream_id
    FROM public.battles
    WHERE id = p_battle_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Battle not found or already started');
    END IF;

    UPDATE public.battles SET status = 'active', started_at = now() WHERE id = p_battle_id;
    UPDATE public.streams SET battle_id = p_battle_id WHERE id IN (v_challenger_stream_id, v_opponent_stream_id);

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_seat_atomic(
    p_stream_id uuid,
    p_seat_index int,
    p_user_id uuid
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id AND seat_index = p_seat_index AND status = 'active'
        FOR UPDATE SKIP LOCKED
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Seat already occupied');
    END IF;

    INSERT INTO public.stream_seat_sessions (stream_id, seat_index, user_id, status, joined_at)
    VALUES (p_stream_id, p_seat_index, p_user_id, 'active', now());

    RETURN jsonb_build_object('success', true);
END;
$$;
