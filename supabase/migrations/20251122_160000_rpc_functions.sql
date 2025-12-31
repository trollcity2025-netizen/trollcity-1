BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS has_crown_badge boolean DEFAULT false;

CREATE OR REPLACE FUNCTION process_gift(
  p_sender_id uuid,
  p_streamer_id uuid,
  p_stream_id uuid,
  p_gift_id text,
  p_gift_name text,
  p_coins_spent bigint,
  p_gift_type text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_gift_id uuid := gen_random_uuid();
  v_sender_paid bigint;
  v_streamer_paid bigint;
BEGIN
  IF p_gift_type = 'paid' THEN
    UPDATE user_profiles
      SET troll_coins = troll_coins - p_coins_spent,
          total_spent_coins = total_spent_coins + p_coins_spent,
          updated_at = now()
      WHERE id = p_sender_id;
  ELSE
    UPDATE user_profiles
      SET troll_coins = troll_coins - p_coins_spent,
          total_spent_coins = total_spent_coins + p_coins_spent,
          updated_at = now()
      WHERE id = p_sender_id;
  END IF;

  UPDATE user_profiles
    SET troll_coins = troll_coins + p_coins_spent,
        total_earned_coins = total_earned_coins + p_coins_spent,
        updated_at = now()
    WHERE id = p_streamer_id;

  INSERT INTO gifts(id, stream_id, sender_id, receiver_id, coins_spent, gift_type, message, created_at)
    VALUES (v_gift_id, p_stream_id, p_sender_id, p_streamer_id, p_coins_spent, p_gift_type, p_gift_name, now());

  INSERT INTO transactions(id, user_id, type, transaction_type, coins_used, description, created_at)
    VALUES (gen_random_uuid(), p_sender_id, 'gift', 'gift', p_coins_spent, p_gift_name, now());

  UPDATE streams
    SET total_gifts_coins = COALESCE(total_gifts_coins,0) + p_coins_spent,
        total_unique_gifters = COALESCE(total_unique_gifters,0) + 1,
        updated_at = now()
    WHERE id = p_stream_id;

  IF p_gift_id = 'vivedball' THEN
    UPDATE user_profiles SET vived_bonus_coins = COALESCE(vived_bonus_coins,0) + 5 WHERE id = p_streamer_id;
    INSERT INTO transactions(id, user_id, type, transaction_type, coins_used, description, created_at)
      VALUES (gen_random_uuid(), p_streamer_id, 'vived_gift', 'gift_bonus', 5, 'Vived bonus coins', now());
  END IF;

  IF p_gift_id = 'savscratch' THEN
    UPDATE user_profiles SET sav_bonus_coins = COALESCE(sav_bonus_coins,0) + 5 WHERE id = p_streamer_id;
    INSERT INTO transactions(id, user_id, type, transaction_type, coins_used, description, created_at)
      VALUES (gen_random_uuid(), p_streamer_id, 'sav_gift', 'gift_bonus', 5, 'Sav bonus coins', now());
  END IF;

  INSERT INTO messages(id, stream_id, user_id, content, message_type, gift_amount, created_at)
    VALUES (gen_random_uuid(), p_stream_id, p_sender_id, p_gift_name, 'gift', p_coins_spent, now());

  RETURN v_gift_id;
END;
$$;

CREATE OR REPLACE FUNCTION confirm_coin_purchase(p_tx_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_coins bigint;
BEGIN
  SELECT user_id, coins INTO v_user, v_coins FROM coin_transactions WHERE id = p_tx_id;
  IF v_user IS NULL THEN RETURN; END IF;
  UPDATE coin_transactions SET status = 'completed' WHERE id = p_tx_id;
  UPDATE user_profiles SET troll_coins = troll_coins + COALESCE(v_coins,0), updated_at = now() WHERE id = v_user;
END;
$$;

CREATE OR REPLACE FUNCTION add_free_coins(p_user_id uuid, p_amount bigint)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE user_profiles SET troll_coins = troll_coins + p_amount, updated_at = now() WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION grant_family_crown(p_family_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE troll_families SET level = level + 1 WHERE id = p_family_id;
  UPDATE user_profiles SET has_crown_badge = true
    WHERE id IN (SELECT user_id FROM troll_family_members WHERE family_id = p_family_id);
END;
$$;

CREATE OR REPLACE FUNCTION get_weekly_family_task_counts()
RETURNS TABLE(
  family_id uuid,
  family_name text,
  task_count integer
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT f.id AS family_id, f.name AS family_name, COALESCE(cnt.c,0) AS task_count
  FROM troll_families f
  LEFT JOIN (
    SELECT family_id, COUNT(*) AS c
    FROM family_tasks_new
    WHERE status = 'active'
    GROUP BY family_id
  ) cnt ON cnt.family_id = f.id
  ORDER BY cnt.c DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION update_viewer_count(p_stream_id uuid, p_delta integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v int; BEGIN
  UPDATE streams SET current_viewers = GREATEST(0, COALESCE(current_viewers,0) + p_delta), updated_at = now() WHERE id = p_stream_id;
  SELECT current_viewers INTO v FROM streams WHERE id = p_stream_id;
  RETURN v;
END; $$;

CREATE TABLE IF NOT EXISTS admin_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION ban_user(p_user_id uuid, p_until timestamptz)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE user_profiles SET no_ban_until = p_until, updated_at = now() WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION reset_user_coins(p_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE user_profiles SET troll_coins = 0, troll_coins = 0, updated_at = now() WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION end_stream(p_stream_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE streams SET status = 'ended', is_live = false, end_time = now(), updated_at = now() WHERE id = p_stream_id;
END;
$$;

COMMIT;
