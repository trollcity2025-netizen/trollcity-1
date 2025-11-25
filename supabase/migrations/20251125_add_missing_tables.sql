-- Create additional tables referenced by the app (safe IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id uuid NOT NULL,
  title text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'ended',
  start_time timestamptz,
  end_time timestamptz,
  current_viewers integer DEFAULT 0,
  total_gifts_coins bigint DEFAULT 0,
  total_unique_gifters integer DEFAULT 0,
  agora_channel text,
  agora_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid,
  user_id uuid NOT NULL,
  receiver_id uuid,
  content text,
  message_type text,
  gift_amount integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid,
  user_id uuid,
  gift_name text,
  amount integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stream_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL,
  severity text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.officer_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_entrance_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  effect_id text NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coins_purchased bigint,
  amount_paid numeric(12,2),
  square_transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coin_packages (
  id text PRIMARY KEY,
  name text NOT NULL,
  coin_amount bigint NOT NULL,
  price numeric(12,2) NOT NULL,
  currency text DEFAULT 'USD',
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

