-- Migration to fix badge stats and ensure user_profiles has all necessary counters

-- 1. Ensure columns exist on user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS total_spent_coins BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_gifts_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cashouts INTEGER DEFAULT 0,
-- Streaming Stats
ADD COLUMN IF NOT EXISTS total_streams INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_viewers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_concurrent_viewers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_stream_coins_received BIGINT DEFAULT 0,
-- Community Stats
ADD COLUMN IF NOT EXISTS total_jury_duty INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_rulings_accepted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_helpful_reports INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_chat_messages INTEGER DEFAULT 0,
-- Social Stats
ADD COLUMN IF NOT EXISTS login_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_badges_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_violations INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_violation_at TIMESTAMPTZ;

-- 2. Populate total_gifts_sent from gifts table
WITH gift_counts AS (
  SELECT sender_id, count(*) as cnt
  FROM public.gifts
  GROUP BY sender_id
)
UPDATE public.user_profiles up
SET total_gifts_sent = gc.cnt
FROM gift_counts gc
WHERE up.id = gc.sender_id;

-- 3. Populate total_cashouts from payout_requests table
WITH payout_counts AS (
  SELECT user_id, count(*) as cnt
  FROM public.payout_requests
  WHERE status = 'paid'
  GROUP BY user_id
)
UPDATE public.user_profiles up
SET total_cashouts = pc.cnt
FROM payout_counts pc
WHERE up.id = pc.user_id;

-- 4. Populate total_streams from streams table
WITH stream_counts AS (
  SELECT user_id, count(*) as cnt
  FROM public.streams
  GROUP BY user_id
)
UPDATE public.user_profiles up
SET total_streams = sc.cnt
FROM stream_counts sc
WHERE up.id = sc.user_id;

-- 5. Create trigger to update total_gifts_sent
CREATE OR REPLACE FUNCTION public.update_total_gifts_sent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.user_profiles
    SET total_gifts_sent = COALESCE(total_gifts_sent, 0) + 1
    WHERE id = NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_total_gifts_sent ON public.gifts;
CREATE TRIGGER trg_update_total_gifts_sent
AFTER INSERT ON public.gifts
FOR EACH ROW
EXECUTE FUNCTION public.update_total_gifts_sent();

-- 6. Create trigger to update total_cashouts
CREATE OR REPLACE FUNCTION public.update_total_cashouts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only increment if status changed to 'paid'
  IF (TG_OP = 'UPDATE' AND NEW.status = 'paid' AND OLD.status != 'paid') THEN
    UPDATE public.user_profiles
    SET total_cashouts = COALESCE(total_cashouts, 0) + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_total_cashouts ON public.payout_requests;
CREATE TRIGGER trg_update_total_cashouts
AFTER UPDATE ON public.payout_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_total_cashouts();

-- 7. Create trigger to update total_streams
CREATE OR REPLACE FUNCTION public.update_total_streams()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.user_profiles
    SET total_streams = COALESCE(total_streams, 0) + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_total_streams ON public.streams;
CREATE TRIGGER trg_update_total_streams
AFTER INSERT ON public.streams
FOR EACH ROW
EXECUTE FUNCTION public.update_total_streams();
