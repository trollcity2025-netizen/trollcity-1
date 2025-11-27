-- Fix support_tickets table to match application usage
-- Add missing columns that the Support page expects

ALTER TABLE public.support_tickets
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
ADD COLUMN IF NOT EXISTS message text,
ADD COLUMN IF NOT EXISTS admin_response text;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tickets
CREATE POLICY IF NOT EXISTS "Users can view own tickets"
ON public.support_tickets
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() IN (
  SELECT id FROM public.user_profiles WHERE role = 'admin'
));

-- Policy: Users can insert their own tickets
CREATE POLICY IF NOT EXISTS "Users can insert own tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all tickets
CREATE POLICY IF NOT EXISTS "Admins can view all tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Admins can update all tickets
CREATE POLICY IF NOT EXISTS "Admins can update all tickets"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Grant permissions
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT UPDATE ON public.support_tickets TO authenticated;
