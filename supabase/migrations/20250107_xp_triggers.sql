-- XP Triggers for Chat and Gifts

-- 1. Chat XP Trigger (for chat_messages table)
CREATE OR REPLACE FUNCTION trigger_award_chat_xp()
RETURNS TRIGGER AS $$
BEGIN
    -- Award 1 XP per message
    -- add_xp handles daily caps internally
    PERFORM add_xp(NEW.sender_id, 1, 'chat');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_chat_xp ON chat_messages;
CREATE TRIGGER trg_chat_xp
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION trigger_award_chat_xp();

-- 2. Gift XP Trigger (for gifts table)
CREATE OR REPLACE FUNCTION trigger_award_gift_xp()
RETURNS TRIGGER AS $$
DECLARE
    v_xp_amount INTEGER;
BEGIN
    -- Award 1 XP per 10 coins (min 1)
    v_xp_amount := GREATEST(1, FLOOR(NEW.coins_spent / 10));
    PERFORM add_xp(NEW.sender_id, v_xp_amount, 'gift');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_gift_xp ON gifts;
CREATE TRIGGER trg_gift_xp
AFTER INSERT ON gifts
FOR EACH ROW
EXECUTE FUNCTION trigger_award_gift_xp();

-- 3. Chat XP Trigger (for messages table, if used for stream chat)
CREATE OR REPLACE FUNCTION trigger_award_message_xp()
RETURNS TRIGGER AS $$
BEGIN
    -- Only award for stream messages (stream_id is not null)
    IF NEW.stream_id IS NOT NULL THEN
        -- Use sender_id if available, fallback to user_id (some legacy rows might vary, but NEW should have the inserted value)
        -- Assuming sender_id is the standard now per recent migrations
        IF NEW.sender_id IS NOT NULL THEN
            PERFORM add_xp(NEW.sender_id, 1, 'chat');
        ELSIF NEW.user_id IS NOT NULL THEN
             PERFORM add_xp(NEW.user_id, 1, 'chat');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_message_xp ON messages;
CREATE TRIGGER trg_message_xp
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION trigger_award_message_xp();
