-- Migration: Track Troll Battle contributions in troll coins only
-- Date: 2026-03-01
-- Purpose: Replace paid/free coin columns with unified troll coin totals
BEGIN;

ALTER TABLE troll_battles
ADD COLUMN IF NOT EXISTS host_troll_coins bigint NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS challenger_troll_coins bigint NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS host_stream_id uuid REFERENCES streams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS challenger_stream_id uuid REFERENCES streams(id) ON DELETE SET NULL;

DO $$
BEGIN
  UPDATE troll_battles
  SET
    host_troll_coins = GREATEST(
      COALESCE(host_troll_coins, 0),
      COALESCE(host_paid_coins, 0),
      COALESCE(host_free_coins, 0),
      COALESCE(host_trollmonds, 0),
      COALESCE(host_trollmods, 0)
    ),
    challenger_troll_coins = GREATEST(
      COALESCE(challenger_troll_coins, 0),
      COALESCE(challenger_paid_coins, 0),
      COALESCE(challenger_free_coins, 0),
      COALESCE(challenger_trollmonds, 0),
      COALESCE(guest_trollmonds, 0)
    );
EXCEPTION WHEN undefined_column THEN
  UPDATE troll_battles
  SET
    host_troll_coins = COALESCE(host_troll_coins, 0),
    challenger_troll_coins = COALESCE(challenger_troll_coins, 0);
END;
$$;

ALTER TABLE troll_battles
DROP COLUMN IF EXISTS host_paid_coins,
DROP COLUMN IF EXISTS challenger_paid_coins,
DROP COLUMN IF EXISTS host_free_coins,
DROP COLUMN IF EXISTS challenger_free_coins,
DROP COLUMN IF EXISTS host_trollmonds,
DROP COLUMN IF EXISTS challenger_trollmonds,
DROP COLUMN IF EXISTS guest_trollmonds,
DROP COLUMN IF EXISTS host_trollmods,
DROP COLUMN IF EXISTS guest_trollmods;

DO $$
DECLARE
  view_sql text := $view$
CREATE OR REPLACE VIEW public.battle_arena_view AS
SELECT
  tb.*,
  COALESCE(
    (
      SELECT json_agg(json_build_object(
        'user_id', sp.user_id,
        'username', up.username,
        'avatar_url', up.avatar_url,
        'role', sp.role,
        'joined_at', sp.joined_at
      ))
      FROM (
        SELECT *
        FROM streams_participants sp
        WHERE sp.stream_id = tb.host_stream_id
          AND sp.battle_side = 'A'
          AND sp.role = 'guest'
          AND sp.is_active = true
        ORDER BY sp.joined_at
        LIMIT 4
      ) sp
      LEFT JOIN user_profiles up ON up.id = sp.user_id
    ),
    '[]'::json
  ) AS host_guests,
  COALESCE(
    (
      SELECT json_agg(json_build_object(
        'user_id', sp.user_id,
        'username', up.username,
        'avatar_url', up.avatar_url,
        'role', sp.role,
        'joined_at', sp.joined_at
      ))
      FROM (
        SELECT *
        FROM streams_participants sp
        WHERE sp.stream_id = tb.challenger_stream_id
          AND sp.battle_side = 'B'
          AND sp.role = 'guest'
          AND sp.is_active = true
        ORDER BY sp.joined_at
        LIMIT 4
      ) sp
      LEFT JOIN user_profiles up ON up.id = sp.user_id
    ),
    '[]'::json
  ) AS challenger_guests
FROM troll_battles tb;
$view$;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'streams_participants'
  ) THEN
    EXECUTE view_sql;
  ELSE
    RAISE NOTICE 'Skipping battle_arena_view because streams_participants is missing';
  END IF;
END;
$$;

COMMIT;
