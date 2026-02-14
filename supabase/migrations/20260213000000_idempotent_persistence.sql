
-- Migration: 20260213000000_idempotent_persistence.sql
-- Goal: Ensure unique constraint for (stream_id, txn_id) to prevent duplicate persistence from worker retries.

-- 1. Stream Messages
ALTER TABLE public.stream_messages 
ADD COLUMN IF NOT EXISTS txn_id UUID;

-- Add unique constraint
-- Note: If data exists, you might need to backfill txn_id or handle conflicts
CREATE UNIQUE INDEX IF NOT EXISTS idx_stream_messages_stream_txn_uq 
ON public.stream_messages (stream_id, txn_id) 
WHERE txn_id IS NOT NULL;

-- 2. Gifts Log (stream_gifts)
ALTER TABLE public.stream_gifts 
ADD COLUMN IF NOT EXISTS txn_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stream_gifts_stream_txn_uq 
ON public.stream_gifts (stream_id, txn_id) 
WHERE txn_id IS NOT NULL;

-- 3. Battle Events (if applicable, assuming a battle_events table exists or adding to battles)
-- Adding txn_id to coin_transactions as well for global idempotency
ALTER TABLE public.coin_transactions 
ADD COLUMN IF NOT EXISTS txn_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_transactions_txn_id_uq 
ON public.coin_transactions (txn_id) 
WHERE txn_id IS NOT NULL;
