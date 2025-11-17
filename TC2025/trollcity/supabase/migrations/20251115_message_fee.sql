-- Migration: add per-user message fee (paid coins) to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS message_fee_paid_coins INTEGER DEFAULT 0;
