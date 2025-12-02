-- Officer Monthly Payroll View
-- Aggregates shift data by month for payroll reporting

-- First, ensure the 'paid' column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'officer_shift_logs' AND column_name = 'paid'
  ) THEN
    ALTER TABLE officer_shift_logs ADD COLUMN paid BOOLEAN DEFAULT false;
  END IF;
END $$;

CREATE OR REPLACE VIEW officer_monthly_payroll AS
SELECT
  u.username,
  u.email,
  DATE_TRUNC('month', osl.shift_start) AS month,
  COALESCE(SUM(osl.hours_worked), 0) AS total_hours,
  COALESCE(SUM(osl.coins_earned), 0) AS total_coins,
  COALESCE(SUM(CASE WHEN COALESCE(osl.paid, false) = false THEN osl.coins_earned ELSE 0 END), 0) AS unpaid_coins,
  COALESCE(SUM(CASE WHEN osl.auto_clocked_out = true THEN 1 ELSE 0 END), 0) AS auto_clockouts,
  COUNT(*) AS total_shifts
FROM officer_shift_logs osl
JOIN user_profiles u ON u.id = osl.officer_id
WHERE osl.shift_end IS NOT NULL -- Only completed shifts
GROUP BY u.username, u.email, DATE_TRUNC('month', osl.shift_start)
ORDER BY month DESC, total_coins DESC;

-- Grant access to authenticated users (officers can view their own, admins can view all)
GRANT SELECT ON officer_monthly_payroll TO authenticated;

