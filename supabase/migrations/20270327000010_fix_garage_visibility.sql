-- Fix garage visibility and purchase logic
-- 1. Ensure RLS policies are correct for user_vehicles and related tables
-- 2. Ensure purchase_from_ktauto inserts into user_vehicles correctly

-- RLS for user_vehicles
DROP POLICY IF EXISTS "Users view own vehicles" ON public.user_vehicles;
CREATE POLICY "Users view own vehicles" ON public.user_vehicles FOR SELECT USING (auth.uid() = user_id);

-- RLS for vehicles_catalog
DROP POLICY IF EXISTS "Public read catalog" ON public.vehicles_catalog;
CREATE POLICY "Public read catalog" ON public.vehicles_catalog FOR SELECT USING (true);

