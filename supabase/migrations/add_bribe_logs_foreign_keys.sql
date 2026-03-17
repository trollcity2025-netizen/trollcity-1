-- Add explicit foreign key constraints for bribe_logs table
-- This enables Supabase to discover the relationships for JOIN queries

-- Drop existing inline foreign keys and recreate with explicit names
ALTER TABLE public.bribe_logs 
DROP CONSTRAINT IF EXISTS bribe_logs_briber_id_fkey,
DROP CONSTRAINT IF EXISTS bribe_logs_bribee_id_fkey,
DROP CONSTRAINT IF EXISTS bribe_logs_exposed_by_fkey;

-- Add briber_id foreign key with explicit constraint name
ALTER TABLE public.bribe_logs 
ADD CONSTRAINT bribe_logs_from_user_fkey 
FOREIGN KEY (briber_id) 
REFERENCES public.user_profiles(id) 
ON DELETE CASCADE;

-- Add bribee_id foreign key with explicit constraint name
ALTER TABLE public.bribe_logs 
ADD CONSTRAINT bribe_logs_to_user_fkey 
FOREIGN KEY (bribee_id) 
REFERENCES public.user_profiles(id) 
ON DELETE SET NULL;

-- Add exposed_by foreign key with explicit constraint name  
ALTER TABLE public.bribe_logs 
ADD CONSTRAINT bribe_logs_exposed_by_fkey 
FOREIGN KEY (exposed_by) 
REFERENCES public.user_profiles(id) 
ON DELETE SET NULL;
