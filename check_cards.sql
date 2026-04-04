-- Check cards in user_profiles
SELECT
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

-- Check cards in user_payment_methods
SELECT
  id,
  user_id,
  provider,
  brand,
  last4,
  exp_month,
  exp_year,
  is_default,
  square_customer_id,
  square_card_id,
  created_at
FROM public.user_payment_methods
ORDER BY user_id, is_default DESC, created_at DESC;