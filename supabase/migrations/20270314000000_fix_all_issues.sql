-- Fix missing columns in notifications table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_dismissed') THEN
        ALTER TABLE public.notifications ADD COLUMN is_dismissed BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'dismissed_at') THEN
        ALTER TABLE public.notifications ADD COLUMN dismissed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Re-create v_dealership_catalog view with correct column mapping
DROP VIEW IF EXISTS public.v_dealership_catalog;

CREATE OR REPLACE VIEW public.v_dealership_catalog AS
SELECT
    id,
    name,
    tier,
    price as base_price,
    image as image_url, -- Map 'image' column to 'image_url' for frontend compatibility
    model_url,
    CASE
        WHEN tier = 'Starter' THEN 10
        WHEN tier = 'Street' THEN 20
        WHEN tier = 'Mid' THEN 30
        WHEN tier = 'Luxury' THEN 50
        WHEN tier = 'Super' THEN 100
        ELSE 10
    END as insurance_rate_bps,
    CASE
        WHEN tier = 'Starter' THEN 100
        WHEN tier = 'Street' THEN 200
        WHEN tier = 'Mid' THEN 500
        WHEN tier = 'Luxury' THEN 1000
        WHEN tier = 'Super' THEN 5000
        ELSE 100
    END as registration_fee,
    4 as exposure_level
FROM public.vehicles_catalog;

GRANT SELECT ON public.v_dealership_catalog TO authenticated;
GRANT SELECT ON public.v_dealership_catalog TO anon;
