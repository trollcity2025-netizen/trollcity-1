-- Launch guardrails: server-side rate limits + gifting circuit breaker

-- 1) System settings toggle for gifting
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS gifts_disabled boolean DEFAULT false;

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS gifts_disabled_reason text;

-- 2) Chat rate limit (per user per stream)
CREATE OR REPLACE FUNCTION public.enforce_stream_chat_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  v_allowed := public.check_rate_limit(
    'chat:' || NEW.user_id::text || ':' || NEW.stream_id::text,
    30,
    60
  );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Rate limit exceeded: chat' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_messages') THEN
    DROP TRIGGER IF EXISTS trg_stream_chat_rate_limit ON public.stream_messages;
    CREATE TRIGGER trg_stream_chat_rate_limit
    BEFORE INSERT ON public.stream_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_stream_chat_rate_limit();
  END IF;
END $$;

-- 3) Gift rate limit (per sender) + gifting disable switch
CREATE OR REPLACE FUNCTION public.enforce_gift_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
  v_disabled boolean;
  v_reason text;
BEGIN
  SELECT gifts_disabled, gifts_disabled_reason
  INTO v_disabled, v_reason
  FROM public.system_settings
  ORDER BY updated_at DESC
  LIMIT 1;

  IF COALESCE(v_disabled, false) THEN
    RAISE EXCEPTION 'Gifting is temporarily disabled: %', COALESCE(v_reason, 'system maintenance') USING ERRCODE = 'P0001';
  END IF;

  v_allowed := public.check_rate_limit(
    'gift:' || NEW.sender_id::text,
    6,
    60
  );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Rate limit exceeded: gifts' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gift_ledger') THEN
    DROP TRIGGER IF EXISTS trg_gift_rate_limit ON public.gift_ledger;
    CREATE TRIGGER trg_gift_rate_limit
    BEFORE INSERT ON public.gift_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_gift_rate_limit();
  END IF;
END $$;
