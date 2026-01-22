-- Credit Score System Migration
-- Date: 2026-01-21
-- Purpose: Public credit score (0-800) with auditable events and loan integration hooks

-- 1) user_credit: fast lookup table for public display + owner/admin detail
CREATE TABLE IF NOT EXISTS public.user_credit (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 400 CHECK (score >= 0 AND score <= 800),
  tier TEXT NOT NULL DEFAULT 'Building',
  trend_7d SMALLINT NOT NULL DEFAULT 0, -- -1, 0, +1
  loan_reliability NUMERIC(5,2) NOT NULL DEFAULT 0, -- explanatory submetric (0-100)
  components JSONB, -- optional debug/admin detail
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_at TIMESTAMPTZ
);

-- Helpful index for ordering by score
CREATE INDEX IF NOT EXISTS idx_user_credit_score ON public.user_credit(score DESC);
CREATE INDEX IF NOT EXISTS idx_user_credit_tier ON public.user_credit(tier);

-- 2) credit_events: immutable audit log of credit changes
CREATE TABLE IF NOT EXISTS public.credit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  delta INTEGER NOT NULL,
  event_key TEXT, -- idempotency key
  source_table TEXT, -- e.g., loan_payments, moderation_actions
  source_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: prevent double application of same source event when event_key provided
CREATE UNIQUE INDEX IF NOT EXISTS ux_credit_events_event_key
  ON public.credit_events(event_key)
  WHERE event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_events_user_created
  ON public.credit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_events_event_type
  ON public.credit_events(event_type);

-- 3) Public view exposing only non-sensitive fields
DO $$
DECLARE
  v_kind char;
BEGIN
  SELECT relkind INTO v_kind FROM pg_class WHERE oid = 'public.public_user_credit'::regclass;
  IF FOUND THEN
    IF v_kind = 'v' THEN
      EXECUTE 'DROP VIEW public.public_user_credit CASCADE';
    ELSE
      EXECUTE 'DROP TABLE public.public_user_credit CASCADE';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE VIEW public.public_user_credit AS
SELECT user_id, score, tier, trend_7d, updated_at
FROM public.user_credit;

-- 4) RLS Policies
ALTER TABLE public.user_credit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_events ENABLE ROW LEVEL SECURITY;

-- Allow owners to read full credit row
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_credit' AND policyname = 'user_credit_select_owner'
    ) THEN
        CREATE POLICY user_credit_select_owner ON public.user_credit FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- Allow service role full access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_credit' AND policyname = 'user_credit_service_role_all'
    ) THEN
        CREATE POLICY user_credit_service_role_all ON public.user_credit FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

-- Allow owners to view their own credit events
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_events' AND policyname = 'credit_events_select_owner'
    ) THEN
        CREATE POLICY credit_events_select_owner ON public.credit_events FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- Allow service role full access to credit_events
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_events' AND policyname = 'credit_events_service_role_all'
    ) THEN
        CREATE POLICY credit_events_service_role_all ON public.credit_events FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

-- Public access to limited view
GRANT SELECT ON public.public_user_credit TO anon, authenticated;

-- Base grants for authenticated users (owner policies still apply)
GRANT SELECT ON public.user_credit TO authenticated;
GRANT SELECT ON public.credit_events TO authenticated;

-- 5) Helper function: derive tier from score
CREATE OR REPLACE FUNCTION public.get_credit_tier(p_score INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF p_score < 150 THEN RETURN 'Untrusted';
  ELSIF p_score < 300 THEN RETURN 'Shaky';
  ELSIF p_score < 450 THEN RETURN 'Building';
  ELSIF p_score < 600 THEN RETURN 'Reliable';
  ELSIF p_score < 700 THEN RETURN 'Trusted';
  ELSE RETURN 'Elite';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6) Helper function: clamp score to 0..800
CREATE OR REPLACE FUNCTION public.clamp_credit_score(p_score INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF p_score < 0 THEN RETURN 0; END IF;
  IF p_score > 800 THEN RETURN 800; END IF;
  RETURN p_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7) Seed defaults for existing users (idempotent)
INSERT INTO public.user_credit (user_id)
SELECT id FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_credit c WHERE c.user_id = u.id);

-- 8) Public user_credit view security barrier
ALTER VIEW public.public_user_credit SET (security_barrier = true);
