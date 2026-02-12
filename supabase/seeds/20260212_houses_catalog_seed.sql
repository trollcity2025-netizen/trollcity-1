DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.houses_catalog WHERE name = 'Starter Apartment') THEN
    INSERT INTO public.houses_catalog (name, tier, base_price, rent_slots, power_band, daily_tax_rate_bps, maintenance_rate_bps, influence_points, feature_flags)
    VALUES ('Starter Apartment', 1, 5000, 0, 'apartment', 10, 5, 0, '{"storage_slots": 10}'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.houses_catalog WHERE name = 'City Condo') THEN
    INSERT INTO public.houses_catalog (name, tier, base_price, rent_slots, power_band, daily_tax_rate_bps, maintenance_rate_bps, influence_points, feature_flags)
    VALUES ('City Condo', 2, 50000, 1, 'condo', 15, 8, 10, '{"fee_discount_bps": 50}'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.houses_catalog WHERE name = 'Luxury Estate') THEN
    INSERT INTO public.houses_catalog (name, tier, base_price, rent_slots, power_band, daily_tax_rate_bps, maintenance_rate_bps, influence_points, feature_flags)
    VALUES ('Luxury Estate', 3, 500000, 3, 'estate', 20, 10, 50, '{"business_license": true}'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.houses_catalog WHERE name = 'Governor Mansion') THEN
    INSERT INTO public.houses_catalog (name, tier, base_price, rent_slots, power_band, daily_tax_rate_bps, maintenance_rate_bps, influence_points, feature_flags)
    VALUES ('Governor Mansion', 4, 5000000, 5, 'mansion', 25, 15, 200, '{"political_influence": true}'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.houses_catalog WHERE name = 'Troll Tower Penthouse') THEN
    INSERT INTO public.houses_catalog (name, tier, base_price, rent_slots, power_band, daily_tax_rate_bps, maintenance_rate_bps, influence_points, feature_flags)
    VALUES ('Troll Tower Penthouse', 5, 100000000, 10, 'landmark', 30, 20, 1000, '{"city_influence": true}'::jsonb);
  END IF;
END $$;
