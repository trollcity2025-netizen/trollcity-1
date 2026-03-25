-- Migration: Admin receives ALL notifications + all notifications are clickable
-- Date: 2027-10-28
-- Changes:
--   1. AFTER INSERT trigger on notifications: auto-clone every notification to all admins
--   2. Helper function to get admin notification link routes by type

-- ============================================================
-- 1. Function: Clone every notification to all admin users
--    Fires on INSERT into notifications table.
--    Skips if the recipient is already an admin (avoids duplicates).
--    Skips if the notification type starts with 'admin.' (internal admin-only notifications).
-- ============================================================
CREATE OR REPLACE FUNCTION public.clone_notification_to_admins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Skip if the target user is already an admin (they already got it)
  IF public.is_admin(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  -- Skip admin-internal notifications (avoid infinite loops)
  IF NEW.type LIKE 'admin.%' THEN
    RETURN NEW;
  END IF;

  -- Insert a copy for each admin
  FOR v_admin_id IN
    SELECT id FROM public.user_profiles
    WHERE (is_admin = true OR role = 'admin')
      AND id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (
      user_id, type, title, message, content, body,
      metadata, priority, is_read, is_sent
    ) VALUES (
      v_admin_id,
      'admin.' || NEW.type,
      NEW.title,
      NEW.message,
      NEW.content,
      NEW.body,
      COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
        'admin_copy', true,
        'original_user_id', NEW.user_id,
        'original_notification_id', NEW.id
      ),
      COALESCE(NEW.priority, 'normal'),
      false,
      true
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_clone_notification_to_admins ON public.notifications;

CREATE TRIGGER trg_clone_notification_to_admins
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.clone_notification_to_admins();

-- ============================================================
-- 2. Helper: Get the best click route for a notification type
--    Used by triggers that don't already set action_url.
--    Returns a TEXT route path based on notification type.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_notification_route(
  p_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  -- If metadata already has a route, use it
  IF p_metadata ? 'route' THEN
    RETURN p_metadata->>'route';
  END IF;

  -- If metadata already has action_url, use it
  IF p_metadata ? 'action_url' THEN
    RETURN p_metadata->>'action_url';
  END IF;

  -- Default routes by type
  RETURN CASE
    -- User-facing notifications
    WHEN p_type = 'new_follower'        THEN '/profile'
    WHEN p_type = 'gift_received'       THEN '/wallet'
    WHEN p_type = 'badge_unlocked'      THEN '/profile?tab=badges'
    WHEN p_type = 'message'             THEN '/messages'
    WHEN p_type = 'stream_live'         THEN '/live'
    WHEN p_type = 'join_approved'       THEN '/'
    WHEN p_type = 'announcement'        THEN '/'
    WHEN p_type = 'vehicle_auction'     THEN '/marketplace'
    WHEN p_type = 'property_purchased'  THEN '/profile?tab=properties'
    WHEN p_type = 'item_purchased'      THEN '/marketplace'
    WHEN p_type = 'system'              THEN '/'
    WHEN p_type = 'system.warning'      THEN '/'
    WHEN p_type = 'system_announcement' THEN '/'

    -- Moderation
    WHEN p_type IN ('kick','ban','mute','report','moderation_alert',
                     'moderation_action','stream.kick','stream.ban')
      THEN '/admin/moderation'

    -- Officer
    WHEN p_type IN ('officer_update','officer_clock_in','officer_clock_out')
      THEN '/admin/officers'

    -- Finance
    WHEN p_type IN ('payout_status','payout_request','payout_update',
                     'coins.fast_spend','coins.manual_purchase')
      THEN '/admin/finance'

    -- Support
    WHEN p_type IN ('support_ticket','support_reply')
      THEN '/admin/support'

    -- Applications
    WHEN p_type IN ('application_submitted','application_result')
      THEN '/admin/applications'

    -- Seller
    WHEN p_type IN ('seller_tier_upgraded','seller_tier_downgraded',
                     'new_review_received','appeal_submitted','appeal_decision')
      THEN '/marketplace'

    -- Battle
    WHEN p_type = 'battle_result'       THEN '/profile'

    -- Security
    WHEN p_type = 'security.alert'      THEN '/admin/moderation'

    -- Coins
    WHEN p_type IN ('coin_received','coin_gifted') THEN '/wallet'

    -- Court / Jail
    WHEN p_type IN ('jail_sentence','court_summon') THEN '/troll-court'

    -- Trollg / manual orders / gifts
    WHEN p_type IN ('trollg_application','manual_coin_order','troll_post_gift')
      THEN '/admin/finance'

    -- Default fallback
    ELSE '/'
  END;
END;
$$;

-- ============================================================
-- 3. Patch existing triggers that don't set action_url to include it
--    using get_notification_route() so every notification is clickable.
-- ============================================================

-- 3a. Enhanced notifications triggers (20270216000000_enhanced_notifications.sql)
-- landlord applications
CREATE OR REPLACE FUNCTION public.notify_landlord_application()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'application_submitted',
    'New Landlord Application',
    'A new landlord application has been submitted.',
    jsonb_build_object(
      'application_id', NEW.id,
      'user_id', NEW.user_id,
      'action_url', '/admin/applications?id=' || NEW.id
    ),
    'normal'
  );
  RETURN NEW;
END;
$$;

-- officer actions
CREATE OR REPLACE FUNCTION public.notify_officer_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'officer_update',
    'Officer Action Logged',
    'An officer action has been logged: ' || NEW.action_type,
    jsonb_build_object(
      'action_id', NEW.id,
      'action_type', NEW.action_type,
      'officer_id', NEW.officer_id,
      'action_url', '/admin/officers?action=' || NEW.id
    ),
    'normal'
  );
  RETURN NEW;
END;
$$;

-- officer sessions
CREATE OR REPLACE FUNCTION public.notify_officer_session()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    PERFORM public.notify_admins(
      'officer_clock_out',
      'Officer Clocked Out',
      'An officer has ended their shift.',
      jsonb_build_object(
        'session_id', NEW.id,
        'officer_id', NEW.officer_id,
        'action_url', '/admin/officers?session=' || NEW.id
      ),
      'normal'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- support tickets
CREATE OR REPLACE FUNCTION public.notify_support_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'support_ticket',
    'New Support Ticket',
    'A new support ticket has been created: ' || NEW.subject,
    jsonb_build_object(
      'ticket_id', NEW.id,
      'user_id', NEW.user_id,
      'action_url', '/admin/support?id=' || NEW.id
    ),
    'normal'
  );
  RETURN NEW;
END;
$$;

-- 3b. More notifications triggers (20270216000002_more_notifications.sql)
-- troll battles
CREATE OR REPLACE FUNCTION public.notify_battle_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    PERFORM public.notify_admins(
      'battle_result',
      'Battle Completed',
      'A troll battle has been completed.',
      jsonb_build_object(
        'battle_id', NEW.id,
        'winner_id', NEW.winner_id,
        'action_url', '/admin/moderation?tab=battles&id=' || NEW.id
      ),
      'normal'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- trollg applications
CREATE OR REPLACE FUNCTION public.notify_trollg_application()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'application_submitted',
    'New TrollG Application',
    'A new TrollG application has been submitted.',
    jsonb_build_object(
      'application_id', NEW.id,
      'user_id', NEW.user_id,
      'action_url', '/admin/applications?id=' || NEW.id
    ),
    'normal'
  );
  RETURN NEW;
END;
$$;

-- manual coin orders
CREATE OR REPLACE FUNCTION public.notify_manual_coin_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'coins.manual_purchase',
    'New Manual Coin Order',
    'A new manual coin order has been placed.',
    jsonb_build_object(
      'order_id', NEW.id,
      'user_id', NEW.user_id,
      'action_url', '/admin/finance?tab=orders&id=' || NEW.id
    ),
    'normal'
  );
  RETURN NEW;
END;
$$;

-- troll post gifts
CREATE OR REPLACE FUNCTION public.notify_troll_post_gift()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'gift_received',
    'Troll Post Gift Sent',
    'A gift was sent on a troll post.',
    jsonb_build_object(
      'gift_id', NEW.id,
      'sender_id', NEW.sender_id,
      'post_id', NEW.post_id,
      'action_url', '/admin/finance?tab=gifts&id=' || NEW.id
    ),
    'normal'
  );
  RETURN NEW;
END;
$$;

-- 3c. Comprehensive notifications (20270216000003_comprehensive_notifications.sql)
-- profile changes
CREATE OR REPLACE FUNCTION public.notify_user_profile_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_banned = true AND OLD.is_banned = false THEN
    PERFORM public.notify_admins(
      'ban',
      'User Banned',
      'A user has been banned.',
      jsonb_build_object(
        'user_id', NEW.id,
        'username', NEW.username,
        'action_url', '/admin/moderation?user=' || NEW.id
      ),
      'high'
    );
  END IF;
  IF NEW.is_kicked = true AND OLD.is_kicked = false THEN
    PERFORM public.notify_admins(
      'kick',
      'User Kicked',
      'A user has been kicked.',
      jsonb_build_object(
        'user_id', NEW.id,
        'username', NEW.username,
        'action_url', '/admin/moderation?user=' || NEW.id
      ),
      'normal'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- stream reports
CREATE OR REPLACE FUNCTION public.notify_stream_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'report',
    'Stream Report Filed',
    'A new stream report has been filed.',
    jsonb_build_object(
      'report_id', NEW.id,
      'stream_id', NEW.stream_id,
      'reporter_id', NEW.reporter_id,
      'action_url', '/admin/moderation?tab=reports&id=' || NEW.id
    ),
    'high'
  );
  RETURN NEW;
END;
$$;

-- abuse reports
CREATE OR REPLACE FUNCTION public.notify_abuse_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'report',
    'Abuse Report Filed',
    'A new abuse report has been filed.',
    jsonb_build_object(
      'report_id', NEW.id,
      'reporter_id', NEW.reporter_id,
      'reported_user_id', NEW.reported_user_id,
      'action_url', '/admin/moderation?tab=reports&id=' || NEW.id
    ),
    'high'
  );
  RETURN NEW;
END;
$$;

-- punishment transactions
CREATE OR REPLACE FUNCTION public.notify_punishment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'moderation_action',
    'Punishment Applied',
    'A punishment has been applied to a user.',
    jsonb_build_object(
      'transaction_id', NEW.id,
      'user_id', NEW.user_id,
      'action_type', NEW.action_type,
      'action_url', '/admin/moderation?user=' || NEW.user_id
    ),
    'normal'
  );
  RETURN NEW;
END;
$$;

-- paypal transactions
CREATE OR REPLACE FUNCTION public.notify_paypal_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'coins.fast_spend',
    'PayPal Transaction',
    'A PayPal transaction has been recorded.',
    jsonb_build_object(
      'transaction_id', NEW.id,
      'user_id', NEW.user_id,
      'amount', NEW.amount,
      'action_url', '/admin/finance?tab=paypal&id=' || NEW.id
    ),
    'normal'
  );
  RETURN NEW;
END;
$$;

-- payout requests (existing)
CREATE OR REPLACE FUNCTION public.notify_payout_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'payout_request',
    'New Payout Request',
    'A new payout request has been submitted.',
    jsonb_build_object(
      'payout_id', NEW.id,
      'user_id', NEW.user_id,
      'amount', NEW.amount,
      'action_url', '/admin/finance?tab=payouts&id=' || NEW.id
    ),
    'normal'
  );
  RETURN NEW;
END;
$$;

-- item purchases
CREATE OR REPLACE FUNCTION public.notify_item_purchase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_admins(
    'item_purchased',
    'Item Purchased',
    'A user has purchased an item.',
    jsonb_build_object(
      'purchase_id', NEW.id,
      'user_id', NEW.user_id,
      'item_id', NEW.item_id,
      'action_url', '/admin/finance?tab=purchases&id=' || NEW.id
    ),
    'normal'
  );
  RETURN NEW;
END;
$$;

-- 3d. Staff notifications (20270318000000_staff_notifications.sql)
-- stream bans
CREATE OR REPLACE FUNCTION public.notify_stream_ban()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_staff(
    'stream.ban',
    'Stream Ban Issued',
    'A user has been banned from a stream.',
    jsonb_build_object(
      'ban_id', NEW.id,
      'stream_id', NEW.stream_id,
      'user_id', NEW.user_id,
      'action_url', '/admin/moderation?tab=stream-bans&id=' || NEW.id
    )
  );
  RETURN NEW;
END;
$$;

-- stream kicks
CREATE OR REPLACE FUNCTION public.notify_stream_kick()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_staff(
    'stream.kick',
    'Stream Kick Issued',
    'A user has been kicked from a stream.',
    jsonb_build_object(
      'session_id', NEW.id,
      'stream_id', NEW.stream_id,
      'user_id', NEW.user_id,
      'action_url', '/admin/moderation?tab=stream-kicks&id=' || NEW.id
    )
  );
  RETURN NEW;
END;
$$;

-- staff manual orders
CREATE OR REPLACE FUNCTION public.notify_staff_manual_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.notify_staff(
    'coins.manual_purchase',
    'Manual Coin Order (Staff)',
    'A manual coin order requires attention.',
    jsonb_build_object(
      'order_id', NEW.id,
      'user_id', NEW.user_id,
      'action_url', '/admin/finance?tab=orders&id=' || NEW.id
    )
  );
  RETURN NEW;
END;
$$;

-- large spend
CREATE OR REPLACE FUNCTION public.notify_large_spend()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.amount <= -10000 THEN
    PERFORM public.notify_staff(
      'coins.fast_spend',
      'Large Coin Spend Detected',
      'A user spent ' || ABS(NEW.amount) || ' coins.',
      jsonb_build_object(
        'transaction_id', NEW.id,
        'user_id', NEW.user_id,
        'amount', NEW.amount,
        'action_url', '/admin/finance?tab=transactions&id=' || NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
