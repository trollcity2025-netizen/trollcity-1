-- EMERGENCY DEBUG: Check what payment methods exist and their status
SELECT
  '=== PAYMENT METHODS DEBUG ===' as debug_info,
  id,
  user_id,
  provider,
  brand,
  last4,
  is_default,
  square_customer_id,
  square_card_id,
  CASE
    WHEN square_customer_id IS NOT NULL AND square_card_id IS NOT NULL THEN 'VALID'
    WHEN square_customer_id IS NULL AND square_card_id IS NULL THEN 'COMPLETELY_INVALID'
    ELSE 'PARTIALLY_INVALID'
  END as status,
  created_at
FROM public.user_payment_methods
ORDER BY user_id, is_default DESC, created_at DESC;

-- Check user_profiles for card data
SELECT
  '=== USER PROFILES DEBUG ===' as debug_info,
  id,
  username,
  square_customer_id,
  square_card_id,
  card_brand,
  card_last4,
  card_exp_month,
  card_exp_year,
  encrypted_card_data
FROM public.user_profiles
WHERE square_customer_id IS NOT NULL
   OR square_card_id IS NOT NULL
   OR card_brand IS NOT NULL
ORDER BY created_at DESC;

-- Find problematic payment methods
SELECT
  '=== PROBLEMATIC METHODS ===' as debug_info,
  COUNT(*) as total_methods,
  COUNT(CASE WHEN is_default = true THEN 1 END) as default_methods,
  COUNT(CASE WHEN is_default = true AND (square_customer_id IS NULL OR square_card_id IS NULL) THEN 1 END) as invalid_defaults,
  COUNT(CASE WHEN square_customer_id IS NULL OR square_card_id IS NULL THEN 1 END) as invalid_methods
FROM public.user_payment_methods;