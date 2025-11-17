-- Enable Square integration by default for testing
UPDATE earnings_config 
SET square_account_active = true,
    square_application_id = 'sandbox-sq0idb-YOUR_SANDBOX_APP_ID',
    square_location_id = 'YOUR_SANDBOX_LOCATION_ID',
    updated_at = NOW()
WHERE id = 1;

-- Insert default earnings config if it doesn't exist
INSERT INTO earnings_config (
  bronze_tier_requirement,
  bronze_tier_payout,
  silver_tier_requirement,
  silver_tier_payout,
  gold_tier_requirement,
  gold_tier_payout,
  platinum_tier_requirement,
  platinum_tier_payout,
  transaction_fee_percentage,
  transaction_fee_fixed_cents,
  minimum_payout,
  payment_processing_days,
  square_account_active,
  square_application_id,
  square_location_id,
  updated_at
) VALUES (
  7000, 50.00,
  14000, 55.00,
  27000, 100.00,
  48000, 175.00,
  2.9, 30,
  25.00, 3,
  true, 'sandbox-sq0idb-YOUR_SANDBOX_APP_ID', 'YOUR_SANDBOX_LOCATION_ID',
  NOW()
) ON CONFLICT (id) DO NOTHING;