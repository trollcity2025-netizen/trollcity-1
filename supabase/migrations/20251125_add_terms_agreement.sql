-- Add terms_accepted column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false;

-- Create user_agreements table to log all acceptances
CREATE TABLE IF NOT EXISTS public.user_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_agreements_user_id ON public.user_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_agreements_agreed_at ON public.user_agreements(agreed_at);

-- Enable RLS
ALTER TABLE public.user_agreements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own agreements
CREATE POLICY "Users can view own agreements"
ON public.user_agreements
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own agreements
CREATE POLICY "Users can insert own agreements"
ON public.user_agreements
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all agreements
CREATE POLICY "Admins can view all agreements"
ON public.user_agreements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Set admin to already accepted (bypass for admin)
UPDATE public.user_profiles
SET terms_accepted = true
WHERE role = 'admin';
