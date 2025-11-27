-- Ensure cashout_requests table exists with all required columns
-- Run this in Supabase SQL Editor if you're getting errors

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.cashout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  username text,
  full_name text,
  email text,
  payout_method text CHECK (payout_method IN ('PayPal', 'CashApp', 'Venmo')) NOT NULL,
  payout_details text NOT NULL,
  requested_coins integer NOT NULL,
  usd_value numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  user_confirmation boolean DEFAULT false,
  fee_applied numeric(12,2),
  usd_after_fee numeric(12,2),
  transaction_ref text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own cashout requests" ON public.cashout_requests;
DROP POLICY IF EXISTS "Users can create own cashout requests" ON public.cashout_requests;
DROP POLICY IF EXISTS "Admins can view all cashout requests" ON public.cashout_requests;
DROP POLICY IF EXISTS "Admins can update cashout requests" ON public.cashout_requests;

-- Recreate policies
CREATE POLICY "Users can view own cashout requests" 
  ON public.cashout_requests FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cashout requests" 
  ON public.cashout_requests FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all cashout requests" 
  ON public.cashout_requests FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update cashout requests" 
  ON public.cashout_requests FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_cashout_requests ON public.cashout_requests;
CREATE TRIGGER set_timestamp_cashout_requests
  BEFORE UPDATE ON public.cashout_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_timestamp();

-- Grant permissions
GRANT SELECT, INSERT ON public.cashout_requests TO authenticated;
GRANT ALL ON public.cashout_requests TO service_role;
