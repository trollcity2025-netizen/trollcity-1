-- Fix: Skip cloning bulk notifications to admins
-- When admin sends a bulk notification to all users, the trigger was
-- cloning EACH user's notification to all admins (14 users = 14 copies).
-- Now it skips notifications with _bulk=true in metadata.

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

  -- Skip bulk notifications (admin sent to all users - don't clone 14 copies)
  IF COALESCE(NEW.metadata->>'_bulk', 'false') = 'true' THEN
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
