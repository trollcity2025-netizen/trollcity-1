ALTER TABLE user_payment_methods
  ADD COLUMN IF NOT EXISTS square_customer_id text,
  ADD COLUMN IF NOT EXISTS square_card_id text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS last4 text,
  ADD COLUMN IF NOT EXISTS exp_month integer,
  ADD COLUMN IF NOT EXISTS exp_year integer,
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name text;

DO $$ BEGIN
  BEGIN
    ALTER TABLE user_payment_methods ALTER COLUMN token_id DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN
    -- older schema used 'token' column, make it nullable if exists
    BEGIN
      ALTER TABLE user_payment_methods ALTER COLUMN token DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN NULL; END;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_upm_default ON user_payment_methods(user_id, is_default);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_upm_card ON user_payment_methods(user_id, square_card_id);
