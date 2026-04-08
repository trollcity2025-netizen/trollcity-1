-- Migration: Add Background Notifications for Messages and Payouts
-- Triggers notifications for:
-- 1. Direct Messages (conversation_messages) -> Recipient
-- 2. Payout Requests (payout_requests) -> Secretaries/Admins

-- ============================================================================
-- 1. NEW MESSAGE NOTIFICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recipient_id UUID;
    v_sender_name TEXT;
BEGIN
    -- Don't send notification to sender (admin or regular user sending to themselves)
    IF NEW.sender_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the recipient (the other person in the conversation)
    SELECT user_id INTO v_recipient_id
    FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
    LIMIT 1;

    -- If no recipient found or recipient is the sender, exit
    IF v_recipient_id IS NULL OR v_recipient_id = NEW.sender_id THEN
        RETURN NEW;
    END IF;

    -- Get sender name
    SELECT username INTO v_sender_name
    FROM public.user_profiles
    WHERE id = NEW.sender_id;

    -- Insert Notification
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        link,
        metadata
    ) VALUES (
        v_recipient_id,
        'message',
        'New Message from ' || COALESCE(v_sender_name, 'User'),
        substring(NEW.body from 1 for 100), -- Preview first 100 chars
        '/tcps?user=' || NEW.sender_id,
        jsonb_build_object(
            'conversation_id', NEW.conversation_id,
            'sender_id', NEW.sender_id,
            'message_id', NEW.id
        )
    );

    RETURN NEW;
END;
$$;

-- Create Trigger for Messages
DROP TRIGGER IF EXISTS trigger_new_message_notification ON public.conversation_messages;
CREATE TRIGGER trigger_new_message_notification
AFTER INSERT ON public.conversation_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_message_notification();


-- ============================================================================
-- 2. PAYOUT REQUEST NOTIFICATION (For Secretaries/Admins)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_payout_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_requester_name TEXT;
    v_staff_member RECORD;
BEGIN
    -- Get requester name
    SELECT username INTO v_requester_name
    FROM public.user_profiles
    WHERE id = NEW.user_id;

    -- Loop through all secretaries and admins
    FOR v_staff_member IN 
        SELECT id FROM public.user_profiles 
        WHERE role IN ('secretary', 'admin', 'super_admin') 
        OR is_admin = true
    LOOP
        -- Insert Notification for each staff member
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            link,
            metadata
        ) VALUES (
            v_staff_member.id,
            'payout_request',
            'New Payout Request',
            COALESCE(v_requester_name, 'User') || ' requested cashout',
            '/secretary', -- Or admin payout page
            jsonb_build_object(
                'request_id', NEW.id,
                'amount', NEW.cash_amount, -- Assuming cash_amount column exists
                'requester_id', NEW.user_id
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$;

-- Create Trigger for Payout Requests
DROP TRIGGER IF EXISTS trigger_new_payout_notification ON public.payout_requests;
CREATE TRIGGER trigger_new_payout_notification
AFTER INSERT ON public.payout_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_payout_notification();
