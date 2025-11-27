-- ============================================
-- SUPPORT TICKETS TABLE - COMPLETE SETUP
-- ============================================
-- This creates the support_tickets table with all required columns
-- and proper permissions for the admin dashboard

-- Drop existing table if any (to start fresh)
DROP TABLE IF EXISTS public.support_tickets CASCADE;

-- Create support_tickets table with all required columns
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  email text,
  subject text,
  category text DEFAULT 'general',
  message text,
  body text,
  status text NOT NULL DEFAULT 'open',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can insert own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;

-- Policy: Users can view their own tickets
CREATE POLICY "Users can view own tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own tickets
CREATE POLICY "Users can insert own tickets"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Admins can update all tickets (for responses)
CREATE POLICY "Admins can update all tickets"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT UPDATE ON public.support_tickets TO authenticated;
GRANT SELECT ON public.support_tickets TO anon;

-- Verify table creation
SELECT 
  'support_tickets table created successfully' as message,
  COUNT(*) as current_ticket_count
FROM public.support_tickets;
