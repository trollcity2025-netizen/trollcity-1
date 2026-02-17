-- Recreate part_type ENUM
CREATE TYPE part_type AS ENUM ('engine', 'transmission', 'suspension', 'tires', 'bodykit', 'spoiler', 'interior', 'paint', 'other');

-- Recreate car_parts_catalog table
CREATE TABLE public.car_parts_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    part_type part_type NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    image TEXT,
    model_url TEXT,
    speed_bonus INTEGER DEFAULT 0,
    armor_bonus INTEGER DEFAULT 0,
    weight_modifier INTEGER DEFAULT 0,
    handling_modifier INTEGER DEFAULT 0,
    fuel_efficiency_modifier NUMERIC DEFAULT 0.0,
    attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for car_parts_catalog
ALTER TABLE public.car_parts_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all car parts" ON public.car_parts_catalog FOR SELECT USING (TRUE);