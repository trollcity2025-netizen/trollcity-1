-- Broadcast Abilities System
-- Tables for ability inventory, active effects, logs, and coin drop events

-- 1. User ability inventory (won from Troll Wheel)
CREATE TABLE IF NOT EXISTS public.user_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ability_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cooldown_until TIMESTAMPTZ,
  won_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, ability_id)
);

-- 2. Active broadcast effects
CREATE TABLE IF NOT EXISTS public.broadcast_active_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id TEXT NOT NULL,
  ability_id TEXT NOT NULL,
  activator_id UUID NOT NULL REFERENCES public.user_profiles(id),
  activator_username TEXT NOT NULL,
  target_user_id UUID REFERENCES public.user_profiles(id),
  target_username TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Ability usage logs
CREATE TABLE IF NOT EXISTS public.broadcast_ability_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id TEXT NOT NULL,
  ability_id TEXT NOT NULL,
  activator_id UUID NOT NULL REFERENCES public.user_profiles(id),
  activator_username TEXT NOT NULL,
  target_user_id UUID REFERENCES public.user_profiles(id),
  target_username TEXT,
  amount INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Coin drop events
CREATE TABLE IF NOT EXISTS public.coin_drop_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id TEXT NOT NULL,
  activator_id UUID NOT NULL REFERENCES public.user_profiles(id),
  activator_username TEXT NOT NULL,
  drop_type TEXT NOT NULL CHECK (drop_type IN ('green', 'red')),
  total_amount INTEGER NOT NULL,
  remaining_amount INTEGER NOT NULL,
  per_click_amount INTEGER NOT NULL DEFAULT 5,
  max_deduction_per_user INTEGER NOT NULL DEFAULT 100,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Coin drop collections
CREATE TABLE IF NOT EXISTS public.coin_drop_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_event_id UUID NOT NULL REFERENCES public.coin_drop_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id),
  username TEXT NOT NULL,
  amount INTEGER NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_abilities_user_id ON public.user_abilities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_abilities_ability_id ON public.user_abilities(ability_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_active_effects_stream ON public.broadcast_active_effects(stream_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_active_effects_expires ON public.broadcast_active_effects(expires_at);
CREATE INDEX IF NOT EXISTS idx_ability_logs_stream ON public.broadcast_ability_logs(stream_id);
CREATE INDEX IF NOT EXISTS idx_ability_logs_activator ON public.broadcast_ability_logs(activator_id);
CREATE INDEX IF NOT EXISTS idx_coin_drop_events_stream ON public.coin_drop_events(stream_id);
CREATE INDEX IF NOT EXISTS idx_coin_drop_collections_event ON public.coin_drop_collections(drop_event_id);

-- RLS Policies
ALTER TABLE public.user_abilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_active_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_ability_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_drop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_drop_collections ENABLE ROW LEVEL SECURITY;

-- Users can read their own abilities
CREATE POLICY "Users can view own abilities" ON public.user_abilities
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own abilities (for quantity decrement)
CREATE POLICY "Users can update own abilities" ON public.user_abilities
  FOR UPDATE USING (auth.uid() = user_id);

-- Insert abilities (for wheel wins)
CREATE POLICY "System can insert abilities" ON public.user_abilities
  FOR INSERT WITH CHECK (true);

-- Active effects are readable by everyone
CREATE POLICY "Anyone can view active effects" ON public.broadcast_active_effects
  FOR SELECT USING (true);

-- System can manage active effects
CREATE POLICY "System can manage active effects" ON public.broadcast_active_effects
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update active effects" ON public.broadcast_active_effects
  FOR UPDATE USING (true);

-- Ability logs are readable by everyone
CREATE POLICY "Anyone can view ability logs" ON public.broadcast_ability_logs
  FOR SELECT USING (true);

-- System can insert ability logs
CREATE POLICY "System can insert ability logs" ON public.broadcast_ability_logs
  FOR INSERT WITH CHECK (true);

-- Coin drop events readable by everyone
CREATE POLICY "Anyone can view coin drops" ON public.coin_drop_events
  FOR SELECT USING (true);

CREATE POLICY "System can manage coin drops" ON public.coin_drop_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update coin drops" ON public.coin_drop_events
  FOR UPDATE USING (true);

-- Coin drop collections
CREATE POLICY "Anyone can view collections" ON public.coin_drop_collections
  FOR SELECT USING (true);

CREATE POLICY "Users can collect drops" ON public.coin_drop_collections
  FOR INSERT WITH CHECK (true);

-- RPC: Add ability to user inventory (for wheel wins)
CREATE OR REPLACE FUNCTION public.add_ability_to_inventory(
  p_user_id UUID,
  p_ability_id TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_abilities (user_id, ability_id, quantity)
  VALUES (p_user_id, p_ability_id, 1)
  ON CONFLICT (user_id, ability_id)
  DO UPDATE SET quantity = public.user_abilities.quantity + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Use an ability (decrements quantity, sets cooldown)
CREATE OR REPLACE FUNCTION public.use_broadcast_ability(
  p_user_id UUID,
  p_ability_id TEXT,
  p_stream_id TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_target_username TEXT DEFAULT NULL,
  p_amount INTEGER DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_ability RECORD;
  v_cooldown_seconds INTEGER;
  v_new_quantity INTEGER;
BEGIN
  -- Check if user owns the ability
  SELECT * INTO v_ability
  FROM public.user_abilities
  WHERE user_id = p_user_id AND ability_id = p_ability_id AND quantity > 0;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ability not owned');
  END IF;

  -- Check cooldown
  IF v_ability.cooldown_until IS NOT NULL AND v_ability.cooldown_until > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ability on cooldown', 'cooldown_until', v_ability.cooldown_until);
  END IF;

  -- Get cooldown duration from ability definition
  v_cooldown_seconds := CASE p_ability_id
    WHEN 'mute_hammer' THEN 300
    WHEN 'truth_serum' THEN 600
    WHEN 'fake_system_alert' THEN 180
    WHEN 'gold_frame_broadcast' THEN 600
    WHEN 'coin_drop_event' THEN 900
    WHEN 'vip_chat_only' THEN 600
    WHEN 'raid_another_stream' THEN 1800
    WHEN 'citywide_broadcast' THEN 3600
    WHEN 'troll_foot' THEN 900
    ELSE 300
  END;

  -- Decrement quantity
  v_new_quantity := v_ability.quantity - 1;

  IF v_new_quantity <= 0 THEN
    DELETE FROM public.user_abilities WHERE id = v_ability.id;
  ELSE
    UPDATE public.user_abilities
    SET quantity = v_new_quantity,
        cooldown_until = now() + (v_cooldown_seconds || ' seconds')::INTERVAL,
        last_used_at = now()
    WHERE id = v_ability.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'remaining', v_new_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Collect coin drop
CREATE OR REPLACE FUNCTION public.collect_coin_drop(
  p_drop_event_id UUID,
  p_user_id UUID,
  p_username TEXT
) RETURNS JSONB AS $$
DECLARE
  v_drop RECORD;
  v_already_collected INTEGER;
  v_collect_amount INTEGER;
BEGIN
  -- Get the drop event
  SELECT * INTO v_drop
  FROM public.coin_drop_events
  WHERE id = p_drop_event_id AND is_active = true AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Drop event not found or expired');
  END IF;

  -- Check if user already collected
  SELECT COALESCE(SUM(amount), 0) INTO v_already_collected
  FROM public.coin_drop_collections
  WHERE drop_event_id = p_drop_event_id AND user_id = p_user_id;

  -- Check max deduction for red troll
  IF v_drop.drop_type = 'red' AND v_already_collected >= v_drop.max_deduction_per_user THEN
    RETURN jsonb_build_object('success', false, 'error', 'Max deduction reached');
  END IF;

  -- Calculate collection amount
  v_collect_amount := LEAST(v_drop.per_click_amount, v_drop.remaining_amount);

  IF v_collect_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No more drops available');
  END IF;

  -- Record collection
  INSERT INTO public.coin_drop_collections (drop_event_id, user_id, username, amount)
  VALUES (p_drop_event_id, p_user_id, p_username, v_collect_amount);

  -- Update remaining amount
  UPDATE public.coin_drop_events
  SET remaining_amount = remaining_amount - v_collect_amount
  WHERE id = p_drop_event_id;

  -- If green troll, add coins to collector. If red troll, deduct coins.
  IF v_drop.drop_type = 'green' THEN
    UPDATE public.user_profiles
    SET trollmonds = COALESCE(trollmonds, 0) + v_collect_amount
    WHERE id = p_user_id;
  ELSE
    UPDATE public.user_profiles
    SET trollmonds = GREATEST(0, COALESCE(trollmonds, 0) - v_collect_amount)
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', v_collect_amount, 'type', v_drop.drop_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DAILY FREE SPINS TRACKING
-- ============================================

-- Table to track free spins used per user per day
CREATE TABLE IF NOT EXISTS public.daily_free_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  spins_date DATE NOT NULL DEFAULT CURRENT_DATE,
  spins_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, spins_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_free_spins_user_date ON public.daily_free_spins(user_id, spins_date);

ALTER TABLE public.daily_free_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own free spins" ON public.daily_free_spins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage free spins" ON public.daily_free_spins
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update free spins" ON public.daily_free_spins
  FOR UPDATE USING (true);

-- RPC: Get today's free spins used count for a user
CREATE OR REPLACE FUNCTION public.get_daily_free_spins(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_spins_used INTEGER;
BEGIN
  SELECT spins_used INTO v_spins_used
  FROM public.daily_free_spins
  WHERE user_id = p_user_id AND spins_date = CURRENT_DATE;

  RETURN COALESCE(v_spins_used, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Increment daily free spins used for a user
CREATE OR REPLACE FUNCTION public.use_daily_free_spin(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_used INTEGER;
BEGIN
  -- Upsert the daily record
  INSERT INTO public.daily_free_spins (user_id, spins_date, spins_used, updated_at)
  VALUES (p_user_id, CURRENT_DATE, 1, now())
  ON CONFLICT (user_id, spins_date)
  DO UPDATE SET spins_used = public.daily_free_spins.spins_used + 1, updated_at = now()
  RETURNING spins_used INTO v_current_used;

  RETURN jsonb_build_object('success', true, 'spins_used', v_current_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get or create wheel session (for bankrupt/trolled tracking)
CREATE OR REPLACE FUNCTION public.get_or_create_wheel_session()
RETURNS TABLE(id UUID, user_id UUID, session_date DATE, bankrupt_landed BOOLEAN, total_spins INTEGER, created_at TIMESTAMPTZ) AS $$
DECLARE
  v_session RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Try to get today's session (using session_start date comparison)
  SELECT * INTO v_session
  FROM public.wheel_sessions
  WHERE user_id = v_user_id AND session_start::date = CURRENT_DATE
  ORDER BY session_start DESC
  LIMIT 1;

  -- Create if not exists
  IF NOT FOUND THEN
    INSERT INTO public.wheel_sessions (user_id, session_start, bankrupt_landed, total_spins)
    VALUES (v_user_id, now(), false, 0)
    RETURNING * INTO v_session;
  END IF;

  RETURN QUERY SELECT v_session.id, v_session.user_id, v_session.session_start::date, v_session.bankrupt_landed, v_session.total_spins, v_session.session_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
