-- Fix property_types table seeding issue
-- This migration ensures property_types has all required records

-- First, ensure the table exists
CREATE TABLE IF NOT EXISTS public.property_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_rent INTEGER DEFAULT 1000,
    base_utilities INTEGER DEFAULT 100,
    max_occupants INTEGER DEFAULT 2,
    purchase_price INTEGER DEFAULT 10000
);

-- Insert or update the core property types
-- Using ON CONFLICT to safely handle existing records
INSERT INTO public.property_types (id, name, base_rent, base_utilities, max_occupants, purchase_price) VALUES
('trailer', 'Trailer', 500, 50, 1, 5000),
('apartment', 'Apartment', 1500, 150, 2, 20000),
('house', 'House', 3000, 300, 4, 100000),
('mansion', 'Mansion', 10000, 1000, 10, 1000000)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    base_rent = EXCLUDED.base_rent,
    base_utilities = EXCLUDED.base_utilities,
    max_occupants = EXCLUDED.max_occupants,
    purchase_price = EXCLUDED.purchase_price;

-- Ensure RLS is enabled
ALTER TABLE public.property_types ENABLE ROW LEVEL SECURITY;

-- Ensure public read policy exists
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public read property types" ON public.property_types;
    CREATE POLICY "Public read property types" ON public.property_types FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
