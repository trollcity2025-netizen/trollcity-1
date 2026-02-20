-- Migration: create coin_packs and coin_purchases minimal tables if not exists
CREATE TABLE IF NOT EXISTS public.coin_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  usd_amount numeric(10,2) NOT NULL,
  coin_amount bigint NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coin_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pack_id uuid NOT NULL,
  transaction_id text UNIQUE,
  usd_amount numeric(10,2) NOT NULL,
  coin_amount bigint NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Wallets: if existing wallets/user_wallets present, skip; otherwise create simple wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  coin_balance bigint DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
