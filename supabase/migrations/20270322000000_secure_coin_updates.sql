-- Secure Coin Update System
-- 1. Updates protect_sensitive_columns to allow updates if app.bypass_coin_protection is set
-- 2. Updates all coin deduction/spending functions to set this variable securely

-- 1. Update the trigger function to check for bypass variable
CREATE OR REPLACE FUNCTION public.protect_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Allow service_role or superusers to bypass
    IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' THEN
        RETURN NEW;
    END IF;

    -- Check for sensitive column changes in user_profiles
    IF TG_TABLE_NAME = 'user_profiles' THEN
        -- Prevent role escalation
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Cannot update restricted column: role';
        END IF;
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_admin';
        END IF;
        IF NEW.is_lead_officer IS DISTINCT FROM OLD.is_lead_officer THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_lead_officer';
        END IF;
        
        -- Prevent currency manipulation
        IF NEW.troll_coins IS DISTINCT FROM OLD.troll_coins THEN
            -- Check for secure bypass flag
            -- We use current_setting with missing_ok=true to avoid errors if not set
            IF current_setting('app.bypass_coin_protection', true) IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'Cannot update restricted column: troll_coins';
            END IF;
        END IF;

        IF NEW.total_earned_coins IS DISTINCT FROM OLD.total_earned_coins THEN
             -- Allow if bypass is set (optional, but good for consistency if functions update this too)
            IF current_setting('app.bypass_coin_protection', true) IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'Cannot update restricted column: total_earned_coins';
            END IF;
        END IF;
        
        -- Prevent leveling cheating
        IF NEW.level IS DISTINCT FROM OLD.level THEN
            RAISE EXCEPTION 'Cannot update restricted column: level';
        END IF;
        IF NEW.xp IS DISTINCT FROM OLD.xp THEN
            -- XP is often updated with coins, so we might want to allow it too if bypass is set
            -- But for now, let's keep it strict unless we find functions that update XP and coins together without bypass
             IF current_setting('app.bypass_coin_protection', true) IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'Cannot update restricted column: xp';
            END IF;
        END IF;
    END IF;

    -- Check for sensitive column changes in streams
    IF TG_TABLE_NAME = 'streams' THEN
        -- Prevent faking live status
        IF NEW.is_live IS DISTINCT FROM OLD.is_live THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_live';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN
             IF NEW.status = 'live' AND OLD.status != 'live' THEN
                 RAISE EXCEPTION 'Cannot manually set status to live';
             END IF;
        END IF;
        
        -- Prevent faking viewers
        IF NEW.current_viewers IS DISTINCT FROM OLD.current_viewers THEN
             RAISE EXCEPTION 'Cannot update restricted column: current_viewers';
        END IF;

        -- Prevent HLS injection
        IF NEW.hls_url IS DISTINCT FROM OLD.hls_url THEN
            RAISE EXCEPTION 'Cannot update restricted column: hls_url';
        END IF;
        IF NEW.hls_path IS DISTINCT FROM OLD.hls_path THEN
            RAISE EXCEPTION 'Cannot update restricted column: hls_path';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Update try_pay_coins (Primary purchase function)
CREATE OR REPLACE FUNCTION public.try_pay_coins(p_user_id UUID, p_amount BIGINT, p_reason TEXT, p_metadata JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance BIGINT;
    v_new_balance BIGINT;
BEGIN
    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- Lock the row to prevent race conditions
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
    
    IF v_balance IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_balance >= p_amount THEN
        v_new_balance := v_balance - p_amount;
        
        -- Deduct
        UPDATE public.user_profiles 
        SET troll_coins = v_new_balance,
            updated_at = NOW()
        WHERE id = p_user_id;
        
        -- Ledger
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, metadata)
        VALUES (p_user_id, -p_amount, 'spend', p_reason, p_metadata);
        
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

-- 3. Update troll_bank_spend_coins (Secondary purchase function)
CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins(
  p_user_id uuid,
  p_amount numeric,
  p_bucket text default 'paid',
  p_source text default 'purchase',
  p_ref_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_balance numeric(20, 2);
  v_new_balance numeric(20, 2);
  v_ledger_id uuid;
begin
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Validate amount
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  -- Lock user profile and check balance
  select troll_coins into v_current_balance
  from user_profiles
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
  
  update user_profiles
  set troll_coins = v_new_balance
  where id = p_user_id;

  -- Insert into ledger (negative delta)
  insert into coin_ledger (
    user_id,
    delta,
    bucket,
    source,
    ref_id,
    metadata,
    direction
  ) values (
    p_user_id,
    -p_amount,
    p_bucket,
    p_source,
    p_ref_id,
    p_metadata,
    'out'
  ) returning id into v_ledger_id;

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id
  );
end;
$$;

-- 4. Update spend_coins (Gifting function)
CREATE OR REPLACE FUNCTION public.spend_coins(
    p_sender_id uuid,
    p_receiver_id uuid,
    p_coin_amount bigint,
    p_source text DEFAULT 'gift'::text,
    p_item text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_sender_created_at TIMESTAMPTZ;
  v_gift_id UUID := gen_random_uuid();
  v_bank_result json;
  v_credit_increase INTEGER;
  v_current_score INTEGER;
  v_new_score INTEGER;
BEGIN
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Check sender's paid coin balance and get created_at
  SELECT Troll_coins, created_at INTO v_sender_balance, v_sender_created_at
  FROM user_profiles
  WHERE id = p_sender_id;

  IF v_sender_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender not found');
  END IF;

  IF v_sender_balance < p_coin_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Not enough coins',
      'current_balance', v_sender_balance,
      'required', p_coin_amount
    );
  END IF;

  -- Deduct coins from sender
  UPDATE user_profiles
  SET 
    Troll_coins = Troll_coins - p_coin_amount,
    total_spent_coins = COALESCE(total_spent_coins, 0) + p_coin_amount,
    updated_at = now()
  WHERE id = p_sender_id;

  -- Grant XP to Sender (Spending XP) - 1 XP per coin spent
  -- Note: grant_xp might also need bypass if it updates user_profiles (xp/level)
  PERFORM public.grant_xp(
    p_sender_id,
    p_coin_amount,
    'spend_coins',
    v_gift_id::text
  );

  -- Log Sender Transaction
  INSERT INTO coin_transactions (
    user_id, type, amount, coin_type, description, metadata, created_at
  ) VALUES (
    p_sender_id, 'gift_sent', -p_coin_amount, 'troll_coins', 
    format('Sent gift: %s', COALESCE(p_item, 'Gift')),
    jsonb_build_object('receiver_id', p_receiver_id, 'source', p_source, 'item', p_item, 'gift_id', v_gift_id),
    now()
  );

  -- Credit Receiver via Troll Bank
  SELECT public.troll_bank_credit_coins(
    p_receiver_id,
    p_coin_amount::numeric,
    'gifted',
    'gift',
    v_gift_id::text,
    jsonb_build_object('sender_id', p_sender_id, 'item', p_item, 'source', p_source)
  ) INTO v_bank_result;

  -- Insert gift record
  INSERT INTO gifts (
    id, sender_id, receiver_id, coins_spent, gift_type, message, created_at
  ) VALUES (
    v_gift_id, p_sender_id, p_receiver_id, p_coin_amount, 'paid', COALESCE(p_item, 'Gift'), now()
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_sender_balance - p_coin_amount);
END;
$$;

-- 5. Update deduct_user_coins (Punishment function)
CREATE OR REPLACE FUNCTION deduct_user_coins(
  p_user_id UUID,
  p_amount BIGINT,
  p_reason TEXT,
  p_appeal_id UUID,
  p_verdict TEXT
)
RETURNS JSON AS $$
DECLARE
  v_current_balance INTEGER;
  v_deducted INTEGER;
BEGIN
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  SELECT troll_coins INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id;

  v_deducted := LEAST(v_current_balance, p_amount);

  UPDATE user_profiles
  SET troll_coins = GREATEST(troll_coins - p_amount, 0)
  WHERE id = p_user_id;

  INSERT INTO punishment_transactions (user_id, coins_deducted, reason, appeal_id, verdict)
  VALUES (p_user_id, v_deducted, p_reason, p_appeal_id, p_verdict);
  
  RETURN json_build_object('success', true, 'deducted', v_deducted, 'remaining', GREATEST(v_current_balance - p_amount, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create/Update deduct_user_troll_coins (Legacy Fallback)
CREATE OR REPLACE FUNCTION public.deduct_user_troll_coins(
    p_user_id uuid,
    p_amount text, -- Accepts string as per frontend usage
    p_coin_type text DEFAULT 'troll_coins'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_amount numeric;
    v_new_balance numeric;
BEGIN
    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    v_amount := p_amount::numeric;
    
    UPDATE user_profiles
    SET troll_coins = troll_coins - v_amount
    WHERE id = p_user_id
    RETURNING troll_coins INTO v_new_balance;
    
    RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_user_troll_coins(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_user_troll_coins(uuid, text, text) TO service_role;
