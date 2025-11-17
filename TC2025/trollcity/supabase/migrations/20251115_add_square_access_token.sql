-- Add square_access_token to earnings_config table
ALTER TABLE public.earnings_config 
ADD COLUMN IF NOT EXISTS square_access_token TEXT;

-- Grant permissions for the new column
GRANT SELECT (square_access_token) ON public.earnings_config TO anon;
GRANT UPDATE (square_access_token) ON public.earnings_config TO authenticated;