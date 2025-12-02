-- Create RPC function to reset entire app for launch
-- This function clears all test data: transactions, payouts, balances, etc.

CREATE OR REPLACE FUNCTION reset_app_for_launch()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_counts JSONB := '{}'::jsonb;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR is_admin = TRUE)
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only admins can reset the app');
  END IF;

  -- 1. Delete all coin transactions
  DELETE FROM coin_transactions;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('coin_transactions', (SELECT COUNT(*) FROM coin_transactions));

  -- 2. Delete all payout requests
  DELETE FROM payout_requests;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('payout_requests', (SELECT COUNT(*) FROM payout_requests));

  -- 3. Reset all user coin balances
  UPDATE user_profiles
  SET 
    paid_coin_balance = 0,
    free_coin_balance = 0,
    total_coins_earned = 0,
    total_coins_spent = 0
  WHERE paid_coin_balance > 0 OR free_coin_balance > 0 OR total_coins_earned > 0 OR total_coins_spent > 0;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('balances_reset', (SELECT COUNT(*) FROM user_profiles WHERE paid_coin_balance = 0 AND free_coin_balance = 0));

  -- 4. Delete all notifications
  DELETE FROM notifications;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('notifications', (SELECT COUNT(*) FROM notifications));

  -- 5. Delete all gifts
  DELETE FROM gifts;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('gifts', (SELECT COUNT(*) FROM gifts));

  -- 6. Delete all battle history
  DELETE FROM battle_history;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('battle_history', (SELECT COUNT(*) FROM battle_history));

  -- 7. Delete all battles
  DELETE FROM battles;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('battles', (SELECT COUNT(*) FROM battles));

  -- 8. Delete all officer shift logs
  DELETE FROM officer_shift_logs;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('officer_shift_logs', (SELECT COUNT(*) FROM officer_shift_logs));

  -- 9. Delete all officer shift slots
  DELETE FROM officer_shift_slots;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('officer_shift_slots', (SELECT COUNT(*) FROM officer_shift_slots));

  -- 10. Delete all support tickets
  DELETE FROM support_tickets;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('support_tickets', (SELECT COUNT(*) FROM support_tickets));

  -- 11. Delete all officer actions
  DELETE FROM officer_actions;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('officer_actions', (SELECT COUNT(*) FROM officer_actions));

  -- Log the reset
  INSERT INTO system_logs (event_type, description, metadata, created_at)
  VALUES (
    'app_reset',
    'Application reset for launch - all test data cleared',
    jsonb_build_object(
      'reset_at', NOW(),
      'reset_by', auth.uid(),
      'reset_reason', 'pre_launch_cleanup',
      'deleted_counts', v_deleted_counts
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'App reset for launch completed',
    'deleted_counts', v_deleted_counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reset_app_for_launch() TO authenticated;

COMMENT ON FUNCTION reset_app_for_launch IS 'Resets entire app for launch by deleting all test transactions, payouts, balances, and test data. Admin only.';

