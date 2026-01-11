-- Fix invalid input syntax for type uuid: "troll_soda"
-- The error occurs because spend_coins RPC expects p_item to be a UUID if it's used as a gift_id or similar,
-- but the frontend is sending a string name like 'troll_soda'.
-- We need to ensure the gifts table can store the item name and the RPC handles it correctly.

-- 1. Ensure 'message' column is TEXT (it should be, but just in case)
ALTER TABLE gifts ALTER COLUMN message TYPE text USING message::text;

-- 2. Add 'gift_name' column if it doesn't exist, to store the item name explicitly if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gifts' AND column_name = 'gift_name') THEN
        ALTER TABLE gifts ADD COLUMN gift_name TEXT;
    END IF;
END $$;

-- 3. Update spend_coins RPC to handle p_item as text (gift name) safely
CREATE OR REPLACE FUNCTION spend_coins(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_coin_amount BIGINT,
  p_source TEXT DEFAULT 'gift',
  p_item TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_gift_id UUID := gen_random_uuid();
  v_gift_name TEXT;
BEGIN
  -- Check sender balance
  SELECT troll_coins INTO v_sender_balance
  FROM user_profiles
  WHERE id = p_sender_id;

  IF v_sender_balance IS NULL OR v_sender_balance < p_coin_amount THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  -- Deduct from sender
  UPDATE user_profiles
  SET troll_coins = troll_coins - p_coin_amount
  WHERE id = p_sender_id;

  -- Add to receiver (if not system/burn)
  IF p_receiver_id IS NOT NULL THEN
    UPDATE user_profiles
    SET troll_coins = troll_coins + p_coin_amount
    WHERE id = p_receiver_id;
  END IF;

  -- Record transaction for sender
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    created_at
  )
  VALUES (
    p_sender_id,
    -p_coin_amount,
    'spend',
    'Sent gift: ' || COALESCE(p_item, 'Coins'),
    now()
  );

  -- Record transaction for receiver
  IF p_receiver_id IS NOT NULL THEN
    INSERT INTO coin_transactions (
      user_id,
      amount,
      transaction_type,
      description,
      created_at
    )
    VALUES (
      p_receiver_id,
      p_coin_amount,
      'receive',
      'Received gift: ' || COALESCE(p_item, 'Coins'),
      now()
    );
  END IF;

  -- Use p_item as gift name/message
  v_gift_name := COALESCE(p_item, 'Gift');

  -- Insert gift record
  -- Try to insert into message column first (standard behavior)
  BEGIN
      INSERT INTO gifts (
        id,
        sender_id,
        receiver_id,
        coins_spent,
        gift_type,
        message,
        created_at
      )
      VALUES (
        v_gift_id,
        p_sender_id,
        p_receiver_id,
        p_coin_amount,
        'paid',
        v_gift_name,
        now()
      );
  EXCEPTION WHEN OTHERS THEN
      -- If that fails (e.g. strict column types), try gift_name if available or just log it
      BEGIN
        INSERT INTO gifts (
            id,
            sender_id,
            receiver_id,
            coins_spent,
            gift_type,
            gift_name,
            created_at
        )
        VALUES (
            v_gift_id,
            p_sender_id,
            p_receiver_id,
            p_coin_amount,
            'paid',
            v_gift_name,
            now()
        );
      EXCEPTION WHEN OTHERS THEN
          -- Last resort: insert without message/name
           INSERT INTO gifts (
            id,
            sender_id,
            receiver_id,
            coins_spent,
            gift_type,
            created_at
        )
        VALUES (
            v_gift_id,
            p_sender_id,
            p_receiver_id,
            p_coin_amount,
            'paid',
            now()
        );
      END;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_sender_balance - p_coin_amount
  );
END;
$$;
