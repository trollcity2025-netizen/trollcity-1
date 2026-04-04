-- Clean up invalid payment methods that don't have Square card-on-file IDs
-- This script identifies and handles payment methods without proper Square integration

-- IMPORTANT: Run this in Supabase SQL Editor

-- 1. First, report current state
SELECT
  COUNT(*) as total_payment_methods,
  COUNT(CASE WHEN square_customer_id IS NOT NULL AND square_card_id IS NOT NULL THEN 1 END) as valid_square_methods,
  COUNT(CASE WHEN square_customer_id IS NULL OR square_card_id IS NULL THEN 1 END) as invalid_methods,
  COUNT(CASE WHEN is_default = true AND (square_customer_id IS NULL OR square_card_id IS NULL) THEN 1 END) as invalid_defaults
FROM public.user_payment_methods;

-- 2. Mark invalid payment methods as non-default
UPDATE public.user_payment_methods
SET is_default = false
WHERE square_customer_id IS NULL OR square_card_id IS NULL;

-- 3. For users who have invalid default methods, set a valid one as default
-- This finds users with invalid defaults and sets their newest valid method as default
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

-- 4. Optional: Delete invalid payment methods (uncomment if you want to remove them)
-- WARNING: This will permanently delete invalid payment methods
-- DELETE FROM public.user_payment_methods
-- WHERE square_customer_id IS NULL OR square_card_id IS NULL;

-- 5. Report final state
SELECT
  COUNT(*) as total_payment_methods,
  COUNT(CASE WHEN square_customer_id IS NOT NULL AND square_card_id IS NOT NULL THEN 1 END) as valid_square_methods,
  COUNT(CASE WHEN square_customer_id IS NULL OR square_card_id IS NULL THEN 1 END) as invalid_methods,
  COUNT(CASE WHEN is_default = true AND (square_customer_id IS NULL OR square_card_id IS NULL) THEN 1 END) as invalid_defaults
FROM public.user_payment_methods;