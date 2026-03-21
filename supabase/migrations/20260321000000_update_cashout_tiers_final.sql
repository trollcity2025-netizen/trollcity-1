-- Migration: Update cashout tiers to final values
-- Date: 2026-03-21
-- Replaces old tiers with:
-- 5,000 coins = $10
-- 15,000 coins = $50
-- 30,000 coins = $150
-- 60,000 coins = $300
-- 120,000 coins = $600
-- 200,000 coins = $1,000 (Manual Review Required)

-- First, deactivate all existing tiers
UPDATE cashout_tiers SET is_active = false;

-- Insert new tiers (or update if they exist)
INSERT INTO cashout_tiers (coin_amount, cash_amount, currency, processing_fee_percentage, is_active, created_at)
VALUES 
  (5000, 10, 'USD', 0, true, NOW()),
  (15000, 50, 'USD', 0, true, NOW()),
  (30000, 150, 'USD', 0, true, NOW()),
  (60000, 300, 'USD', 0, true, NOW()),
  (120000, 600, 'USD', 0, true, NOW()),
  (200000, 1000, 'USD', 0, true, NOW())
ON CONFLICT DO NOTHING;

-- If there are conflicts, update instead
UPDATE cashout_tiers 
SET 
  cash_amount = CASE coin_amount
    WHEN 5000 THEN 10
    WHEN 15000 THEN 50
    WHEN 30000 THEN 150
    WHEN 60000 THEN 300
    WHEN 120000 THEN 600
    WHEN 200000 THEN 1000
    ELSE cash_amount
  END,
  is_active = true,
  processing_fee_percentage = 0
WHERE coin_amount IN (5000, 15000, 30000, 60000, 120000, 200000);

-- Ensure old/unwanted tiers are deactivated
UPDATE cashout_tiers 
SET is_active = false 
WHERE coin_amount NOT IN (5000, 15000, 30000, 60000, 120000, 200000);
