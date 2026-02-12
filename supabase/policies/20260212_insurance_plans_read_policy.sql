DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'insurance_plans'
  ) THEN
    ALTER TABLE public.insurance_plans ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE tablename = 'insurance_plans'
        AND policyname = 'Public can read insurance plans'
    ) THEN
      CREATE POLICY "Public can read insurance plans"
        ON public.insurance_plans
        FOR SELECT
        USING (true);
    END IF;
  END IF;
END $$;
