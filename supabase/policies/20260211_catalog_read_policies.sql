-- Catalog read policies (review before running)
-- Purpose: allow all users to read catalog tables so purchases don't appear empty.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Gifts
  ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gifts' AND policyname = 'Public can read gifts') THEN
    CREATE POLICY "Public can read gifts" ON public.gifts FOR SELECT USING (true);
  END IF;

  -- Shop items
  ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shop_items' AND policyname = 'Public can read shop items') THEN
    CREATE POLICY "Public can read shop items" ON public.shop_items FOR SELECT USING (true);
  END IF;

  -- Insurance options
  ALTER TABLE public.insurance_options ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insurance_options' AND policyname = 'Public can read insurance options') THEN
    CREATE POLICY "Public can read insurance options" ON public.insurance_options FOR SELECT USING (true);
  END IF;

  -- Vehicles catalog
  ALTER TABLE public.vehicles_catalog ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicles_catalog' AND policyname = 'Public can read vehicles catalog') THEN
    CREATE POLICY "Public can read vehicles catalog" ON public.vehicles_catalog FOR SELECT USING (true);
  END IF;

  -- Purchasable items
  ALTER TABLE public.purchasable_items ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchasable_items' AND policyname = 'Public can read purchasable items') THEN
    CREATE POLICY "Public can read purchasable items" ON public.purchasable_items FOR SELECT USING (true);
  END IF;

  -- Broadcast themes
  ALTER TABLE public.broadcast_themes ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broadcast_themes' AND policyname = 'Public can read broadcast themes') THEN
    CREATE POLICY "Public can read broadcast themes" ON public.broadcast_themes FOR SELECT USING (true);
  END IF;

  -- Entrance effects
  ALTER TABLE public.entrance_effects ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'entrance_effects' AND policyname = 'Public can read entrance effects') THEN
    CREATE POLICY "Public can read entrance effects" ON public.entrance_effects FOR SELECT USING (true);
  END IF;

  -- Call sound catalog
  ALTER TABLE public.call_sound_catalog ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'call_sound_catalog' AND policyname = 'Public can read call sounds') THEN
    CREATE POLICY "Public can read call sounds" ON public.call_sound_catalog FOR SELECT USING (true);
  END IF;

  -- Perks
  ALTER TABLE public.perks ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'perks' AND policyname = 'Public can read perks') THEN
    CREATE POLICY "Public can read perks" ON public.perks FOR SELECT USING (true);
  END IF;
END $$;
