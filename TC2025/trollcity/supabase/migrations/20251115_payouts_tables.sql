-- Create payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payout_method TEXT NOT NULL,
  details TEXT,
  approval_level INTEGER DEFAULT 0,
  approved_by_admin BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMP DEFAULT NULL,
  approval_notes TEXT DEFAULT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'failed')),
  transaction_id TEXT DEFAULT NULL,
  processed_at TIMESTAMP DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON public.payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_approval ON public.payouts(approved_by_admin, status);

-- Create square_payouts table
CREATE TABLE IF NOT EXISTS public.square_payouts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payout_id INTEGER NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  square_customer_id TEXT NOT NULL,
  square_payment_id TEXT DEFAULT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create cashapp_payouts table
CREATE TABLE IF NOT EXISTS public.cashapp_payouts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payout_id INTEGER NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  cashapp_tag TEXT NOT NULL,
  cashtag_payment_id TEXT DEFAULT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_payouts_updated_at BEFORE UPDATE ON public.payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_square_payouts_updated_at BEFORE UPDATE ON public.square_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cashapp_payouts_updated_at BEFORE UPDATE ON public.cashapp_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();