-- Add reason column to coin_transactions table
ALTER TABLE coin_transactions 
ADD COLUMN reason TEXT;