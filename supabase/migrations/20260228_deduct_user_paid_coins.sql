-- Migration: Provide a stable RPC surface for deducting coins without overload ambiguity
-- Date: 2026-02-28

CREATE OR REPLACE FUNCTION deduct_user_paid_coins(
  p_user_id uuid,
  p_amount bigint,
  p_coin_type text DEFAULT 'troll_coins'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM deduct_coins(p_user_id => p_user_id, p_amount => p_amount, p_coin_type => p_coin_type);
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_user_paid_coins(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_user_paid_coins(uuid, bigint, text) TO service_role;
