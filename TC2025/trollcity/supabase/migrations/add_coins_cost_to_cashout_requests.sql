-- Add coins_cost column to cashout_requests table
ALTER TABLE public.cashout_requests 
ADD COLUMN IF NOT EXISTS coins_cost INTEGER DEFAULT 0;

-- Update existing records to calculate coins_cost based on amount
-- Assuming a conversion rate (you may need to adjust this)
UPDATE public.cashout_requests 
SET coins_cost = CASE 
  WHEN amount >= 100 THEN amount * 100  -- $1 = 100 coins
  WHEN amount >= 50 THEN amount * 110   -- Different rates for different amounts
  WHEN amount >= 20 THEN amount * 120
  ELSE amount * 150
END::INTEGER
WHERE coins_cost = 0 OR coins_cost IS NULL;