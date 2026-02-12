DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'houses_catalog'
  ) THEN
    ALTER TABLE public.houses_catalog ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE tablename = 'houses_catalog'
        AND policyname = 'Public can read houses catalog'
    ) THEN
      CREATE POLICY "Public can read houses catalog"
        ON public.houses_catalog
        FOR SELECT
        USING (true);
    END IF;
  END IF;
END $$;
