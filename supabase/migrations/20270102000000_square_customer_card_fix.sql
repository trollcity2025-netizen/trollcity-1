-- Add Square customer ID and card details to user_profiles if they don't exist
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS square_customer_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS square_card_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS card_brand TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS card_last4 TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS card_exp_month INTEGER;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS card_exp_year INTEGER;

-- Ensure user_payment_methods has the required columns
ALTER TABLE user_payment_methods
ADD COLUMN IF NOT EXISTS square_customer_id TEXT,
ADD COLUMN IF NOT EXISTS square_card_id TEXT;

-- Clean up invalid payment methods (those without proper Square IDs)
-- First, mark them as non-default
UPDATE public.user_payment_methods
SET is_default = false
WHERE square_customer_id IS NULL OR square_card_id IS NULL;

-- For users with invalid defaults, set a valid method as default
UPDATE public.user_payment_methods
SET is_default = true
WHERE id IN (
  SELECT DISTINCT ON (pm.user_id) pm.id
  FROM public.user_payment_methods pm
  WHERE pm.user_id IN (
    SELECT DISTINCT user_id
    FROM public.user_payment_methods
    WHERE is_default = true
    AND (square_customer_id IS NULL OR square_card_id IS NULL)
  )
  AND pm.square_customer_id IS NOT NULL
  AND pm.square_card_id IS NOT NULL
  ORDER BY pm.user_id, pm.created_at DESC
);

-- Optional: Remove completely invalid payment methods
-- Uncomment the following if you want to delete unusable payment methods:
-- DELETE FROM public.user_payment_methods
-- WHERE square_customer_id IS NULL OR square_card_id IS NULL;

-- Report current state
SELECT
  'Payment Methods Status' as report,
  COUNT(*) as total_methods,
  COUNT(CASE WHEN square_customer_id IS NOT NULL AND square_card_id IS NOT NULL THEN 1 END) as valid_square_methods,
  COUNT(CASE WHEN square_customer_id IS NULL OR square_card_id IS NULL THEN 1 END) as invalid_methods
FROM public.user_payment_methods;