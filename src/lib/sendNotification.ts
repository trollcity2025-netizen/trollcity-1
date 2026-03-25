import { supabase } from "./supabase";
import { NotificationType } from "../types/notifications";

export type { NotificationType };

export async function sendNotification(
  userId: string | null,
  type: NotificationType,
  title: string,
  message: string,
  metadata: Record<string, any> = {}
) {
  if (!userId) {
    console.warn("sendNotification called with null userId");
    return;
  }

  // Try using the secure RPC function first (bypasses RLS)
  const { error } = await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_metadata: metadata
  });

  if (error) {
    // Fallback to direct insert if RPC fails (e.g. not migrated yet)
    // This maintains compatibility for admins who can bypass RLS anyway
    console.warn("RPC create_notification failed, trying direct insert:", error.message);
    
    const { error: insertError } = await supabase.from("notifications").insert([
      {
        user_id: userId,
        type,
        title,
        message,
        metadata,
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      console.error("Notification Error:", insertError);
      throw insertError;
    }
  }

  // Send push notifications via both Edge Functions (fire-and-forget)
  if (userId) {
    let url = '/';
    if (type === 'message' && metadata?.sender_id) {
      url = `/tcps?user=${metadata.sender_id}`;
    } else if (metadata?.url) {
      url = metadata.url;
    }

    // Primary: OneSignal push
    supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: userId,
        title,
        body: message,
        url,
        data: metadata
      }
    }).catch((pushErr: unknown) => {
      console.warn('OneSignal push failed:', pushErr);
    });

    // Fallback: Web Push (VAPID) — delivers even when device is offline,
    // the browser push service queues it until the device reconnects
    supabase.functions.invoke('push-notifications', {
      body: {
        userId,
        notification: {
          type: type.toUpperCase(),
          title,
          body: message,
          url,
          data: metadata
        },
        options: { ttl: 86400, urgency: 'normal' }
      }
    }).catch((pushErr: unknown) => {
      console.warn('Web Push failed:', pushErr);
    });
  }
}
