-- Add troll_coins RPC Function
-- Used by webhooks and payment processing to add coins to user balance

CREATE OR REPLACE FUNCTION add_troll_coins(
  user_id_input uuid,
  coins_to_add int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET 
    troll_coins = COALESCE(troll_coins, 0) + coins_to_add,
    total_earned_coins = COALESCE(total_earned_coins, 0) + coins_to_add,
    updated_at = NOW()
  WHERE id = user_id_input;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_troll_coins(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION add_troll_coins(uuid, int) TO authenticated;

