-- Gift Bonus System
-- Calculates and awards bonus free coins when users reach gift milestones

CREATE OR REPLACE FUNCTION handle_gift_bonus(p_sender_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  total_gifts int;
  bonus int := 0;
  bonus_message text := '';
BEGIN
  -- Count how many gifts user has sent (from transactions table)
  SELECT COUNT(*) INTO total_gifts
  FROM transactions
  WHERE user_id = p_sender_id
    AND type = 'gift'
    AND transaction_type = 'gift';

  -- Determine bonus tiers
  IF total_gifts = 5 THEN 
    bonus := 2;
    bonus_message := '🎉 5 Gifts Milestone!';
  ELSIF total_gifts = 10 THEN 
    bonus := 6;
    bonus_message := '🎉 10 Gifts Milestone!';
  ELSIF total_gifts = 25 THEN 
    bonus := 18;
    bonus_message := '🎉 25 Gifts Milestone!';
  ELSIF total_gifts = 50 THEN 
    bonus := 50;
    bonus_message := '🎉 50 Gifts Milestone!';
  ELSIF total_gifts = 100 THEN 
    bonus := 250;
    bonus_message := '🎉 100 Gifts Milestone!';
  END IF;

  -- Apply bonus if any
  IF bonus > 0 THEN
    UPDATE user_profiles
    SET free_coin_balance = free_coin_balance + bonus
    WHERE id = p_sender_id;

    -- Record bonus transaction
    INSERT INTO coin_transactions (
      user_id,
      type,
      coins,
      description,
      metadata
    ) VALUES (
      p_sender_id,
      'gift_bonus',
      bonus,
      bonus_message,
      jsonb_build_object(
        'total_gifts', total_gifts,
        'bonus_tier', total_gifts
      )
    );
  END IF;

  -- Return bonus info
  RETURN jsonb_build_object(
    'bonus_awarded', bonus > 0,
    'bonus_amount', bonus,
    'total_gifts', total_gifts,
    'message', bonus_message
  );
END;
$$;

-- Add comment
COMMENT ON FUNCTION handle_gift_bonus IS 'Awards bonus free coins when users reach gift milestones (5, 10, 25, 50, 100 gifts)';

