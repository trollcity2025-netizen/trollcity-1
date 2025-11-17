-- Add cashout approval tracking and level-based limits
ALTER TABLE public.payouts
ADD COLUMN IF NOT EXISTS approval_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS approved_by_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS approval_notes TEXT DEFAULT NULL;

-- Create payout approval levels table
CREATE TABLE IF NOT EXISTS public.payout_approval_levels (
  id SERIAL PRIMARY KEY,
  level INTEGER NOT NULL UNIQUE,
  max_payout_amount NUMERIC NOT NULL,
  approval_required BOOLEAN DEFAULT TRUE,
  daily_limit NUMERIC DEFAULT NULL,
  monthly_limit NUMERIC DEFAULT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Insert default approval levels based on user levels
INSERT INTO public.payout_approval_levels (level, max_payout_amount, approval_required, daily_limit, monthly_limit) VALUES
(0, 25, TRUE, 25, 100),    -- Tiny Troller (0-9)
(10, 55, TRUE, 55, 200),   -- Gang Troller (10-19)
(20, 100, TRUE, 100, 500), -- OG Troller (20-40)
(41, 175, TRUE, 175, 750), -- Old Ass troller (41-60)
(61, 200, FALSE, 200, 1000), -- Dead troller (61-70)
(71, 500, FALSE, 500, 2000); -- Graveyard (71+)