-- Revenue Settings Table Migration
-- Creates table for platform revenue configuration

CREATE TABLE IF NOT EXISTS revenue_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  platform_cut_pct INTEGER DEFAULT 40,
  broadcaster_cut_pct INTEGER DEFAULT 60,
  officer_cut_pct INTEGER DEFAULT 30,
  min_cashout_usd NUMERIC(10,2) DEFAULT 50,
  min_stream_hours_for_cashout INTEGER DEFAULT 10,
  cashout_hold_days INTEGER DEFAULT 7,
  tax_form_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial data if table is empty
INSERT INTO revenue_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policy for admin access
ALTER TABLE revenue_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage revenue settings"
  ON revenue_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );