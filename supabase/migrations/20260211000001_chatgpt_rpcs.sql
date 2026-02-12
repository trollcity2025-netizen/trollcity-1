-- 3. Seed Broadcast Themes (broadcast_background_themes)
DROP TABLE IF EXISTS public.broadcast_themes; -- Remove redundant table if it was created

INSERT INTO public.broadcast_background_themes (slug, name, description, price_coins, image_url, background_css, is_active, sort_order)
VALUES 
  ('classic', 'Classic Dark', 'The classic Troll City look.', 0, '/assets/themes/theme_purple.svg', 'theme-purple', true, 1),
  ('neon', 'Neon Night', 'High contrast neon styling.', 100, '/assets/themes/theme_neon.svg', 'theme-neon', true, 2),
  ('cyber', 'Cyberpunk', 'Futuristic cyber styling.', 250, '/assets/themes/theme_cyber.svg', 'theme-cyber', true, 3),
  ('rgb', 'Gamer RGB', 'Animated RGB flow for true gamers.', 500, '/assets/themes/theme_rgb.svg', 'theme-rgb', true, 4),
  ('ocean', 'Ocean Breeze', 'Calming blue gradients.', 750, '/assets/themes/theme_ocean.svg', 'theme-ocean', true, 5),
  ('sunset', 'Sunset Gold', 'Warm golden tones.', 1000, '/assets/themes/theme_sunset.svg', 'theme-sunset', true, 6)
ON CONFLICT (slug) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_coins = EXCLUDED.price_coins,
  image_url = EXCLUDED.image_url,
  background_css = EXCLUDED.background_css,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- 4. Recreate Essential Views (Simplified for stability)
DROP VIEW IF EXISTS public.economy_summary CASCADE;
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

DROP VIEW IF EXISTS public.earnings_view CASCADE;
CREATE OR REPLACE VIEW public.earnings_view AS
SELECT 
    id AS user_id,
    username,
    avatar_url,
    troll_coins AS current_coin_balance,
    total_earned_coins AS lifetime_earned_coins
FROM public.user_profiles
WHERE is_broadcaster = true OR total_earned_coins > 0;

DROP MATERIALIZED VIEW IF EXISTS public.user_earnings_summary CASCADE;
CREATE MATERIALIZED VIEW public.user_earnings_summary AS
SELECT 
    id AS user_id,
    username,
    troll_coins AS current_coin_balance,
    total_earned_coins AS total_coins_earned
FROM public.user_profiles;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_earnings_summary_user_id ON public.user_earnings_summary(user_id);

-- 5. RPCs
DROP FUNCTION IF EXISTS public.send_gift_in_stream(uuid, uuid, uuid, text);
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

DROP FUNCTION IF EXISTS public.accept_battle(uuid);
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
    UPDATE public.streams SET battle_id = p_battle_id, is_battle = true WHERE id IN (v_challenger_stream_id, v_opponent_stream_id);

    RETURN jsonb_build_object('success', true);
END;
$$;

DROP FUNCTION IF EXISTS public.join_seat_atomic(uuid, int, uuid);
CREATE OR REPLACE FUNCTION public.join_seat_atomic(
    p_stream_id uuid,
    p_seat_index int,
    p_user_id uuid
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_locked boolean;
BEGIN
    SELECT seats_locked INTO v_locked FROM public.streams WHERE id = p_stream_id;
    IF v_locked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Guest boxes are currently locked by the host');
    END IF;

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
