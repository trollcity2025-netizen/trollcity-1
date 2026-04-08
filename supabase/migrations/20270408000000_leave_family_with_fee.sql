-- 20270408000000_leave_family_with_fee.sql

-- Function to allow family members to leave with an exit fee
CREATE OR REPLACE FUNCTION public.leave_family(
  p_user_id UUID,
  p_family_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_exit_fee INTEGER;
  v_remaining_members INTEGER;
  v_distribution_amount INTEGER;
  v_user_balance INTEGER;
  v_family_coins INTEGER;
BEGIN
  -- Check if user is actually in the family
  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = p_user_id AND family_id = p_family_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You are not a member of this family'
    );
  END IF;

  -- Cannot leave if you're the only leader
  IF EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id AND role = 'leader' AND user_id = p_user_id
  ) AND (
    SELECT COUNT(*) FROM public.family_members
    WHERE family_id = p_family_id AND role = 'leader'
  ) = 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You cannot leave the family as the only leader. Promote another member first.'
    );
  END IF;

  -- Get family vault total
  SELECT COALESCE(family_coins, 0) INTO v_family_coins
  FROM public.family_stats
  WHERE family_id = p_family_id;

  -- Calculate exit fee (10% of family earnings)
  v_exit_fee := GREATEST(0, FLOOR(v_family_coins * 0.1));

  -- Check user's balance
  SELECT COALESCE(troll_coins, 0) INTO v_user_balance
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF v_user_balance < v_exit_fee THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient Troll Coins to pay the exit fee'
    );
  END IF;

  -- Get count of remaining members (excluding the leaving user)
  SELECT COUNT(*) - 1 INTO v_remaining_members
  FROM public.family_members
  WHERE family_id = p_family_id;

  -- If no remaining members, exit fee goes to family vault (but user still leaves)
  IF v_remaining_members <= 0 THEN
    v_distribution_amount := 0;
  ELSE
    v_distribution_amount := FLOOR(v_exit_fee / v_remaining_members);
  END IF;

  -- Start transaction
  BEGIN
    -- Deduct exit fee from user's balance
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_exit_fee
    WHERE id = p_user_id;

    -- Distribute to remaining members
    IF v_distribution_amount > 0 THEN
      UPDATE public.user_profiles
      SET troll_coins = troll_coins + v_distribution_amount
      FROM public.family_members fm
      WHERE fm.user_id = user_profiles.id
        AND fm.family_id = p_family_id
        AND fm.user_id != p_user_id;
    END IF;

    -- Remove user from family_members
    DELETE FROM public.family_members
    WHERE user_id = p_user_id AND family_id = p_family_id;

    -- Remove from troll_family_members if exists
    DELETE FROM public.troll_family_members
    WHERE user_id = p_user_id AND family_id = p_family_id;

    -- Create notification for remaining members
    INSERT INTO public.family_notifications (
      family_id,
      title,
      message,
      severity,
      is_read,
      notification_type,
      related_user_id
    ) VALUES (
      p_family_id,
      'Member Left Family',
      'A member has left the family',
      'info',
      false,
      'member_leave',
      p_user_id
    );

    -- Log the exit fee transaction
    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      transaction_type,
      description,
      created_at
    ) VALUES (
      p_user_id,
      -v_exit_fee,
      'family_exit_fee',
      'Family exit fee payment',
      NOW()
    );

    -- Log distribution transactions for remaining members
    IF v_distribution_amount > 0 THEN
      INSERT INTO public.coin_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        created_at
      )
      SELECT
        fm.user_id,
        v_distribution_amount,
        'family_exit_bonus',
        'Family exit fee distribution',
        NOW()
      FROM public.family_members fm
      WHERE fm.family_id = p_family_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'exit_fee', v_exit_fee,
      'distribution_amount', v_distribution_amount,
      'remaining_members', v_remaining_members
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to leave family: ' || SQLERRM
      );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.leave_family(UUID, UUID) TO authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION public.leave_family(UUID, UUID) IS 'Allows a family member to leave the family by paying 10% of family earnings as exit fee, distributed to remaining members';