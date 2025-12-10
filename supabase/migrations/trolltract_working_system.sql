-- TrollTract Working System Implementation
-- Production-ready SQL with RPC functions

-- 1) PROFILE FIELDS
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_trolltract boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trolltract_activated_at timestamptz;

-- 2) WALLET TABLE (SAFE CREATE)
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  paid_coins bigint NOT NULL DEFAULT 0,
  free_coins bigint NOT NULL DEFAULT 0,
  trollmonds bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for wallets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallets'
      AND policyname = 'wallets self access'
  ) THEN
    CREATE POLICY "wallets self access"
      ON public.wallets
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallets'
      AND policyname = 'wallets self update'
  ) THEN
    CREATE POLICY "wallets self update"
      ON public.wallets
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallets'
      AND policyname = 'wallets self insert'
  ) THEN
    CREATE POLICY "wallets self insert"
      ON public.wallets
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3) TROLLTRACT BONUS LOG (OPTIONAL BUT USEFUL)
CREATE TABLE IF NOT EXISTS public.trolltract_bonus_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  gift_id uuid,
  stream_id uuid,
  base_amount bigint NOT NULL,
  bonus_amount bigint NOT NULL,
  total_amount bigint NOT NULL,
  sender_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trolltract_bonus_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bonus log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='trolltract_bonus_log'
      AND policyname='trolltract_bonus self access'
  ) THEN
    CREATE POLICY "trolltract_bonus self access"
      ON public.trolltract_bonus_log
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='trolltract_bonus_log'
      AND policyname='trolltract_bonus service insert'
  ) THEN
    CREATE POLICY "trolltract_bonus service insert"
      ON public.trolltract_bonus_log
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- 4) MAIN RPC: ACTIVATE TROLLTRACT
DROP FUNCTION IF EXISTS public.activate_trolltract();

CREATE OR REPLACE FUNCTION public.activate_trolltract()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_wallet   public.wallets;
  v_profile  public.user_profiles;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  END IF;

  -- Get current wallet
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NO_WALLET');
  END IF;

  -- Check if already activated
  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF v_profile.is_trolltract THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_ACTIVATED');
  END IF;

  -- Check coin balance
  IF v_wallet.paid_coins < 20000 THEN
    RETURN jsonb_build_object(
      'ok', 
      false, 
      'code', 
      'NOT_ENOUGH_COINS',
      'current_coins',
      v_wallet.paid_coins,
      'required_coins',
      20000
    );
  END IF;

  -- Start transaction
  BEGIN
    -- Deduct coins from wallet
    UPDATE public.wallets
    SET paid_coins = paid_coins - 20000,
        updated_at = now()
    WHERE user_id = v_user_id;

    -- Activate TrollTract contract
    UPDATE public.user_profiles
    SET is_trolltract = true,
        trolltract_activated_at = now()
    WHERE id = v_user_id;

    -- Log the activation
    INSERT INTO public.trolltract_bonus_log (
      user_id,
      base_amount,
      bonus_amount,
      total_amount,
      gift_id,
      stream_id,
      sender_id
    ) VALUES (
      v_user_id,
      0,
      0,
      0,
      NULL,
      NULL,
      NULL
    );

    RETURN jsonb_build_object('ok', true, 'code', 'ACTIVATED');
  EXCEPTION WHEN OTHERS THEN
    -- Rollback on any error
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSACTION_ERROR');
  END;
END;
$$;

-- Allow authenticated users to call the function
GRANT EXECUTE ON FUNCTION public.activate_trolltract() TO authenticated;

-- 5) GET TROLLTRACT STATUS RPC
DROP FUNCTION IF EXISTS public.get_trolltract_status();

CREATE OR REPLACE FUNCTION public.get_trolltract_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile  public.user_profiles;
  v_wallet   public.wallets;
  v_bonus_total bigint := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  END IF;

  -- Get profile and wallet data
  SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_user_id;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user_id;

  -- Get total bonus earned
  SELECT COALESCE(SUM(bonus_amount), 0) INTO v_bonus_total
  FROM public.trolltract_bonus_log
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'is_trolltract', COALESCE(v_profile.is_trolltract, false),
    'activated_at', v_profile.trolltract_activated_at,
    'paid_coins', COALESCE(v_wallet.paid_coins, 0),
    'total_bonus', v_bonus_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trolltract_status() TO authenticated;

-- 6) INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_trolltract_bonus_user_id ON public.trolltract_bonus_log(user_id);
CREATE INDEX IF NOT EXISTS idx_trolltract_bonus_created_at ON public.trolltract_bonus_log(created_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_trolltract ON public.user_profiles(is_trolltract) WHERE is_trolltract = true;

-- 7) COMMENTS FOR DOCUMENTATION
COMMENT ON TABLE public.wallets IS 'User wallet with coin balances';
COMMENT ON TABLE public.trolltract_bonus_log IS 'Log of TrollTract bonus earnings';
COMMENT ON FUNCTION public.activate_trolltract() IS 'Activate TrollTract contract by deducting 20,000 coins';
COMMENT ON FUNCTION public.get_trolltract_status() IS 'Get current TrollTract status and wallet info';