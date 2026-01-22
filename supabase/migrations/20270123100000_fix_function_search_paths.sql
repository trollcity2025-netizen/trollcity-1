-- Fix function search path warnings by setting search_path = '' and qualifying schema references
-- This migration updates 12 functions to be secure against search_path manipulation

-- 1. get_user_gift_history
DROP FUNCTION IF EXISTS public.get_user_gift_history(uuid, int);
CREATE OR REPLACE FUNCTION public.get_user_gift_history(
    p_user_id uuid,
    p_limit int DEFAULT 50
)
RETURNS TABLE (
    id uuid,
    direction text,
    amount int,
    other_username text,
    gift_name text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ct.id,
        CASE
            WHEN ct.type LIKE '%sent%' THEN 'sent'
            ELSE 'received'
        END as direction,
        ABS(ct.amount) as amount,
        COALESCE(up.username, 'Unknown') as other_username,
        COALESCE(
            ct.metadata->>'gift_name',
            ct.metadata->>'item',
            ct.metadata->>'gift_type',
            'Gift'
        ) as gift_name,
        ct.created_at
    FROM public.coin_transactions ct
    LEFT JOIN public.user_profiles up ON up.id = (
        CASE
            WHEN ct.type LIKE '%sent%' THEN (ct.metadata->>'receiver_id')::uuid
            ELSE (ct.metadata->>'sender_id')::uuid
        END
    )
    WHERE ct.user_id = p_user_id
    AND (
        ct.type = 'gift_sent' 
        OR ct.type = 'gift_received' 
        OR ct.type = 'gift_sent_wall' 
        OR ct.type = 'gift_received_wall'
        OR ct.type = 'gift' -- legacy
    )
    ORDER BY ct.created_at DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_gift_history(uuid, int) TO authenticated;

-- 2. troll_bank_credit_coins (Latest version with Admin Pool + Loan Repayment)
DROP FUNCTION IF EXISTS public.troll_bank_credit_coins(uuid, int, text, text, text, jsonb);
CREATE OR REPLACE FUNCTION public.troll_bank_credit_coins(
    p_user_id uuid,
    p_coins int,
    p_bucket text,        -- 'paid' | 'gifted' | 'promo' | 'loan'
    p_source text,        -- 'coin_purchase' | 'gift' | 'admin_grant' | 'loan_disbursement' | etc.
    p_ref_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_balance bigint;
    v_loan_record record;
    v_repay_amount bigint := 0;
    v_user_gets bigint;
    v_new_loan_balance bigint;
    v_loan_status text;
    v_gift_repayment_enabled boolean := false;
BEGIN
    -- Validate p_coins > 0
    IF p_coins <= 0 THEN
        RAISE EXCEPTION 'Coins must be positive';
    END IF;

    -- Lock user profile row
    SELECT troll_coins INTO v_user_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Lock active loan row if exists
    SELECT * INTO v_loan_record
    FROM public.loans
    WHERE user_id = p_user_id AND status = 'active'
    LIMIT 1
    FOR UPDATE;

    -- Check Feature Flags (Safely handle if table doesn't exist)
    BEGIN
        SELECT is_enabled INTO v_gift_repayment_enabled
        FROM public.bank_feature_flags
        WHERE key = 'gift_repayment_enabled';
    EXCEPTION WHEN OTHERS THEN
        v_gift_repayment_enabled := false;
    END;

    -- Determine repayment eligibility
    -- Eligible buckets: 'paid' (always), 'gifted' (if flag enabled)
    IF v_loan_record IS NOT NULL THEN
        IF p_bucket = 'paid' OR (p_bucket = 'gifted' AND v_gift_repayment_enabled = true) THEN
            -- repay = min(loan_balance, floor(p_coins * 0.50))
            v_repay_amount := LEAST(v_loan_record.balance, FLOOR(p_coins * 0.50)::bigint);
        END IF;
    END IF;

    v_user_gets := p_coins - v_repay_amount;

    -- Insert ledger rows
    -- a) Repayment
    IF v_repay_amount > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata)
        VALUES (p_user_id, -v_repay_amount, 'repayment', 'auto_repay', p_ref_id, p_metadata);

        -- Update loan
        UPDATE public.loans
        SET balance = balance - v_repay_amount,
            status = CASE WHEN balance - v_repay_amount <= 0 THEN 'paid' ELSE status END,
            closed_at = CASE WHEN balance - v_repay_amount <= 0 THEN now() ELSE closed_at END
        WHERE id = v_loan_record.id
        RETURNING balance, status INTO v_new_loan_balance, v_loan_status;

        -- NEW: Credit Admin Pool (Treasury) with Repayment
        -- "instantly paid back automatically to admin pool"
        BEGIN
            INSERT INTO public.admin_allocation_buckets (bucket_name) VALUES ('Treasury') ON CONFLICT DO NOTHING;
            
            UPDATE public.admin_allocation_buckets
            SET balance_coins = balance_coins + v_repay_amount
            WHERE bucket_name = 'Treasury';

            -- Audit Log for Repayment to Pool
            INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
            VALUES (v_repay_amount, 'Loan Repayment from ' || p_user_id, p_user_id, NOW());
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors if admin tables don't exist yet (robustness)
            NULL;
        END;

    ELSE
        v_new_loan_balance := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.balance ELSE 0 END;
        v_loan_status := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.status ELSE 'none' END;
    END IF;

    -- b) Credit
    IF v_user_gets > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata)
        VALUES (p_user_id, v_user_gets, p_bucket, p_source, p_ref_id, p_metadata);
    END IF;

    -- Update user balance (troll_coins)
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_user_gets
    WHERE id = p_user_id;

    RETURN json_build_object(
        'repay', v_repay_amount,
        'user_gets', v_user_gets,
        'new_loan_balance', v_new_loan_balance,
        'loan_status', v_loan_status
    );
END;
$$;

-- 3. apply_troll_pass_bundle
DROP FUNCTION IF EXISTS public.apply_troll_pass_bundle(uuid);
CREATE OR REPLACE FUNCTION public.apply_troll_pass_bundle(
    p_user_id uuid
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_new_expiry timestamptz;
    v_coins int := 1500; -- Bundle includes 1500 coins
    v_bank_result json;
BEGIN
    -- 1. Credit Coins using Troll Bank (Atomic, handles loan repayment if any)
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        v_coins,
        'paid', -- Treat as paid coins since Troll Pass is purchased
        'troll_pass_bundle',
        NULL, -- No specific ref_id passed here, could be added if needed
        jsonb_build_object('item', 'Troll Pass Bundle')
    ) INTO v_bank_result;

    -- 2. Update Expiry (Extend if active, set new if expired)
    SELECT 
        CASE 
            WHEN troll_pass_expires_at > now() THEN troll_pass_expires_at + interval '30 days'
            ELSE now() + interval '30 days'
        END
    INTO v_new_expiry
    FROM public.user_profiles
    WHERE id = p_user_id;

    -- Handle case where user might not be found (unlikely) or null date
    IF v_new_expiry IS NULL THEN
        v_new_expiry := now() + interval '30 days';
    END IF;

    UPDATE public.user_profiles
    SET troll_pass_expires_at = v_new_expiry
    WHERE id = p_user_id;

    RETURN v_new_expiry;
END;
$$;

-- 4. troll_bank_spend_coins
DROP FUNCTION IF EXISTS public.troll_bank_spend_coins(uuid, int, text, text, text, jsonb);
CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins(
  p_user_id uuid,
  p_amount int,
  p_bucket text default 'paid',
  p_source text default 'purchase',
  p_ref_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
SET search_path = ''
as $$
declare
  v_current_balance int;
  v_new_balance int;
  v_ledger_id uuid;
begin
  -- Validate amount
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  -- Lock user profile and check balance
  select troll_coins into v_current_balance
  from public.user_profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'User not found');
  end if;

  if v_current_balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient funds', 'current_balance', v_current_balance);
  end if;

  -- Deduct coins
  v_new_balance := v_current_balance - p_amount;
  
  update public.user_profiles
  set troll_coins = v_new_balance
  where id = p_user_id;

  -- Insert into ledger (negative delta)
  insert into public.coin_ledger (
    user_id,
    delta,
    bucket,
    source,
    ref_id,
    metadata
  ) values (
    p_user_id,
    -p_amount,
    p_bucket,
    p_source,
    p_ref_id,
    p_metadata
  ) returning id into v_ledger_id;

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id
  );
end;
$$;

-- 5. protect_owner_admin_changes
DROP TRIGGER IF EXISTS tr_protect_owner_admin ON public.user_profiles;
DROP FUNCTION IF EXISTS public.protect_owner_admin_changes();
CREATE OR REPLACE FUNCTION public.protect_owner_admin_changes()
RETURNS TRIGGER AS $$
DECLARE
  owner_email TEXT := 'trollcity2025@gmail.com';
  target_is_owner BOOLEAN;
  actor_is_owner BOOLEAN;
BEGIN
  -- Determine if the target user is the owner
  -- We check OLD email to identify the owner record
  target_is_owner := (OLD.email IS NOT NULL AND LOWER(OLD.email) = owner_email);

  IF target_is_owner THEN
    -- Check if the executing user is the owner
    -- We assume auth.uid() returns the ID of the user performing the update
    actor_is_owner := (auth.uid() = OLD.id);
    
    -- If the actor is NOT the owner
    IF NOT actor_is_owner THEN
      -- Prevent changing role away from admin
      IF NEW.role != 'admin' THEN
        RAISE EXCEPTION 'CRITICAL: You cannot remove Admin privileges from the Owner account.';
      END IF;
      
      -- Prevent changing is_admin to false
      IF NEW.is_admin = false THEN
        RAISE EXCEPTION 'CRITICAL: You cannot remove Admin privileges from the Owner account.';
      END IF;
      
      -- Prevent changing the email of the owner
      IF NEW.email IS NULL OR LOWER(NEW.email) != owner_email THEN
         RAISE EXCEPTION 'CRITICAL: You cannot change the Owner email address.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

CREATE TRIGGER tr_protect_owner_admin
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_owner_admin_changes();

-- 6. can_post_daily_login
DROP FUNCTION IF EXISTS public.can_post_daily_login();
CREATE OR REPLACE FUNCTION public.can_post_daily_login()
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_post_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  SELECT COUNT(*) INTO v_post_count
  FROM public.daily_login_posts
  WHERE user_id = v_user_id
  AND DATE(posted_at) = CURRENT_DATE;
  
  RETURN v_post_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

GRANT EXECUTE ON FUNCTION public.can_post_daily_login TO authenticated;

-- 7. record_daily_login_post
DROP FUNCTION IF EXISTS public.record_daily_login_post(UUID, INTEGER);
CREATE OR REPLACE FUNCTION public.record_daily_login_post(
  p_post_id UUID,
  p_coins INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  coins_earned INTEGER,
  message TEXT
) AS $$
DECLARE
  v_user_id UUID;
  v_already_posted BOOLEAN;
  v_inserted_id UUID;
BEGIN
  -- Get the user ID from the post
  SELECT user_id INTO v_user_id FROM public.troll_wall_posts WHERE id = p_post_id;
  
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0::INTEGER, 'Post not found'::TEXT;
    RETURN;
  END IF;

  -- Check if user has already posted TODAY
  SELECT EXISTS(
    SELECT 1 FROM public.daily_login_posts
    WHERE user_id = v_user_id
    AND DATE(posted_at) = DATE(NOW())
  ) INTO v_already_posted;

  IF v_already_posted THEN
    RETURN QUERY SELECT false, 0::INTEGER, 'You have already posted today. Come back tomorrow!'::TEXT;
    RETURN;
  END IF;

  -- Clamp coins to 0-100 range
  p_coins := GREATEST(0, LEAST(100, p_coins));

  -- Try to insert the daily login post
  BEGIN
    INSERT INTO public.daily_login_posts (user_id, post_id, coins_earned, posted_at)
    VALUES (v_user_id, p_post_id, p_coins, NOW())
    RETURNING id INTO v_inserted_id;

    -- Award coins to user
    -- Updating free_troll_coins as per original migration logic
    UPDATE public.user_profiles
    SET 
      free_troll_coins = free_troll_coins + p_coins,
      total_earned_coins = total_earned_coins + p_coins,
      updated_at = NOW()
    WHERE id = v_user_id;

    RETURN QUERY SELECT true, p_coins, 'Daily post recorded and coins awarded'::TEXT;
  EXCEPTION WHEN unique_violation THEN
    -- Already posted today - this handles the race condition
    RETURN QUERY SELECT false, 0::INTEGER, 'You have already posted today. Come back tomorrow!'::TEXT;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

GRANT EXECUTE ON FUNCTION public.record_daily_login_post(UUID, INTEGER) TO authenticated;

-- 8. add_troll_coins
DROP FUNCTION IF EXISTS public.add_troll_coins(uuid, int);
CREATE OR REPLACE FUNCTION public.add_troll_coins(
    user_id uuid,
    amount int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        user_id,
        amount,
        'promo',
        'level_reward',
        NULL,
        jsonb_build_object('legacy_function', 'add_troll_coins')
    ) INTO v_result;
END;
$$;

-- 9. add_free_coins
DROP FUNCTION IF EXISTS public.add_free_coins(uuid, int);
CREATE OR REPLACE FUNCTION public.add_free_coins(
    p_user_id uuid,
    p_amount int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_amount,
        'promo',
        'troll_surprise',
        NULL,
        jsonb_build_object('legacy_function', 'add_free_coins')
    ) INTO v_result;
END;
$$;

-- 10. credit_coins
DROP FUNCTION IF EXISTS public.credit_coins(uuid, int, text);
CREATE OR REPLACE FUNCTION public.credit_coins(
    p_user_id uuid,
    p_coins int,
    p_reason text DEFAULT 'legacy_credit'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_coins,
        'paid',
        'legacy_credit',
        NULL,
        jsonb_build_object('reason', p_reason, 'legacy_function', 'credit_coins')
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 11. admin_grant_coins
DROP FUNCTION IF EXISTS public.admin_grant_coins(uuid, int, text);
CREATE OR REPLACE FUNCTION public.admin_grant_coins(
    p_user_id uuid,
    p_amount int,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_amount,
        'promo',
        'admin_grant',
        NULL,
        jsonb_build_object('reason', p_reason)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 12. approve_manual_order
DROP FUNCTION IF EXISTS public.approve_manual_order(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.approve_manual_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_external_tx_id text
) returns table (success boolean, new_balance integer, error_message text)
language plpgsql
security definer
SET search_path = ''
as $$
declare
  v_order public.manual_coin_orders%rowtype;
  v_balance integer;
  v_purchase_type text;
  v_troll_pass_expires_at timestamptz;
  v_bank_result jsonb;
begin
  select * into v_order from public.manual_coin_orders where id = p_order_id for update;
  if not found then
    return query select false, null::integer, 'order not found';
    return;
  end if;
  if v_order.status <> 'pending' then
    if v_order.status = 'fulfilled' then
      -- Just return current balance
      select troll_coins into v_balance from public.user_profiles where id = v_order.user_id;
      return query select true, v_balance, null::text;
      return;
    end if;
    return query select false, null::integer, 'invalid status';
    return;
  end if;

  v_purchase_type := coalesce(v_order.metadata->>'purchase_type', '');

  update public.manual_coin_orders
    set status = 'paid', paid_at = now(), external_tx_id = coalesce(p_external_tx_id, external_tx_id)
    where id = p_order_id;

  -- Handle Troll Pass vs Regular Coins
  if v_purchase_type = 'troll_pass_bundle' then
    v_troll_pass_expires_at := public.apply_troll_pass_bundle(v_order.user_id);
  else
    -- Regular coin purchase
    -- Use Troll Bank
    SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins,
        'paid',
        'manual_purchase',
        p_order_id::text
    ) INTO v_bank_result;
    
    -- Update stats (total_earned_coins, etc) - Troll Bank only updates troll_coins and ledger.
    -- We might need to update total_earned_coins separately if it's tracked separately from balance.
    UPDATE public.user_profiles
    SET 
        paid_coins = coalesce(paid_coins, 0) + v_order.coins,
        total_earned_coins = coalesce(total_earned_coins, 0) + v_order.coins
    WHERE id = v_order.user_id;
  end if;

  -- Insert wallet transaction (legacy/audit?)
  insert into public.wallet_transactions (user_id, type, currency, amount, reason, source, reference_id, metadata)
  values (
    v_order.user_id,
    'credit',
    'USD', -- Assuming USD for manual orders usually
    v_order.amount_usd,
    'Coin Purchase',
    'manual_order',
    p_order_id::text,
    v_order.metadata
  );

  -- Get final balance
  select troll_coins into v_balance from public.user_profiles where id = v_order.user_id;
  return query select true, v_balance, null::text;
end;
$$;
