-- Migration: create square_transactions table to track all Square payments
CREATE TABLE IF NOT EXISTS public.square_transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  square_transaction_id TEXT UNIQUE NOT NULL,
  square_payment_id TEXT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- 'coin_purchase', 'payout', 'refund', etc.
  amount_cents INTEGER NOT NULL, -- Amount in cents
  currency VARCHAR(3) DEFAULT 'USD',
  fee_cents INTEGER DEFAULT 0, -- Processing fee in cents
  net_cents INTEGER, -- Amount after fees
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'completed', 'failed', 'pending', 'cancelled'
  description TEXT,
  metadata JSONB DEFAULT '{}',
  receipt_url TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_square_transactions_user_id ON public.square_transactions (user_id);
CREATE INDEX idx_square_transactions_square_payment_id ON public.square_transactions (square_payment_id);
CREATE INDEX idx_square_transactions_status ON public.square_transactions (status);
CREATE INDEX idx_square_transactions_created_date ON public.square_transactions (created_date);
