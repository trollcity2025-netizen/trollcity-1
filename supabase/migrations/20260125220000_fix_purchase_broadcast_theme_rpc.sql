-- Migration: Fix purchase_broadcast_theme RPC ambiguity

-- Drop all known conflicting versions of the function
DROP FUNCTION IF EXISTS public.purchase_broadcast_theme(boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public.purchase_broadcast_theme(uuid, text, boolean);

-- Recreate the function with the correct signature
CREATE OR REPLACE FUNCTION public.purchase_broadcast_theme(
  p_user_id uuid,
  p_theme_id text,
  p_set_active boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_theme record;
  v_spend_result jsonb;
  v_cost int;
BEGIN
  -- 1. Get theme details
  SELECT * INTO v_theme
  FROM public.broadcast_background_themes
  WHERE id = p_theme_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Theme not found');
  END IF;

  v_cost := COALESCE(v_theme.price_coins, 0);

  -- 2. Check if already owned
  IF EXISTS (
    SELECT 1 FROM public.user_broadcast_theme_purchases
    WHERE user_id = p_user_id AND theme_id = p_theme_id
  ) THEN
    -- Already owned, just activate if requested
    IF p_set_active THEN
      INSERT INTO public.user_broadcast_theme_state (user_id, active_theme_id, updated_at)
      VALUES (p_user_id, p_theme_id, now())
      ON CONFLICT (user_id) DO UPDATE
      SET active_theme_id = EXCLUDED.active_theme_id,
          updated_at = now();
    END IF;
    RETURN jsonb_build_object('success', true, 'message', 'Already owned');
  END IF;

  -- 3. Deduct coins if cost > 0
  IF v_cost > 0 THEN
    v_spend_result := public.troll_bank_spend_coins_secure(
      p_user_id,
      v_cost,
      'paid',
      'broadcast_theme_purchase',
      NULL,
      jsonb_build_object('theme_id', p_theme_id, 'theme_name', v_theme.name)
    );

    IF (v_spend_result->>'success')::boolean = false THEN
      RETURN v_spend_result;
    END IF;
  END IF;

  -- 4. Record purchase
  INSERT INTO public.user_broadcast_theme_purchases (user_id, theme_id, purchased_at, cost)
  VALUES (p_user_id, p_theme_id, now(), v_cost);

  -- 5. Activate if requested
  IF p_set_active THEN
    INSERT INTO public.user_broadcast_theme_state (user_id, active_theme_id, updated_at)
    VALUES (p_user_id, p_theme_id, now())
    ON CONFLICT (user_id) DO UPDATE
    SET active_theme_id = EXCLUDED.active_theme_id,
        updated_at = now();
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
