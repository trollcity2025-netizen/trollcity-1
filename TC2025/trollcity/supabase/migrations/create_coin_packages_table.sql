-- Create coin_packages table
CREATE TABLE IF NOT EXISTS public.coin_packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    coin_amount INTEGER NOT NULL CHECK (coin_amount > 0),
    price_usd NUMERIC(10,2) NOT NULL CHECK (price_usd > 0),
    bonus_coins INTEGER DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON public.coin_packages TO anon;
GRANT SELECT ON public.coin_packages TO authenticated;
GRANT ALL ON public.coin_packages TO service_role;