-- Revert vehicle upgrade features introduced by 20260215000000_vehicle_refactor_schema.sql

-- 1. Drop user_car_parts table
DROP TABLE IF EXISTS public.user_car_parts CASCADE;

-- 2. Drop car_parts_catalog table
DROP TABLE IF EXISTS public.car_parts_catalog CASCADE;

-- 3. Drop car_shells_catalog table
DROP TABLE IF EXISTS public.car_shells_catalog CASCADE;

-- 4. Drop part_type ENUM
DROP TYPE IF EXISTS public.part_type;

-- 5. Revert vehicles_catalog changes (remove fuel_type and weight columns)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'fuel_type') THEN
        ALTER TABLE public.vehicles_catalog DROP COLUMN fuel_type;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'weight') THEN
        ALTER TABLE public.vehicles_catalog DROP COLUMN weight;
    END IF;
END $$;

-- Note: The purchase_from_ktauto RPC was already updated in a later migration (20270411000000_ktauto_dealership_inventory.sql)
-- to use p_catalog_id INTEGER, so no direct RPC reversion is needed for that function.