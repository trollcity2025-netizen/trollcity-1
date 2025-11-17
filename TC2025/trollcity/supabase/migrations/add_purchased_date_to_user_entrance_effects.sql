-- Add purchased_date column to user_entrance_effects table
ALTER TABLE public.user_entrance_effects 
ADD COLUMN IF NOT EXISTS purchased_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();