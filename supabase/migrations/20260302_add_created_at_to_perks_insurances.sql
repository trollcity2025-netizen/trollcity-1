-- Migration: add created_at timestamps to perks purchases
-- Date: 2026-03-02
BEGIN;

ALTER TABLE user_perks
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE user_insurances
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMIT;
