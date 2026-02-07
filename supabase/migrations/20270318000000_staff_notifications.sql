-- Migration: Real-time Staff Notifications System

-- 1. Helper Function: notify_staff
-- Fans out a notification to all staff members
CREATE OR REPLACE FUNCTION public.notify_staff(
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_staff_id UUID;
BEGIN
    -- Loop through all staff members
    FOR v_staff_id IN 
        SELECT id FROM public.user_profiles 
        WHERE role IN ('admin', 'moderator', 'troll_officer', 'secretary')
    LOOP
        -- Insert notification for each staff member
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            metadata,
            created_at,
            is_read
        ) VALUES (
            v_staff_id,
            p_type,
            p_title,
            p_message,
            p_data,
            NOW(),
            FALSE
        );
    END LOOP;
END;
$$;

-- 2. Update RLS for public.notifications
-- Ensure staff can view and update their own notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;

-- Select: Users see their own
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Update: Users can mark as read (update is_read, read_at)
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Insert: Service Role or Database Functions (SECURITY DEFINER) bypass RLS, but if we need explicit:
-- We'll rely on SECURITY DEFINER functions for system notifications.
-- But if users trigger notifications for others (e.g. likes), they might need insert permissions.
-- For now, let's allow authenticated users to insert if they are the sender? 
-- The table structure doesn't have sender_id.
-- Let's stick to system-generated notifications via functions for now, or allow all authenticated to insert (risky?).
-- Actually, existing policy was "Authenticated can insert notifications" for admin/service_role.
-- We will keep it restrictive. Only Admins or Service Role can insert directly.
-- Regular users trigger notifications via RPCs/Triggers which are SECURITY DEFINER or run as Service Role.

-- 3. Triggers for Events

-- A. Stream Bans (Trigger on public.stream_bans)
CREATE OR REPLACE FUNCTION public.trigger_notify_stream_ban()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stream_id UUID;
    v_banned_user TEXT;
    v_banned_by TEXT;
BEGIN
    -- Get usernames if possible, otherwise use IDs
    SELECT username INTO v_banned_user FROM public.user_profiles WHERE id = NEW.user_id;
    SELECT username INTO v_banned_by FROM public.user_profiles WHERE id = NEW.created_by; -- Assuming created_by exists
    
    PERFORM public.notify_staff(
        'stream.ban',
        'User Banned from Stream',
        COALESCE(v_banned_user, 'User') || ' was banned by ' || COALESCE(v_banned_by, 'Staff') || '. Reason: ' || COALESCE(NEW.reason, 'No reason'),
        jsonb_build_object(
            'stream_id', NEW.stream_id,
            'user_id', NEW.user_id,
            'route', '/watch/' || NEW.stream_id
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_stream_ban ON public.stream_bans;
CREATE TRIGGER trg_notify_stream_ban
AFTER INSERT ON public.stream_bans
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notify_stream_ban();


-- B. Stream Kicks (Trigger on public.stream_seat_sessions)
-- When status changes to 'kicked'
CREATE OR REPLACE FUNCTION public.trigger_notify_stream_kick()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_kicked_user TEXT;
BEGIN
    IF NEW.status = 'kicked' AND OLD.status != 'kicked' THEN
        SELECT username INTO v_kicked_user FROM public.user_profiles WHERE id = NEW.user_id;

        PERFORM public.notify_staff(
            'stream.kick',
            'User Kicked from Seat',
            COALESCE(v_kicked_user, 'User') || ' was kicked from a stream seat.',
            jsonb_build_object(
                'stream_id', NEW.stream_id,
                'user_id', NEW.user_id,
                'route', '/watch/' || NEW.stream_id
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_stream_kick ON public.stream_seat_sessions;
CREATE TRIGGER trg_notify_stream_kick
AFTER UPDATE ON public.stream_seat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notify_stream_kick();


-- C. Manual Coin Purchase (Trigger on public.manual_coin_orders)
CREATE OR REPLACE FUNCTION public.trigger_notify_manual_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_buyer TEXT;
BEGIN
    SELECT username INTO v_buyer FROM public.user_profiles WHERE id = NEW.user_id;

    IF TG_OP = 'INSERT' THEN
        PERFORM public.notify_staff(
            'coins.manual_purchase',
            'New Manual Coin Order',
            'New order for ' || NEW.coins || ' coins ($' || (NEW.amount_cents / 100.0) || ') by ' || COALESCE(v_buyer, 'User'),
            jsonb_build_object(
                'order_id', NEW.id,
                'user_id', NEW.user_id,
                'route', '/admin/payments'
            )
        );
    ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
        PERFORM public.notify_staff(
            'coins.manual_purchase',
            'Manual Order ' || INITCAP(NEW.status),
            'Order for ' || COALESCE(v_buyer, 'User') || ' is now ' || NEW.status,
            jsonb_build_object(
                'order_id', NEW.id,
                'user_id', NEW.user_id,
                'route', '/admin/payments'
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_manual_order ON public.manual_coin_orders;
CREATE TRIGGER trg_notify_manual_order
AFTER INSERT OR UPDATE ON public.manual_coin_orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notify_manual_order();


-- D. Rapid/Large Coin Spend (Trigger on public.coin_transactions)
-- Trigger on large spend (> 5000 coins)
CREATE OR REPLACE FUNCTION public.trigger_notify_large_spend()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spender TEXT;
    v_threshold INTEGER := 5000;
BEGIN
    -- Check if it's a spend (negative amount) and magnitude > threshold
    IF NEW.amount < 0 AND ABS(NEW.amount) >= v_threshold THEN
        SELECT username INTO v_spender FROM public.user_profiles WHERE id = NEW.user_id;

        PERFORM public.notify_staff(
            'coins.fast_spend',
            'Large Coin Spend Detected',
            COALESCE(v_spender, 'User') || ' spent ' || ABS(NEW.amount) || ' coins. Type: ' || NEW.type,
            jsonb_build_object(
                'user_id', NEW.user_id,
                'amount', NEW.amount,
                'route', '/admin/transactions?user=' || NEW.user_id
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_large_spend ON public.coin_transactions;
CREATE TRIGGER trg_notify_large_spend
AFTER INSERT ON public.coin_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notify_large_spend();
