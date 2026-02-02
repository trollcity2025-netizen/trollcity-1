-- Enable RLS on gift_items
ALTER TABLE public.gift_items ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read gift items
CREATE POLICY "Public read access" 
ON public.gift_items 
FOR SELECT 
USING (true);

-- Allow service role full access (default, but good to be explicit if needed, though service role bypasses RLS)
-- No need for specific service role policy as it bypasses RLS.

-- Grant access to authenticated and anon roles
GRANT SELECT ON public.gift_items TO authenticated, anon;
