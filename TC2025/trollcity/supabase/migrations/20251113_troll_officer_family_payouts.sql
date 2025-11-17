-- Migration: Add Troll Officer and Family Payout tables + columns
-- Date: 2025-11-13

-- Add new columns to profiles table for moderation and officer settings
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_kicked BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kicked_at TIMESTAMP;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chat_disabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS officer_pay_rate DECIMAL(10, 2) DEFAULT 0;

-- Create family_weekly_payouts table to track weekly family payout summaries
CREATE TABLE IF NOT EXISTS family_weekly_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  family_name TEXT NOT NULL,
  total_coins_received BIGINT DEFAULT 0,
  payout_amount_total DECIMAL(10, 2) NOT NULL,
  payout_per_member DECIMAL(10, 2) NOT NULL,
  week_start TIMESTAMP NOT NULL,
  week_end TIMESTAMP NOT NULL,
  created_date TIMESTAMP DEFAULT now(),
  UNIQUE(family_id, week_start)
);

-- Ensure payouts table exists with correct schema
CREATE TABLE IF NOT EXISTS payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  user_email TEXT,
  coin_amount BIGINT DEFAULT 0,
  usd_amount DECIMAL(10, 2) NOT NULL,
  fee_amount DECIMAL(10, 2) DEFAULT 0,
  payout_amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT DEFAULT 'manual',
  payment_details TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  created_date TIMESTAMP DEFAULT now(),
  processed_date TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_family_weekly_payouts_family ON family_weekly_payouts(family_id);
CREATE INDEX IF NOT EXISTS idx_family_weekly_payouts_week ON family_weekly_payouts(week_start);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
