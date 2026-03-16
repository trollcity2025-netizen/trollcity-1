-- Trollz System RPC Functions
-- These functions handle all Trollz and bonus coin operations securely on the backend

-- =============================================
-- TROLLZ FUNCTIONS
-- =============================================

-- Add Trollz to a user's balance
CREATE OR REPLACE FUNCTION add_trollz(
    p_user_id UUID,
    p_amount INTEGER,
    p_type VARCHAR(50),
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_balance INTEGER;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
    END IF;

    -- Update user profile
    UPDATE user_profiles
    SET trollz_balance = COALESCE(trollz_balance, 0) + p_amount
    WHERE id = p_user_id;

    -- Get new balance
    SELECT trollz_balance INTO new_balance
    FROM user_profiles
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO trollz_transactions (user_id, amount, type, description, metadata)
    VALUES (p_user_id, p_amount, p_type, p_description, p_metadata);

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', new_balance,
        'amount_added', p_amount
    );
END;
$$;

-- Spend Trollz (deduct from balance)
CREATE OR REPLACE FUNCTION spend_trollz(
    p_user_id UUID,
    p_amount INTEGER,
    p_type VARCHAR(50),
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance INTEGER;
    new_balance INTEGER;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
    END IF;

    -- Check current balance
    SELECT COALESCE(trollz_balance, 0) INTO current_balance
    FROM user_profiles
    WHERE id = p_user_id;

    IF current_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Insufficient Trollz balance',
            'current_balance', current_balance,
            'required', p_amount
        );
    END IF;

    -- Deduct from balance
    UPDATE user_profiles
    SET trollz_balance = trollz_balance - p_amount
    WHERE id = p_user_id;

    -- Get new balance
    SELECT trollz_balance INTO new_balance
    FROM user_profiles
    WHERE id = p_user_id;

    -- Log transaction (negative amount to indicate spending)
    INSERT INTO trollz_transactions (user_id, amount, type, description, metadata)
    VALUES (p_user_id, -p_amount, p_type, p_description, p_metadata);

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', new_balance,
        'amount_spent', p_amount
    );
END;
$$;

-- =============================================
-- BONUS COIN FUNCTIONS
-- =============================================

-- Add bonus coins (non-cashout eligible)
CREATE OR REPLACE FUNCTION add_bonus_coins(
    p_user_id UUID,
    p_amount INTEGER,
    p_source VARCHAR(50),
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_balance INTEGER;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
    END IF;

    -- Update user profile
    UPDATE user_profiles
    SET bonus_coin_balance = COALESCE(bonus_coin_balance, 0) + p_amount
    WHERE id = p_user_id;

    -- Get new balance
    SELECT bonus_coin_balance INTO new_balance
    FROM user_profiles
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO bonus_coin_transactions (user_id, amount, source, description, metadata)
    VALUES (p_user_id, p_amount, p_source, p_description, p_metadata);

    RETURN jsonb_build_object(
        'success', true,
        'new_bonus_balance', new_balance,
        'amount_added', p_amount
    );
END;
$$;

-- Spend bonus coins (deduct from balance)
CREATE OR REPLACE FUNCTION spend_bonus_coins(
    p_user_id UUID,
    p_amount INTEGER,
    p_source VARCHAR(50),
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance INTEGER;
    new_balance INTEGER;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
    END IF;

    -- Check current balance
    SELECT COALESCE(bonus_coin_balance, 0) INTO current_balance
    FROM user_profiles
    WHERE id = p_user_id;

    IF current_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Insufficient bonus coin balance',
            'current_balance', current_balance,
            'required', p_amount
        );
    END IF;

    -- Deduct from balance
    UPDATE user_profiles
    SET bonus_coin_balance = bonus_coin_balance - p_amount
    WHERE id = p_user_id;

    -- Get new balance
    SELECT bonus_coin_balance INTO new_balance
    FROM user_profiles
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO bonus_coin_transactions (user_id, amount, source, description, metadata)
    VALUES (p_user_id, -p_amount, p_source, p_description, p_metadata);

    RETURN jsonb_build_object(
        'success', true,
        'new_bonus_balance', new_balance,
        'amount_spent', p_amount
    );
END;
$$;

-- =============================================
-- TROLLZ CONVERSION FUNCTION
-- =============================================

-- Convert Trollz to Troll Coins (100 Trollz = 10 Troll Coins)
-- Converted coins go to bonus_coin_balance (not cashout eligible)
CREATE OR REPLACE FUNCTION convert_trollz_to_coins(
    p_user_id UUID,
    p_trollz_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_trollz INTEGER;
    conversion_rate INTEGER := 10; -- 100 Trollz = 10 coins
    min_conversion INTEGER := 100;
    coins_to_award INTEGER;
    trollz_needed INTEGER;
BEGIN
    -- Validate minimum conversion
    IF p_trollz_amount < min_conversion THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Minimum conversion is ' || min_conversion || ' Trollz',
            'min_conversion', min_conversion
        );
    END IF;

    -- Check current Trollz balance
    SELECT COALESCE(trollz_balance, 0) INTO current_trollz
    FROM user_profiles
    WHERE id = p_user_id;

    IF current_trollz < p_trollz_amount THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Insufficient Trollz balance',
            'current_balance', current_trollz,
            'required', p_trollz_amount
        );
    END IF;

    -- Calculate coins to award (100 Trollz = 10 coins)
    coins_to_award := (p_trollz_amount / 100) * conversion_rate;

    IF coins_to_award <= 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Invalid conversion amount'
        );
    END IF;

    -- Deduct Trollz
    UPDATE user_profiles
    SET trollz_balance = trollz_balance - p_trollz_amount
    WHERE id = p_user_id;

    -- Add bonus coins (not cashout eligible)
    UPDATE user_profiles
    SET bonus_coin_balance = COALESCE(bonus_coin_balance, 0) + coins_to_award
    WHERE id = p_user_id;

    -- Log both transactions
    INSERT INTO trollz_transactions (user_id, amount, type, description, metadata)
    VALUES (
        p_user_id, 
        -p_trollz_amount, 
        'conversion', 
        'Converted to ' || coins_to_award || ' bonus coins',
        jsonb_build_object('coins_awarded', coins_to_award)
    );

    INSERT INTO bonus_coin_transactions (user_id, amount, source, description, metadata)
    VALUES (
        p_user_id, 
        coins_to_award, 
        'trollz_conversion', 
        'Converted from ' || p_trollz_amount || ' Trollz',
        jsonb_build_object('trollz_spent', p_trollz_amount)
    );

    RETURN jsonb_build_object(
        'success', true,
        'trollz_spent', p_trollz_amount,
        'coins_awarded', coins_to_award,
        'new_trollz_balance', current_trollz - p_trollz_amount,
        'new_bonus_balance', (
            SELECT bonus_coin_balance 
            FROM user_profiles 
            WHERE id = p_user_id
        )
    );
END;
$$;

-- =============================================
-- GIFT TROLLZ BONUS FUNCTION
-- =============================================

-- Award Trollz bonus when user sends a gift (50% of gift value)
CREATE OR REPLACE FUNCTION award_trollz_for_gift(
    p_user_id UUID,
    p_gift_coins INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    trollz_bonus INTEGER;
BEGIN
    IF p_gift_coins <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gift coins must be positive');
    END IF;

    -- Calculate 50% Trollz bonus
    trollz_bonus := FLOOR(p_gift_coins * 0.5);

    IF trollz_bonus <= 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'trollz_awarded', 0,
            'message', 'Gift amount too small for bonus'
        );
    END IF;

    -- Add Trollz bonus
    UPDATE user_profiles
    SET trollz_balance = COALESCE(trollz_balance, 0) + trollz_bonus
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO trollz_transactions (user_id, amount, type, description, metadata)
    VALUES (
        p_user_id, 
        trollz_bonus, 
        'gift_bonus', 
        'Trollz earned from gifting',
        jsonb_build_object('gift_value', p_gift_coins)
    );

    RETURN jsonb_build_object(
        'success', true,
        'trollz_awarded', trollz_bonus,
        'gift_value', p_gift_coins,
        'new_trollz_balance', (
            SELECT trollz_balance 
            FROM user_profiles 
            WHERE id = p_user_id
        )
    );
END;
$$;

-- =============================================
-- TROLL WHEEL SPIN FUNCTION
-- =============================================

-- Spin the Troll Wheel
-- Cost: 100 Trollz per spin
-- Rewards: Trollz, Bonus Troll Coins, or rare rewards
CREATE OR REPLACE FUNCTION spin_troll_wheel(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    spin_cost INTEGER := 100;
    current_trollz INTEGER;
    wheel_result JSONB;
    reward_type VARCHAR(50);
    reward_amount INTEGER;
    random_seed NUMERIC;
BEGIN
    -- Check current Trollz balance
    SELECT COALESCE(trollz_balance, 0) INTO current_trollz
    FROM user_profiles
    WHERE id = p_user_id;

    IF current_trollz < spin_cost THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Insufficient Trollz balance',
            'current_balance', current_trollz,
            'spin_cost', spin_cost
        );
    END IF;

    -- Deduct spin cost
    UPDATE user_profiles
    SET trollz_balance = trollz_balance - spin_cost
    WHERE id = p_user_id;

    -- Generate random result (weighted probability)
    random_seed := random();

    -- Wheel reward probabilities:
    -- 0-30: Common Trollz (50-200 Trollz) - 30%
    -- 30-55: Uncommon Trollz (250-500 Trollz) - 25%
    -- 55-75: Rare Trollz (600-1000 Trollz) - 20%
    -- 75-90: Bonus Coins (5-25 coins) - 15%
    -- 90-100: Jackpot (50-100 coins) - 10%

    IF random_seed < 0.30 THEN
        -- Common Trollz
        reward_type := 'trollz';
        reward_amount := 50 + FLOOR(random() * 151)::INTEGER; -- 50-200

        UPDATE user_profiles
        SET trollz_balance = COALESCE(trollz_balance, 0) + reward_amount
        WHERE id = p_user_id;

    ELSIF random_seed < 0.55 THEN
        -- Uncommon Trollz
        reward_type := 'trollz';
        reward_amount := 250 + FLOOR(random() * 251)::INTEGER; -- 250-500

        UPDATE user_profiles
        SET trollz_balance = COALESCE(trollz_balance, 0) + reward_amount
        WHERE id = p_user_id;

    ELSIF random_seed < 0.75 THEN
        -- Rare Trollz
        reward_type := 'trollz';
        reward_amount := 600 + FLOOR(random() * 401)::INTEGER; -- 600-1000

        UPDATE user_profiles
        SET trollz_balance = COALESCE(trollz_balance, 0) + reward_amount
        WHERE id = p_user_id;

    ELSIF random_seed < 0.90 THEN
        -- Bonus Coins (5-25)
        reward_type := 'bonus_coins';
        reward_amount := 5 + FLOOR(random() * 21)::INTEGER; -- 5-25

        UPDATE user_profiles
        SET bonus_coin_balance = COALESCE(bonus_coin_balance, 0) + reward_amount
        WHERE id = p_user_id;

    ELSE
        -- Jackpot Bonus Coins (50-100)
        reward_type := 'bonus_coins';
        reward_amount := 50 + FLOOR(random() * 51)::INTEGER; -- 50-100

        UPDATE user_profiles
        SET bonus_coin_balance = COALESCE(bonus_coin_balance, 0) + reward_amount
        WHERE id = p_user_id;
    END IF;

    -- Log the spin
    INSERT INTO troll_wheel_wins (user_id, cost_trollz, reward_type, reward_amount)
    VALUES (p_user_id, spin_cost, reward_type, reward_amount);

    -- Log transaction
    IF reward_type = 'trollz' THEN
        INSERT INTO trollz_transactions (user_id, amount, type, description, metadata)
        VALUES (
            p_user_id, 
            reward_amount, 
            'wheel_spin', 
            'Won from Troll Wheel',
            jsonb_build_object('spin_cost', spin_cost, 'reward_type', reward_type)
        );
    ELSE
        INSERT INTO bonus_coin_transactions (user_id, amount, source, description, metadata)
        VALUES (
            p_user_id, 
            reward_amount, 
            'wheel_spin', 
            'Won from Troll Wheel',
            jsonb_build_object('spin_cost', spin_cost)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'spin_cost', spin_cost,
        'reward_type', reward_type,
        'reward_amount', reward_amount,
        'new_trollz_balance', (
            SELECT trollz_balance 
            FROM user_profiles 
            WHERE id = p_user_id
        ),
        'new_bonus_balance', (
            SELECT bonus_coin_balance 
            FROM user_profiles 
            WHERE id = p_user_id
        )
    );
END;
$$;

-- =============================================
-- GET BALANCE FUNCTION
-- =============================================

-- Get Trollz and Bonus Coin balances
CREATE OR REPLACE FUNCTION get_trollz_balances(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN jsonb_build_object(
        'trollz_balance', COALESCE((SELECT trollz_balance FROM user_profiles WHERE id = p_user_id), 0),
        'bonus_coin_balance', COALESCE((SELECT bonus_coin_balance FROM user_profiles WHERE id = p_user_id), 0),
        'troll_coin_balance', COALESCE((SELECT troll_coins FROM user_profiles WHERE id = p_user_id), 0)
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION add_trollz(UUID, INTEGER, VARCHAR, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION spend_trollz(UUID, INTEGER, VARCHAR, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION add_bonus_coins(UUID, INTEGER, VARCHAR, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION spend_bonus_coins(UUID, INTEGER, VARCHAR, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION convert_trollz_to_coins(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION award_trollz_for_gift(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION spin_troll_wheel(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trollz_balances(UUID) TO authenticated;
