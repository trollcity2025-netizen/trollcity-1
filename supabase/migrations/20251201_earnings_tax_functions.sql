-- Earnings & Tax Overview Helper Functions

-- Function to get creators over IRS threshold
CREATE OR REPLACE FUNCTION get_creators_over_threshold(threshold NUMERIC DEFAULT 600)
RETURNS TABLE (
  broadcaster_id UUID,
  total_earnings NUMERIC,
  username TEXT,
  country TEXT,
  tax_form_submitted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    be.broadcaster_id,
    SUM(be.usd_value)::NUMERIC as total_earnings,
    up.username,
    up.country,
    COALESCE(ba.tax_form_submitted, false) as tax_form_submitted
  FROM broadcaster_earnings be
  JOIN user_profiles up ON be.broadcaster_id = up.id
  LEFT JOIN broadcaster_applications ba ON be.broadcaster_id = ba.user_id
  GROUP BY be.broadcaster_id, up.username, up.country, ba.tax_form_submitted
  HAVING SUM(be.usd_value) >= threshold
  ORDER BY total_earnings DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_creators_over_threshold(NUMERIC) TO authenticated;

-- Add index for better performance on earnings queries
CREATE INDEX IF NOT EXISTS idx_broadcaster_earnings_usd_value ON broadcaster_earnings(usd_value);
CREATE INDEX IF NOT EXISTS idx_broadcaster_earnings_created_year ON broadcaster_earnings(EXTRACT(YEAR FROM created_at));


