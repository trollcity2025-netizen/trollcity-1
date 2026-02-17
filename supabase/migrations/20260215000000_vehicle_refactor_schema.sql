-- Create car_shells_catalog table
CREATE TABLE public.car_shells_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    base_model_url TEXT,
    price INTEGER NOT NULL,
    image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create part_type ENUM
CREATE TYPE part_type AS ENUM ('engine', 'transmission', 'suspension', 'tires', 'bodykit', 'spoiler', 'interior', 'paint', 'other');

-- Create car_parts_catalog table
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

-- Create user_cars table (replaces user_vehicles conceptually)
CREATE TABLE public.user_cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    shell_id UUID NOT NULL REFERENCES public.car_shells_catalog(id),
    current_paint_color TEXT DEFAULT '#FFFFFF',
    current_condition INTEGER DEFAULT 100,
    is_impounded BOOLEAN DEFAULT FALSE,
    impounded_at TIMESTAMPTZ,
    impound_reason TEXT,
    insurance_status TEXT DEFAULT 'none', -- 'active', 'expired', 'grace', 'repossessable'
    repo_status TEXT DEFAULT 'none', -- 'none', 'flagged', 'scheduled', 'repossessed'
    is_listed_for_sale BOOLEAN DEFAULT FALSE,
    asking_price INTEGER,
    listed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_car_parts table
CREATE TABLE public.user_car_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_car_id UUID NOT NULL REFERENCES public.user_cars(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES public.car_parts_catalog(id),
    installed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add fuel_type and weight to vehicles_catalog (existing table modification)
ALTER TABLE public.vehicles_catalog
ADD COLUMN fuel_type TEXT NOT NULL DEFAULT 'Gas',
ADD COLUMN weight INTEGER NOT NULL DEFAULT 1000;

-- Optional: Add RLS policies for new tables
ALTER TABLE public.car_shells_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all car shells" ON public.car_shells_catalog FOR SELECT USING (TRUE);

ALTER TABLE public.car_parts_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all car parts" ON public.car_parts_catalog FOR SELECT USING (TRUE);

ALTER TABLE public.user_cars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable owner to manage their cars"
ON public.user_cars
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable read access for listed cars for all"
ON public.user_cars
FOR SELECT
TO authenticated
USING (is_listed_for_sale = TRUE);

ALTER TABLE public.user_car_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable owner to manage their car parts"
ON public.user_car_parts
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_cars uc WHERE uc.id = user_car_id AND uc.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_cars uc WHERE uc.id = user_car_id AND uc.user_id = auth.uid()));

