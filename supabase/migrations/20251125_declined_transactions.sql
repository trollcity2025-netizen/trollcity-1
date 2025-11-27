-- Create declined_transactions table to track payment failures
CREATE TABLE IF NOT EXISTS public.declined_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.coin_packages(id) ON DELETE SET NULL,
  amount_usd decimal(10,2),
  currency text DEFAULT 'USD',
  error_code text,
  error_message text,
  error_details jsonb,
  payment_provider text DEFAULT 'square',
  source_id text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add index for admin queries
CREATE INDEX IF NOT EXISTS idx_declined_user_id ON public.declined_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_declined_created_at ON public.declined_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.declined_transactions ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all declined transactions
CREATE POLICY "Admins can view declined transactions"
ON public.declined_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Allow users to view their own declined transactions
CREATE POLICY "Users can view own declined transactions"
ON public.declined_transactions
FOR SELECT
USING (auth.uid() = user_id);
