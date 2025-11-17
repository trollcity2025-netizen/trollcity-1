-- Add user level and daily paid coins tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_daily_paid_coins DATE DEFAULT NULL;

-- Function to compute level from total coins (example logic)
CREATE OR REPLACE FUNCTION public.compute_user_level(total_coins INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF total_coins < 10 THEN RETURN 0;
  ELSIF total_coins < 20 THEN RETURN 10;
  ELSIF total_coins < 41 THEN RETURN 20;
  ELSIF total_coins < 61 THEN RETURN 41;
  ELSIF total_coins < 71 THEN RETURN 61;
  ELSE RETURN 71;
  END IF;
END;
$$;

-- Function to credit daily paid coins based on level
CREATE OR REPLACE FUNCTION public.credit_daily_paid_coins()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  bonus INTEGER;
  today DATE := CURRENT_DATE;
BEGIN
  FOR rec IN SELECT id, level, coins, purchased_coins FROM public.profiles WHERE last_daily_paid_coins IS NULL OR last_daily_paid_coins < today
  LOOP
    CASE
      WHEN rec.level BETWEEN 0 AND 9 THEN bonus := 15;
      WHEN rec.level BETWEEN 10 AND 19 THEN bonus := 35;
      WHEN rec.level BETWEEN 20 AND 40 THEN bonus := 75;
      WHEN rec.level BETWEEN 41 AND 60 THEN bonus := 100;
      WHEN rec.level BETWEEN 61 AND 70 THEN bonus := 200;
      WHEN rec.level >= 71 THEN bonus := 500;
      ELSE bonus := 0;
    END CASE;
    IF bonus > 0 THEN
      UPDATE public.profiles
      SET coins = coins + bonus,
          purchased_coins = purchased_coins + bonus,
          last_daily_paid_coins = today,
          updated_date = now()
      WHERE id = rec.id;
      INSERT INTO public.coin_transactions (user_id, amount, type, reason, source, created_date)
      VALUES (rec.id, bonus, 'credit', 'daily_level_bonus', 'daily_cron', now());
    END IF;
  END LOOP;
END;
$$;