-- Global Gift System Database Tables
-- Created: 2026-02-26

-- Gift Catalog - Available gifts in the system
CREATE TABLE IF NOT EXISTS gifts_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 10,
    model_url TEXT,
    thumbnail_url TEXT,
    rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
    animation_type TEXT NOT NULL DEFAULT 'float' CHECK (animation_type IN ('float', 'spin', 'burst', 'drop', 'orbit', 'spotlight', 'fireworks')),
    duration INTEGER NOT NULL DEFAULT 3000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Gift Transactions - Record of all gift sends
CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gift_id UUID NOT NULL REFERENCES gifts_catalog(id) ON DELETE RESTRICT,
    session_id UUID,
    coins_spent INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime for gift_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE gift_transactions;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gift_transactions_sender ON gift_transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_receiver ON gift_transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_session ON gift_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_created ON gift_transactions(created_at DESC);

-- RLS Policies for gift_transactions
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own sent gifts
CREATE POLICY "Users can view own sent gifts" ON gift_transactions
    FOR SELECT USING (auth.uid() = sender_id);

-- Allow users to see their own received gifts
CREATE POLICY "Users can view own received gifts" ON gift_transactions
    FOR SELECT USING (auth.uid() = receiver_id);

-- Allow service role to insert transactions
CREATE POLICY "Service role can insert transactions" ON gift_transactions
    FOR INSERT WITH CHECK (true);

-- Insert default gifts catalog
INSERT INTO gifts_catalog (name, description, price, rarity, animation_type, duration) VALUES
    ('Heart', 'A classic heart to show your love', 10, 'common', 'float', 3000),
    ('Rose', 'A beautiful virtual rose', 25, 'common', 'float', 3500),
    ('Star', 'Shining star for your favorite', 50, 'uncommon', 'spin', 4000),
    ('Diamond', 'A sparkling diamond', 100, 'uncommon', 'spin', 4500),
    ('Crown', 'Royal crown for royalty', 250, 'rare', 'orbit', 5000),
    ('Dragon', 'A fierce dragon companion', 500, 'epic', 'drop', 6000),
    ('Phoenix', 'Rising from ashes', 1000, 'legendary', 'fireworks', 8000),
    ('Trophy', 'Champions trophy', 2000, 'legendary', 'spotlight', 10000),
    ('Galaxy', 'Entire galaxy in a bottle', 5000, 'mythic', 'fireworks', 12000),
    ('Diamond Crown', 'Ultimate crown of diamonds', 10000, 'mythic', 'spotlight', 15000)
ON CONFLICT DO NOTHING;

-- Create function to get user coin balance
CREATE OR REPLACE FUNCTION get_user_coins(user_id UUID)
RETURNS INTEGER AS $$
    SELECT coins FROM user_profiles WHERE id = user_id;
$$ LANGUAGE sql STABLE;

-- Create function to deduct coins for gift
CREATE OR REPLACE FUNCTION send_gift(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_gift_id UUID,
    p_session_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT, transaction_id UUID) AS $$
DECLARE
    v_gift_price INTEGER;
    v_sender_coins INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Get gift price
    SELECT price INTO v_gift_price FROM gifts_catalog WHERE id = p_gift_id AND is_active = true;
    
    IF v_gift_price IS NULL THEN
        RETURN QUERY SELECT false, 'Gift not found or inactive', NULL::UUID;
        RETURN;
    END IF;
    
    -- Get sender coin balance
    SELECT coins INTO v_sender_coins FROM user_profiles WHERE id = p_sender_id;
    
    IF v_sender_coins IS NULL THEN
        RETURN QUERY SELECT false, 'Sender profile not found', NULL::UUID;
        RETURN;
    END IF;
    
    IF v_sender_coins < v_gift_price THEN
        RETURN QUERY SELECT false, 'Insufficient coins', NULL::UUID;
        RETURN;
    END IF;
    
    -- Deduct coins from sender
    UPDATE user_profiles 
    SET coins = coins - v_gift_price, 
        updated_at = NOW() 
    WHERE id = p_sender_id;
    
    -- Record the transaction
    INSERT INTO gift_transactions (sender_id, receiver_id, gift_id, session_id, coins_spent)
    VALUES (p_sender_id, p_receiver_id, p_gift_id, p_session_id, v_gift_price)
    RETURNING id INTO v_transaction_id;
    
    RETURN QUERY SELECT true, 'Gift sent successfully', v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to broadcast gift events via Supabase Realtime
CREATE OR REPLACE FUNCTION broadcast_gift_event()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'gift_events',
        json_build_object(
            'id', NEW.id,
            'sender_id', NEW.sender_id,
            'receiver_id', NEW.receiver_id,
            'gift_id', NEW.gift_id,
            'session_id', NEW.session_id,
            'coins_spent', NEW.coins_spent,
            'created_at', NEW.created_at
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new gift transactions
DROP TRIGGER IF EXISTS trigger_gift_broadcast ON gift_transactions;
CREATE TRIGGER trigger_gift_broadcast
    AFTER INSERT ON gift_transactions
    FOR EACH ROW
    EXECUTE FUNCTION broadcast_gift_event();
