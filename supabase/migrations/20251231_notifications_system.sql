-- Trollifications - Global Notification System
-- Table for storing all user notifications

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN (
      'gift_received',
      'badge_unlocked',
      'payout_status',
      'moderation_action',
      'battle_result',
      'officer_update',
      'system_announcement'
    )
  ),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_id_is_read_idx
  ON notifications (user_id, is_read);

CREATE INDEX IF NOT EXISTS notifications_type_idx
  ON notifications (type);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System can insert notifications (via service role or RPC)
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Function to get unread count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE user_id = p_user_id
      AND is_read = FALSE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_unread_notification_count(UUID) TO authenticated;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = TRUE
  WHERE user_id = p_user_id
    AND is_read = FALSE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_all_notifications_read(UUID) TO authenticated;

-- Function to create notification (for use in triggers/RPC)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Trigger: Notify user when they receive a gift
CREATE OR REPLACE FUNCTION notify_gift_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_notification(
    NEW.receiver_id,
    'gift_received',
    '🎁 Gift Received!',
    format('You received %s coins from @%s', 
      NEW.coins_spent,
      (SELECT username FROM user_profiles WHERE id = NEW.sender_id)
    ),
    jsonb_build_object(
      'gift_id', NEW.id,
      'sender_id', NEW.sender_id,
      'coins_spent', NEW.coins_spent,
      'stream_id', NEW.stream_id
    )
  );
  RETURN NEW;
END;
$$;

-- Only create trigger if gifts table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gifts') THEN
    DROP TRIGGER IF EXISTS trigger_notify_gift_received ON gifts;
    CREATE TRIGGER trigger_notify_gift_received
      AFTER INSERT ON gifts
      FOR EACH ROW
      WHEN (NEW.receiver_id IS NOT NULL)
      EXECUTE FUNCTION notify_gift_received();
  END IF;
END $$;

-- Trigger: Notify user when payout status changes
CREATE OR REPLACE FUNCTION notify_payout_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'approved' THEN
        v_title := '✅ Payout Approved';
        v_message := format('Your payout request of $%s has been approved and will be processed soon.', NEW.cash_amount);
      WHEN 'paid' THEN
        v_title := '💰 Payout Completed';
        v_message := format('Your payout of $%s has been processed successfully.', NEW.cash_amount);
      WHEN 'rejected' THEN
        v_title := '❌ Payout Rejected';
        v_message := format('Your payout request of $%s was rejected. Please check your account for details.', NEW.cash_amount);
      ELSE
        RETURN NEW;
    END CASE;
    
    PERFORM create_notification(
      NEW.user_id,
      'payout_status',
      v_title,
      v_message,
      jsonb_build_object(
        'payout_id', NEW.id,
        'status', NEW.status,
        'cash_amount', NEW.cash_amount,
        'coins_redeemed', NEW.coins_redeemed
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Only create trigger if payout_requests table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_requests') THEN
    DROP TRIGGER IF EXISTS trigger_notify_payout_status ON payout_requests;
    CREATE TRIGGER trigger_notify_payout_status
      AFTER UPDATE ON payout_requests
      FOR EACH ROW
      EXECUTE FUNCTION notify_payout_status();
  END IF;
END $$;

-- Trigger: Notify user when badge is unlocked
CREATE OR REPLACE FUNCTION notify_badge_unlocked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge_name TEXT;
BEGIN
  SELECT badge_name INTO v_badge_name
  FROM badges
  WHERE id = NEW.badge_id;
  
  PERFORM create_notification(
    NEW.user_id,
    'badge_unlocked',
    '🏆 Badge Unlocked!',
    format('You unlocked the "%s" badge!', COALESCE(v_badge_name, 'Unknown Badge')),
    jsonb_build_object(
      'badge_id', NEW.badge_id,
      'earned_at', NEW.earned_at
    )
  );
  
  RETURN NEW;
END;
$$;

-- Only create trigger if user_badges table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_badges') THEN
    DROP TRIGGER IF EXISTS trigger_notify_badge_unlocked ON user_badges;
    CREATE TRIGGER trigger_notify_badge_unlocked
      AFTER INSERT ON user_badges
      FOR EACH ROW
      EXECUTE FUNCTION notify_badge_unlocked();
  END IF;
END $$;

-- Trigger: Notify user when moderation action is taken
CREATE OR REPLACE FUNCTION notify_moderation_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF NEW.target_user_id IS NOT NULL THEN
    CASE NEW.action_type
      WHEN 'warn' THEN
        v_title := '⚠️ Warning Issued';
        v_message := format('You have been issued a warning: %s', NEW.reason);
      WHEN 'ban_user' THEN
        v_title := '🚫 Account Banned';
        v_message := format('Your account has been banned. Reason: %s', NEW.reason);
      WHEN 'suspend_stream' THEN
        v_title := '⏸️ Stream Suspended';
        v_message := format('Your stream has been suspended. Reason: %s', NEW.reason);
      WHEN 'unban_user' THEN
        v_title := '✅ Account Unbanned';
        v_message := 'Your account ban has been lifted.';
      ELSE
        RETURN NEW;
    END CASE;
    
    PERFORM create_notification(
      NEW.target_user_id,
      'moderation_action',
      v_title,
      v_message,
      jsonb_build_object(
        'action_id', NEW.id,
        'action_type', NEW.action_type,
        'reason', NEW.reason,
        'created_by', NEW.created_by,
        'expires_at', NEW.expires_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Only create trigger if moderation_actions table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moderation_actions') THEN
    DROP TRIGGER IF EXISTS trigger_notify_moderation_action ON moderation_actions;
    CREATE TRIGGER trigger_notify_moderation_action
      AFTER INSERT ON moderation_actions
      FOR EACH ROW
      EXECUTE FUNCTION notify_moderation_action();
  END IF;
END $$;

-- View for notifications with user info (for admin)
CREATE OR REPLACE VIEW notifications_view AS
SELECT 
  n.*,
  up.username,
  up.avatar_url
FROM notifications n
LEFT JOIN user_profiles up ON up.id = n.user_id
ORDER BY n.created_at DESC;

GRANT SELECT ON notifications_view TO authenticated;

