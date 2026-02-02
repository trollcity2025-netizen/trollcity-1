-- Add generated column coin_amount to coin_packages for backward compatibility
-- This resolves "column coin_packages.coin_amount does not exist" errors in legacy code/admin UI

DO $$
BEGIN
  -- Check if column exists to avoid errors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coin_packages' AND column_name = 'coin_amount'
  ) THEN
    -- Add coin_amount as a generated column mirroring coins
    -- using COALESCE to handle potential nulls (though coins should be not null usually)
    ALTER TABLE public.coin_packages 
    ADD COLUMN coin_amount INTEGER GENERATED ALWAYS AS (coins) STORED;
  END IF;
END $$;
