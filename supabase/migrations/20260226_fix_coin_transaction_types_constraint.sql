-- Ensure coin_transactions type constraint includes all necessary transaction types
-- This migration fixes any constraint issues and ensures consistent allowed types

ALTER TABLE public.coin_transactions
DROP CONSTRAINT IF EXISTS coin_transactions_type_check;

ALTER TABLE public.coin_transactions
ADD CONSTRAINT coin_transactions_type_check
CHECK (
  type IN (
    'purchase',
    'gift',
    'spin',
    'insurance',
    'cashout',
    'admin_grant',
    'admin_deduct',
    'admin_adjustment',
    'admin_reset',
    'store_purchase',
    'perk_purchase',
    'entrance_effect',
    'insurance_purchase',
    'gift_send',
    'gift_receive',
    'gift_sent',
    'gift_received',
    'kick_fee',
    'ban_fee',
    'wheel_spin',
    'wheel_win',
    'wheel_loss',
    'wheel_prize',
    'refund',
    'reward',
    'payout_request',
    'payout_hold',
    'payout_refund',
    'troll_pass_purchase',
    'daily_giveaway'
  )
);
