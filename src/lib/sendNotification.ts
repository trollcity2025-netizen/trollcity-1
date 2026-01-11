import { supabase } from "./supabase";

export type NotificationType =
  | 'stream_live'
  | 'join_approved'
  | 'moderation_alert'
  | 'new_follower'
  | 'gift_received'
  | 'message'
  | 'support_reply'
  | 'payout_update'
  | 'role_update'
  | 'application_result'
  | 'troll_drop';

export async function sendNotification(
  userId: string | null,
  type: NotificationType,
  title: string,
  message: string,
  metadata: Record<string, any> = {}
) {
  const { error } = await supabase.from("notifications").insert([
    {
      user_id: userId ?? null,
      type,
      title,
      message,
      metadata,
      read: false,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error("Notification Error:", error);
    throw error;
  }
}
