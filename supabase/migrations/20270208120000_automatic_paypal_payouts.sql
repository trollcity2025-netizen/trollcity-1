-- Migration: Automatic PayPal Payouts System

-- 1. Ensure payout_paypal_email exists on user_profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'payout_paypal_email') THEN
        ALTER TABLE user_profiles ADD COLUMN payout_paypal_email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'payout_paypal_email_updated_at') THEN
        ALTER TABLE user_profiles ADD COLUMN payout_paypal_email_updated_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Payout Tiers Configuration
CREATE TABLE IF NOT EXISTS payout_tiers (
  id TEXT PRIMARY KEY,
  coins_required INTEGER NOT NULL,
  usd_amount NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Seed Tiers
INSERT INTO payout_tiers (id, coins_required, usd_amount) VALUES
('tier_12k', 12000, 25.00),
('tier_30k', 30000, 70.00),
('tier_60k', 60000, 150.00),
('tier_120k', 120000, 325.00)
ON CONFLICT (id) DO UPDATE SET
coins_required = EXCLUDED.coins_required,
usd_amount = EXCLUDED.usd_amount;

-- 3. Payout Runs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_runs') THEN
    CREATE TABLE payout_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_date DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      total_payouts INTEGER DEFAULT 0,
      total_coins BIGINT DEFAULT 0,
      total_usd NUMERIC(10,2) DEFAULT 0,
      paypal_batch_id TEXT,
      logs JSONB
    );
  ELSE
    -- Add columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_runs' AND column_name = 'paypal_batch_id') THEN
      ALTER TABLE payout_runs ADD COLUMN paypal_batch_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_runs' AND column_name = 'logs') THEN
      ALTER TABLE payout_runs ADD COLUMN logs JSONB;
    END IF;
  END IF;
END $$;

-- 4. Payouts Table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payouts') THEN
    CREATE TABLE payouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID REFERENCES payout_runs(id),
      user_id UUID REFERENCES user_profiles(id),
      tier_id TEXT REFERENCES payout_tiers(id),
      amount_coins BIGINT NOT NULL,
      amount_usd NUMERIC(10,2) NOT NULL,
      paypal_email TEXT NOT NULL,
      status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'success', 'failed', 'returned')),
      paypal_payout_item_id TEXT,
      paypal_batch_id TEXT,
      failure_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ,
      CONSTRAINT unique_run_user UNIQUE (run_id, user_id)
    );
  ELSE
    -- Add columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payouts' AND column_name = 'run_id') THEN
      ALTER TABLE payouts ADD COLUMN run_id UUID REFERENCES payout_runs(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payouts' AND column_name = 'tier_id') THEN
      ALTER TABLE payouts ADD COLUMN tier_id TEXT REFERENCES payout_tiers(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payouts' AND column_name = 'paypal_batch_id') THEN
      ALTER TABLE payouts ADD COLUMN paypal_batch_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payouts' AND column_name = 'paypal_payout_item_id') THEN
      ALTER TABLE payouts ADD COLUMN paypal_payout_item_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payouts' AND column_name = 'processed_at') THEN
      ALTER TABLE payouts ADD COLUMN processed_at TIMESTAMPTZ;
    END IF;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payouts_run_id ON payouts(run_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- 5. RLS Policies
ALTER TABLE payout_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Admin/Secretary can view all
CREATE POLICY "Admins view payout runs" ON payout_runs
FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'secretary' OR is_admin = true))
);

CREATE POLICY "Admins view payouts" ON payouts
FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'secretary' OR is_admin = true))
);

-- Users can view their own payouts
CREATE POLICY "Users view own payouts" ON payouts
FOR SELECT USING (auth.uid() = user_id);

-- 6. Audit Log for PayPal Email Changes
CREATE OR REPLACE FUNCTION log_paypal_email_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.payout_paypal_email IS DISTINCT FROM NEW.payout_paypal_email THEN
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES (
            auth.uid(), -- user changing their own, or admin changing it
            'update_paypal_email',
            'user_profile',
            NEW.id,
            jsonb_build_object('old_email', OLD.payout_paypal_email, 'new_email', NEW.payout_paypal_email)
        );
        NEW.payout_paypal_email_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_paypal_email_change ON user_profiles;
CREATE TRIGGER trigger_log_paypal_email_change
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION log_paypal_email_change();

-- 7. RPC: Prepare Payout Run (Atomic Logic)
CREATE OR REPLACE FUNCTION prepare_payout_run()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run_id UUID;
  v_user RECORD;
  v_tier RECORD;
  v_count INTEGER := 0;
  v_total_coins BIGINT := 0;
  v_total_usd NUMERIC := 0;
  v_logs JSONB := '[]'::jsonb;
BEGIN
  -- Create Run
  INSERT INTO payout_runs (status) VALUES ('processing') RETURNING id INTO v_run_id;

  -- Iterate eligible users
  FOR v_user IN 
    SELECT id, troll_coins, payout_paypal_email
    FROM user_profiles
    WHERE payout_paypal_email IS NOT NULL
      AND length(payout_paypal_email) > 5
      AND (is_banned IS FALSE OR is_banned IS NULL)
      AND troll_coins >= 12000
  LOOP
    -- Find highest eligible tier
    SELECT * INTO v_tier
    FROM payout_tiers
    WHERE coins_required <= v_user.troll_coins
    ORDER BY coins_required DESC
    LIMIT 1;

    IF v_tier IS NOT NULL THEN
      -- Create Payout Record
      INSERT INTO payouts (run_id, user_id, tier_id, amount_coins, amount_usd, paypal_email, status)
      VALUES (v_run_id, v_user.id, v_tier.id, v_tier.coins_required, v_tier.usd_amount, v_user.payout_paypal_email, 'queued');
      
      -- Deduct Coins (Atomic)
      UPDATE user_profiles
      SET troll_coins = troll_coins - v_tier.coins_required
      WHERE id = v_user.id;
      
      -- Ledger Entry
      INSERT INTO coin_ledger (user_id, delta, bucket, source, ref_id, reason)
      VALUES (v_user.id, -v_tier.coins_required, 'payout', 'automatic_payout', v_run_id::text, 'Automatic Payout: ' || v_tier.id);
      
      v_count := v_count + 1;
      v_total_coins := v_total_coins + v_tier.coins_required;
      v_total_usd := v_total_usd + v_tier.usd_amount;
    END IF;
  END LOOP;

  -- Update Run Stats
  UPDATE payout_runs
  SET total_payouts = v_count,
      total_coins = v_total_coins,
      total_usd = v_total_usd,
      logs = v_logs
  WHERE id = v_run_id;

  RETURN v_run_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION prepare_payout_run FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION prepare_payout_run TO service_role;

-- 8. RPC: Refund Payout Run (for failed API calls)
CREATE OR REPLACE FUNCTION refund_payout_run(p_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payout RECORD;
BEGIN
  FOR v_payout IN SELECT * FROM payouts WHERE run_id = p_run_id AND status = 'queued'
  LOOP
    -- Refund User
    UPDATE user_profiles
    SET troll_coins = troll_coins + v_payout.amount_coins
    WHERE id = v_payout.user_id;
    
    -- Ledger Entry
    INSERT INTO coin_ledger (user_id, delta, bucket, source, ref_id, reason)
    VALUES (v_payout.user_id, v_payout.amount_coins, 'payout', 'payout_refund', p_run_id::text, 'Refund: PayPal Batch Failed');
    
    -- Update Payout Status
    UPDATE payouts
    SET status = 'returned', failure_reason = 'PayPal Batch Submission Failed'
    WHERE id = v_payout.id;
  END LOOP;
  
  UPDATE payout_runs
  SET status = 'failed'
  WHERE id = p_run_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION refund_payout_run FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION refund_payout_run TO service_role;
