-- Backfill User Levels and User Stats
-- This migration calculates XP and levels for all users

-- ============================================================================
-- STEP 0: Ensure user_levels table exists with all required columns
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_levels (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  buyer_xp bigint not null default 0,
  buyer_level int not null default 1,
  stream_xp bigint not null default 0,
  stream_level int not null default 1,
  updated_at timestamptz not null default now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_levels' AND column_name = 'buyer_xp') THEN
    ALTER TABLE public.user_levels ADD COLUMN buyer_xp bigint NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_levels' AND column_name = 'buyer_level') THEN
    ALTER TABLE public.user_levels ADD COLUMN buyer_level int NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_levels' AND column_name = 'stream_xp') THEN
    ALTER TABLE public.user_levels ADD COLUMN stream_xp bigint NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_levels' AND column_name = 'stream_level') THEN
    ALTER TABLE public.user_levels ADD COLUMN stream_level int NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_levels' AND column_name = 'updated_at') THEN
    ALTER TABLE public.user_levels ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- STEP 1: Ensure all users have rows in both tables
-- ============================================================================

INSERT INTO public.user_levels (user_id)
SELECT id FROM public.user_profiles
WHERE id NOT IN (SELECT user_id FROM public.user_levels WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_stats (user_id, xp_total)
SELECT id, 0 FROM public.user_profiles
WHERE id NOT IN (SELECT user_id FROM public.user_stats WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- STEP 2: Calculate BUYER XP from gifts sent (coins spent on gifts)
-- ============================================================================

UPDATE public.user_levels ul
SET buyer_xp = COALESCE(
    (SELECT SUM(COALESCE(sg.coins_spent, 0)) 
     FROM public.stream_gifts sg 
     WHERE sg.sender_id = ul.user_id), 0),
    updated_at = NOW()
WHERE ul.user_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Calculate STREAM XP from gifts received
-- ============================================================================

UPDATE public.user_levels ul
SET stream_xp = COALESCE(
    (SELECT SUM(COALESCE(sg.coins_spent, 0)) * 0.5 
     FROM public.stream_gifts sg 
     WHERE sg.recipient_id = ul.user_id), 0),
    updated_at = NOW()
WHERE ul.user_id IS NOT NULL;

UPDATE public.user_levels ul
SET stream_xp = COALESCE(ul.stream_xp, 0) + COALESCE(
    (SELECT SUM(COALESCE(sg.coins_spent, 0)) * 0.5 
     FROM public.stream_gifts sg 
     WHERE sg.receiver_id = ul.user_id), 0),
    updated_at = NOW()
WHERE ul.user_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Calculate STREAM XP from broadcast time (1 XP per minute)
-- ============================================================================

UPDATE public.user_levels ul
SET stream_xp = COALESCE(ul.stream_xp, 0) + COALESCE(
    (SELECT 
      SUM(
        CASE 
          WHEN s.ended_at IS NOT NULL AND s.started_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60
          ELSE 0
        END
      )::bigint
     FROM public.streams s
     WHERE s.user_id = ul.user_id
       AND s.status != 'cancelled'), 0),
    updated_at = NOW()
WHERE ul.user_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Calculate BUYER XP from coin purchases
-- ============================================================================

UPDATE public.user_levels ul
SET buyer_xp = COALESCE(ul.buyer_xp, 0) + COALESCE(
    (SELECT 
      SUM(ABS(COALESCE(ct.amount, 0)))
     FROM public.coin_transactions ct
     WHERE ct.user_id = ul.user_id
       AND ct.type IN ('purchase', 'paypal_purchase', 'coin_purchase', 'store_purchase', 'paid_coins', 'coin_package')
       AND ct.amount < 0), 0),
    updated_at = NOW()
WHERE ul.user_id IS NOT NULL;

-- ============================================================================
-- STEP 6: Update buyer_level in user_levels
-- ============================================================================

UPDATE public.user_levels
SET buyer_level = CASE
    WHEN buyer_xp >= 3000000 THEN 10
    WHEN buyer_xp >= 1500000 THEN 9
    WHEN buyer_xp >= 750000  THEN 8
    WHEN buyer_xp >= 300000  THEN 7
    WHEN buyer_xp >= 150000  THEN 6
    WHEN buyer_xp >= 70000   THEN 5
    WHEN buyer_xp >= 30000   THEN 4
    WHEN buyer_xp >= 10000   THEN 3
    WHEN buyer_xp >= 2000    THEN 2
    ELSE 1
  END,
  updated_at = NOW();

-- ============================================================================
-- STEP 7: Update stream_level in user_levels
-- ============================================================================

UPDATE public.user_levels
SET stream_level = CASE
    WHEN stream_xp >= 900000 THEN 10
    WHEN stream_xp >= 300000 THEN 9
    WHEN stream_xp >= 120000 THEN 8
    WHEN stream_xp >= 60000  THEN 7
    WHEN stream_xp >= 30000  THEN 6
    WHEN stream_xp >= 15000  THEN 5
    WHEN stream_xp >= 7500   THEN 4
    WHEN stream_xp >= 2000   THEN 3
    WHEN stream_xp >= 500    THEN 2
    ELSE 1
  END,
  updated_at = NOW();

-- ============================================================================
-- STEP 8: Update user_stats table (for sidebar display)
-- ============================================================================

-- First calculate total XP from user_levels
WITH combined_xp AS (
  SELECT 
    user_id,
    COALESCE(buyer_xp, 0) + COALESCE(stream_xp, 0) as total_xp
  FROM public.user_levels
)
UPDATE public.user_stats us
SET xp_total = COALESCE(cx.total_xp, 0),
    updated_at = NOW()
FROM combined_xp cx
WHERE us.user_id = cx.user_id;

-- Now calculate level using the calculate_level function
UPDATE public.user_stats us
SET 
  level = CASE
    WHEN xp_total >= 400000 THEN 30
    WHEN xp_total >= 250000 THEN 25
    WHEN xp_total >= 150000 THEN 20
    WHEN xp_total >= 70000 THEN 15
    WHEN xp_total >= 30000 THEN 10
    WHEN xp_total >= 23000 THEN 9
    WHEN xp_total >= 17000 THEN 8
    WHEN xp_total >= 12000 THEN 7
    WHEN xp_total >= 8000 THEN 6
    WHEN xp_total >= 5000 THEN 5
    WHEN xp_total >= 3000 THEN 4
    WHEN xp_total >= 1500 THEN 3
    WHEN xp_total >= 500 THEN 2
    ELSE 1
  END,
  xp_to_next_level = CASE
    WHEN xp_total >= 400000 THEN 0
    WHEN xp_total >= 250000 THEN xp_total - 250000
    WHEN xp_total >= 150000 THEN xp_total - 150000
    WHEN xp_total >= 70000 THEN xp_total - 70000
    WHEN xp_total >= 30000 THEN xp_total - 30000
    WHEN xp_total >= 23000 THEN xp_total - 23000
    WHEN xp_total >= 17000 THEN xp_total - 17000
    WHEN xp_total >= 12000 THEN xp_total - 12000
    WHEN xp_total >= 8000 THEN xp_total - 8000
    WHEN xp_total >= 5000 THEN xp_total - 5000
    WHEN xp_total >= 3000 THEN xp_total - 3000
    WHEN xp_total >= 1500 THEN xp_total - 1500
    WHEN xp_total >= 500 THEN xp_total - 500
    ELSE xp_total
  END,
  xp_progress = CASE
    WHEN xp_total >= 400000 THEN 100.0
    WHEN xp_total >= 250000 THEN (xp_total - 250000)::float / 150000 * 100
    WHEN xp_total >= 150000 THEN (xp_total - 150000)::float / 80000 * 100
    WHEN xp_total >= 70000 THEN (xp_total - 70000)::float / 70000 * 100
    WHEN xp_total >= 30000 THEN (xp_total - 30000)::float / 40000 * 100
    WHEN xp_total >= 23000 THEN (xp_total - 23000)::float / 7000 * 100
    WHEN xp_total >= 17000 THEN (xp_total - 17000)::float / 6000 * 100
    WHEN xp_total >= 12000 THEN (xp_total - 12000)::float / 5000 * 100
    WHEN xp_total >= 8000 THEN (xp_total - 8000)::float / 4000 * 100
    WHEN xp_total >= 5000 THEN (xp_total - 5000)::float / 3000 * 100
    WHEN xp_total >= 3000 THEN (xp_total - 3000)::float / 1500 * 100
    WHEN xp_total >= 1500 THEN (xp_total - 1500)::float / 1500 * 100
    WHEN xp_total >= 500 THEN (xp_total - 500)::float / 1000 * 100
    ELSE xp_total::float / 500 * 100
  END,
  updated_at = NOW();

-- ============================================================================
-- STEP 9: Verify and report results
-- ============================================================================

-- User levels summary
SELECT 
  'Buyer Level Distribution' as report,
  buyer_level as level,
  COUNT(*) as user_count,
  MIN(buyer_xp) as min_xp,
  MAX(buyer_xp) as max_xp
FROM public.user_levels
GROUP BY buyer_level
ORDER BY buyer_level DESC;

SELECT 
  'Stream Level Distribution' as report,
  stream_level as level,
  COUNT(*) as user_count,
  MIN(stream_xp) as min_xp,
  MAX(stream_xp) as max_xp
FROM public.user_levels
GROUP BY stream_level
ORDER BY stream_level DESC;

-- User stats summary (for sidebar)
SELECT 
  'User Stats Level Distribution' as report,
  level,
  COUNT(*) as user_count,
  MIN(xp_total) as min_xp,
  MAX(xp_total) as max_xp
FROM public.user_stats
GROUP BY level
ORDER BY level DESC;

-- Top users
SELECT 
  'Top 10 by Total XP (user_stats)' as report,
  p.username,
  us.xp_total,
  us.level
FROM public.user_stats us
JOIN public.user_profiles p ON us.user_id = p.id
ORDER BY us.xp_total DESC
LIMIT 10;
