DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.insurance_plans) THEN
    INSERT INTO public.insurance_plans (
      name,
      description,
      coverage_description,
      price_paid_coins,
      duration_days
    ) VALUES
      (
        'Basic Coverage',
        'Entry plan for vehicle insurance.',
        'Covers minor incidents and basic protection.',
        2000,
        7
      ),
      (
        'Standard Coverage',
        'Balanced coverage for everyday drivers.',
        'Covers standard incidents with moderate protection.',
        5000,
        30
      ),
      (
        'Premium Coverage',
        'Top-tier coverage for high value vehicles.',
        'Covers most incidents with premium protection.',
        15000,
        90
      );
  END IF;
END $$;
