-- Enable required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core profile table (if missing)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY,
  username text NOT NULL DEFAULT '',
  avatar_url text,
  bio text,
  role text NOT NULL DEFAULT 'user',
  tier text NOT NULL DEFAULT 'Bronze',
  paid_coin_balance integer NOT NULL DEFAULT 0,
  free_coin_balance integer NOT NULL DEFAULT 200,
  total_earned_coins integer NOT NULL DEFAULT 0,
  total_spent_coins integer NOT NULL DEFAULT 0,
  sav_bonus_coins integer DEFAULT 0,
  vived_bonus_coins integer DEFAULT 0,
  insurance_level text,
  insurance_expires_at timestamptz,
  no_kick_until timestamptz,
  no_ban_until timestamptz,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  amount integer NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coin_tx_user_idx ON public.coin_transactions(user_id);

-- Payment methods
CREATE TABLE IF NOT EXISTS public.user_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  display_name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS upm_user_idx ON public.user_payment_methods(user_id);

-- Payouts and cashouts
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coins_used integer NOT NULL DEFAULT 0,
  cash_amount numeric(12,2) DEFAULT 0,
  processing_fee numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cashout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requested_coins integer NOT NULL DEFAULT 0,
  usd_value numeric(12,2) DEFAULT 0,
  payout_method text,
  username text,
  email text,
  payout_details jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cashout_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_amount integer NOT NULL,
  cash_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  processing_fee_percentage numeric(6,3) NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Admin flags and bans
CREATE TABLE IF NOT EXISTS public.admin_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- Notifications and support
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Families
CREATE TABLE IF NOT EXISTS public.troll_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_emoji text,
  banner_url text,
  description text,
  level integer NOT NULL DEFAULT 1,
  total_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.troll_family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  family_id uuid,
  approved boolean NOT NULL DEFAULT false,
  has_crown_badge boolean NOT NULL DEFAULT false,
  role text DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tfm_user_idx ON public.troll_family_members(user_id);

-- RPC stub used by FamilyCityMap
CREATE OR REPLACE FUNCTION public.get_weekly_family_task_counts()
RETURNS TABLE (id uuid, name text, task_count integer)
LANGUAGE sql STABLE AS $$
  SELECT id, name, 0::int AS task_count FROM public.troll_families ORDER BY name;
$$;

