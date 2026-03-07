-- ============================================================================
-- Troll Wheel Enhanced Features
-- - Ghost Mode: Hide user from broadcast/live chat for 24 hrs
-- - Featured Broadcaster: Feature on live now page for 30 minutes
-- - Troll Wheel Balance: Separate balance for wheel game
-- - Inventory System: Store items won from wheel
-- ============================================================================

-- 1. Add ghost_mode and featured columns to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS ghost_mode_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS featured_broadcaster_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS wheel_balance BIGINT DEFAULT 0;

-- 2. Create wheel_inventory table for storing won items
CREATE TABLE IF NOT EXISTS public.wheel_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'free_perk', 'free_insurance', 'free_entrance', 'ghost_mode', 'featured_broadcaster'
  item_name TEXT NOT NULL,
  item_description TEXT,
  is_active BOOLEAN DEFAULT false,
  won_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ
);

-- 3. Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_wheel_inventory_user_id ON public.wheel_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_wheel_inventory_active ON public.wheel_inventory(user_id, is_active) WHERE is_active = true;

-- 4. Enable RLS on wheel_inventory
ALTER TABLE public.wheel_inventory ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for wheel_inventory
DROP POLICY IF EXISTS "Users can manage their wheel inventory" ON public.wheel_inventory;
CREATE POLICY "Users can manage their wheel inventory" ON public.wheel_inventory
  FOR ALL USING (auth.uid() = user_id);

-- 6. Add session tracking for bankrupt guarantee
CREATE TABLE IF NOT EXISTS public.wheel_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  session_start TIMESTAMPTZ DEFAULT now(),
  bankrupt_landed BOOLEAN DEFAULT false,
  total_spins INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_wheel_sessions_user ON public.wheel_sessions(user_id, session_start DESC);

ALTER TABLE public.wheel_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their wheel sessions" ON public.wheel_sessions;
CREATE POLICY "Users can manage their wheel sessions" ON public.wheel_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 7. Add RPC function to activate inventory item
CREATE OR REPLACE FUNCTION public.activate_wheel_inventory_item(p_item_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_item RECORD;
  v_user_id UUID;
BEGIN
  -- Get the current user
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the item
  SELECT * INTO v_item
  FROM wheel_inventory
  WHERE id = p_item_id AND user_id = v_user_id AND is_active = false;

  IF v_item IS NULL THEN
    RETURN false;
  END IF;

  -- Activate the item based on type
  IF v_item.item_type = 'ghost_mode' THEN
    UPDATE user_profiles
    SET ghost_mode_until = NOW() + INTERVAL '24 hours'
    WHERE id = v_user_id;
  ELSIF v_item.item_type = 'featured_broadcaster' THEN
    UPDATE user_profiles
    SET featured_broadcaster_until = NOW() + INTERVAL '30 minutes'
    WHERE id = v_user_id;
  END IF;

  -- Mark item as activated
  UPDATE wheel_inventory
  SET is_active = true, activated_at = NOW()
  WHERE id = p_item_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add RPC function to get wheel inventory
CREATE OR REPLACE FUNCTION public.get_wheel_inventory()
RETURNS TABLE(
  id UUID,
  item_type TEXT,
  item_name TEXT,
  item_description TEXT,
  is_active BOOLEAN,
  won_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wi.id,
    wi.item_type,
    wi.item_name,
    wi.item_description,
    wi.is_active,
    wi.won_at,
    wi.expires_at,
    wi.activated_at
  FROM wheel_inventory wi
  WHERE wi.user_id = auth.uid()
  ORDER BY wi.won_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Add RPC function to add item to wheel inventory
CREATE OR REPLACE FUNCTION public.add_wheel_inventory_item(
  p_user_id UUID,
  p_item_type TEXT,
  p_item_name TEXT,
  p_item_description TEXT DEFAULT NULL,
  pexpires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_item_id UUID;
BEGIN
  INSERT INTO wheel_inventory (user_id, item_type, item_name, item_description, expires_at)
  VALUES (p_user_id, p_item_type, p_item_name, p_item_description, pexpires_at)
  RETURNING id INTO v_item_id;

  RETURN v_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Add RPC function to get or create wheel session
CREATE OR REPLACE FUNCTION public.get_or_create_wheel_session()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  session_start TIMESTAMPTZ,
  bankrupt_landed BOOLEAN,
  total_spins INTEGER
) AS $$
DECLARE
  v_session RECORD;
  v_user_id UUID;
  v_today DATE;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_today := CURRENT_DATE;

  -- Check for existing session today
  SELECT * INTO v_session
  FROM wheel_sessions
  WHERE user_id = v_user_id 
    AND DATE(session_start) = v_today
  ORDER BY session_start DESC
  LIMIT 1;

  -- Create new session if none exists
  IF v_session IS NULL THEN
    INSERT INTO wheel_sessions (user_id, session_start, bankrupt_landed, total_spins)
    VALUES (v_user_id, NOW(), false, 0)
    RETURNING * INTO v_session;
  END IF;

  RETURN QUERY SELECT v_session.id, v_session.user_id, v_session.session_start, v_session.bankrupt_landed, v_session.total_spins;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Add RPC function to update wheel session (mark bankrupt landed)
CREATE OR REPLACE FUNCTION public.update_wheel_session_bankrupt(p_session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE wheel_sessions
  SET bankrupt_landed = true
  WHERE id = p_session_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Add RPC function to increment spin count
CREATE OR REPLACE FUNCTION public.increment_wheel_spin(p_session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE wheel_sessions
  SET total_spins = total_spins + 1
  WHERE id = p_session_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Add RPC to add troll wheel balance
CREATE OR REPLACE FUNCTION public.add_wheel_balance(p_user_id UUID, p_amount BIGINT)
RETURNS BIGINT AS $$
DECLARE
  v_new_balance BIGINT;
BEGIN
  UPDATE user_profiles
  SET wheel_balance = COALESCE(wheel_balance, 0) + p_amount
  WHERE id = p_user_id
  RETURNING wheel_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Add RPC to get wheel balance
CREATE OR REPLACE FUNCTION public.get_wheel_balance(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  SELECT COALESCE(wheel_balance, 0) INTO v_balance
  FROM user_profiles
  WHERE id = p_user_id;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.activate_wheel_inventory_item TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wheel_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_wheel_inventory_item TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_wheel_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_wheel_session_bankrupt TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_wheel_spin TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_wheel_balance TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wheel_balance TO authenticated;

GRANT SELECT ON wheel_inventory TO authenticated;
GRANT SELECT ON wheel_sessions TO authenticated;
