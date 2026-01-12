-- Broadcast background themes catalog
CREATE TABLE IF NOT EXISTS public.broadcast_background_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  preview_url text,
  background_css text,
  background_asset_url text,
  price_coins integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  rarity text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- User purchases
CREATE TABLE IF NOT EXISTS public.user_broadcast_theme_purchases (
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.broadcast_background_themes(id) ON DELETE CASCADE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, theme_id)
);

-- User selection state
CREATE TABLE IF NOT EXISTS public.user_broadcast_theme_state (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  active_theme_id uuid REFERENCES public.broadcast_background_themes(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_theme_active ON public.broadcast_background_themes(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_broadcast_theme_purchases_user ON public.user_broadcast_theme_purchases(user_id);

ALTER TABLE public.broadcast_background_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_broadcast_theme_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_broadcast_theme_state ENABLE ROW LEVEL SECURITY;

-- Catalog read for all
DROP POLICY IF EXISTS "broadcast_theme_catalog_read" ON public.broadcast_background_themes;
CREATE POLICY "broadcast_theme_catalog_read"
  ON public.broadcast_background_themes
  FOR SELECT
  USING (true);

-- Catalog write: admin only
DROP POLICY IF EXISTS "broadcast_theme_catalog_admin_write" ON public.broadcast_background_themes;
CREATE POLICY "broadcast_theme_catalog_admin_write"
  ON public.broadcast_background_themes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

-- Purchases: users manage own
DROP POLICY IF EXISTS "broadcast_theme_purchases_read" ON public.user_broadcast_theme_purchases;
CREATE POLICY "broadcast_theme_purchases_read"
  ON public.user_broadcast_theme_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "broadcast_theme_purchases_insert" ON public.user_broadcast_theme_purchases;
CREATE POLICY "broadcast_theme_purchases_insert"
  ON public.user_broadcast_theme_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- State: users manage own
DROP POLICY IF EXISTS "broadcast_theme_state_read" ON public.user_broadcast_theme_state;
CREATE POLICY "broadcast_theme_state_read"
  ON public.user_broadcast_theme_state
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "broadcast_theme_state_write" ON public.user_broadcast_theme_state;
CREATE POLICY "broadcast_theme_state_write"
  ON public.user_broadcast_theme_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "broadcast_theme_state_update" ON public.user_broadcast_theme_state;
CREATE POLICY "broadcast_theme_state_update"
  ON public.user_broadcast_theme_state
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Expand coin transaction type constraint for theme purchases
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'coin_transactions'
      AND constraint_name = 'coin_transactions_type_check'
  ) THEN
    ALTER TABLE public.coin_transactions DROP CONSTRAINT coin_transactions_type_check;
    ALTER TABLE public.coin_transactions
      ADD CONSTRAINT coin_transactions_type_check CHECK (
        type IN (
          'store_purchase',
          'perk_purchase',
          'gift_send',
          'gift_receive',
          'kick_fee',
          'ban_fee',
          'cashout',
          'wheel_spin',
          'insurance_purchase',
          'broadcast_theme_purchase'
        )
      );
  END IF;
END $$;

-- Purchase + select RPC (atomic)
CREATE OR REPLACE FUNCTION public.purchase_broadcast_theme(
  p_user_id uuid,
  p_theme_id uuid,
  p_set_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price integer := 0;
  v_slug text;
  v_balance integer := 0;
BEGIN
  SELECT price_coins, slug
    INTO v_price, v_slug
  FROM public.broadcast_background_themes
  WHERE id = p_theme_id AND is_active = true
  LIMIT 1;

  IF v_slug IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Theme not found');
  END IF;

  SELECT troll_coins
    INTO v_balance
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_balance < v_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough coins');
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_price,
      total_spent_coins = COALESCE(total_spent_coins, 0) + v_price,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.user_broadcast_theme_purchases (user_id, theme_id)
  VALUES (p_user_id, p_theme_id)
  ON CONFLICT DO NOTHING;

  IF p_set_active THEN
    INSERT INTO public.user_broadcast_theme_state (user_id, active_theme_id, updated_at)
    VALUES (p_user_id, p_theme_id, now())
    ON CONFLICT (user_id)
    DO UPDATE SET active_theme_id = EXCLUDED.active_theme_id, updated_at = now();
  END IF;

  -- Log coin transaction if schema supports it
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'coin_transactions' AND column_name = 'amount'
    ) THEN
      EXECUTE
        'INSERT INTO public.coin_transactions (user_id, type, amount, description, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, now())'
      USING p_user_id, 'broadcast_theme_purchase', v_price,
            format('Broadcast theme purchase: %s', v_slug),
            jsonb_build_object('type','broadcast_theme_purchase','theme_slug',v_slug,'theme_id',p_theme_id);
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'coin_transactions' AND column_name = 'coins'
    ) THEN
      EXECUTE
        'INSERT INTO public.coin_transactions (user_id, type, coins, description, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, now())'
      USING p_user_id, 'broadcast_theme_purchase', v_price,
            format('Broadcast theme purchase: %s', v_slug),
            jsonb_build_object('type','broadcast_theme_purchase','theme_slug',v_slug,'theme_id',p_theme_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'theme_id', p_theme_id,
    'theme_slug', v_slug,
    'price', v_price
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_active_broadcast_theme(
  p_user_id uuid,
  p_theme_id uuid DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owned boolean := false;
BEGIN
  IF p_theme_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_broadcast_theme_purchases
      WHERE user_id = p_user_id AND theme_id = p_theme_id
    )
    INTO v_owned;

    IF NOT v_owned THEN
      RETURN jsonb_build_object('success', false, 'error', 'Theme not owned');
    END IF;
  END IF;

  INSERT INTO public.user_broadcast_theme_state (user_id, active_theme_id, updated_at)
  VALUES (p_user_id, p_theme_id, now())
  ON CONFLICT (user_id)
  DO UPDATE SET active_theme_id = EXCLUDED.active_theme_id, updated_at = now();

  RETURN jsonb_build_object('success', true, 'active_theme_id', p_theme_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_broadcast_theme(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_broadcast_theme(uuid, uuid) TO authenticated;

-- Seed starter themes
INSERT INTO public.broadcast_background_themes (slug, name, preview_url, background_css, price_coins, is_active, rarity, sort_order)
VALUES
  ('neon-aurora', 'Neon Aurora', 'https://placehold.co/600x300/0b0f2b/42a8ff?text=Neon+Aurora', 'radial-gradient(circle at 20% 20%, rgba(66,168,255,0.35), transparent 45%), radial-gradient(circle at 80% 30%, rgba(255,58,200,0.35), transparent 45%), #0b0f2b', 1200, true, 'rare', 10),
  ('pink-velocity', 'Pink Velocity', 'https://placehold.co/600x300/12051f/ff3ac8?text=Pink+Velocity', 'linear-gradient(135deg, #0b0616 0%, #12051f 45%, #2a0a33 100%)', 800, true, 'common', 20),
  ('cyan-fog', 'Cyan Fog', 'https://placehold.co/600x300/040b18/23d7ff?text=Cyan+Fog', 'radial-gradient(circle at 50% 40%, rgba(35,215,255,0.3), transparent 50%), #040b18', 600, true, 'common', 30),
  ('neon-circuit', 'Neon Circuit', 'https://placehold.co/600x300/0a0f26/7cc9ff?text=Neon+Circuit', 'linear-gradient(160deg, #060916 0%, #0a0f26 60%, #1b0f2e 100%)', 1500, true, 'rare', 40),
  ('pink-haze', 'Pink Haze', 'https://placehold.co/600x300/0c0718/ff2f98?text=Pink+Haze', 'radial-gradient(circle at 70% 20%, rgba(255,47,152,0.35), transparent 50%), #0c0718', 900, true, 'common', 50),
  ('galaxy-warp', 'Galaxy Warp', 'https://placehold.co/600x300/050811/4fc3ff?text=Galaxy+Warp', 'radial-gradient(circle at 40% 30%, rgba(79,195,255,0.35), transparent 45%), radial-gradient(circle at 70% 60%, rgba(255,72,209,0.35), transparent 45%), #050811', 2000, true, 'epic', 60),
  ('cyber-rose', 'Cyber Rose', 'https://placehold.co/600x300/120814/ff7ad9?text=Cyber+Rose', 'linear-gradient(120deg, #080515 0%, #120814 45%, #240a2a 100%)', 1800, true, 'epic', 70),
  ('stormlight', 'Stormlight', 'https://placehold.co/600x300/060b14/38f2ff?text=Stormlight', 'radial-gradient(circle at 50% 50%, rgba(56,242,255,0.3), transparent 55%), #060b14', 1400, true, 'rare', 80),
  ('midnight-surge', 'Midnight Surge', 'https://placehold.co/600x300/05040f/2aa8ff?text=Midnight+Surge', 'linear-gradient(140deg, #05040f 0%, #0b0a2a 50%, #1a0c2f 100%)', 700, true, 'common', 90),
  ('pink-static', 'Pink Static', 'https://placehold.co/600x300/0b0612/ff3ac8?text=Pink+Static', 'radial-gradient(circle at 30% 60%, rgba(255,58,200,0.3), transparent 55%), #0b0612', 1100, true, 'rare', 100)
ON CONFLICT (slug) DO NOTHING;
