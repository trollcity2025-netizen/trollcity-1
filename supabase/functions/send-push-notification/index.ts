import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";
import webpush from "web-push";
// @ts-ignore
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@trollcity.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn("VAPID keys not set. Push notifications will fail.");
}

interface PushRequest {
  user_id: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
}

interface UserFollow {
  follower_id: string;
}

interface ConversationMember {
  user_id: string;
}

interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  user_id: string;
  is_active: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { user_id, user_ids, broadcast_followers_id, conversation_id, sender_id, title, body, url, icon, badge, image, tag, create_db_notification, type } = await req.json() as PushRequest & { user_ids?: string[], broadcast_followers_id?: string, conversation_id?: string, sender_id?: string, create_db_notification?: boolean, type?: string };

    if ((!user_id && (!user_ids || user_ids.length === 0) && !broadcast_followers_id && !conversation_id) || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    let targetUserIds: string[] = [];

    if (user_id) {
      targetUserIds = [user_id];
    } else if (user_ids && user_ids.length > 0) {
      targetUserIds = user_ids;
    } else if (broadcast_followers_id) {
      // Fetch followers
      const { data: followers, error: followersError } = await supabase
        .from("user_follows")
        .select("follower_id")
        .eq("following_id", broadcast_followers_id);
      
      if (followersError) {
        console.error("Error fetching followers:", followersError);
        return new Response(JSON.stringify({ error: "Database error fetching followers" }), { status: 500, headers: corsHeaders });
      }
      targetUserIds = (followers as UserFollow[]).map((f: UserFollow) => f.follower_id);
    } else if (conversation_id) {
      // Fetch conversation members
      const { data: members, error: membersError } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversation_id);
        
      if (membersError) {
        console.error("Error fetching conversation members:", membersError);
        return new Response(JSON.stringify({ error: "Database error fetching members" }), { status: 500, headers: corsHeaders });
      }
      // Filter out sender if provided
      targetUserIds = (members as ConversationMember[]).map((m: ConversationMember) => m.user_id).filter((id: string) => id !== sender_id);
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ message: "No targets found", success: true, count: 0 }), { status: 200, headers: corsHeaders });
    }

    // Optional: Create DB notifications
    if (create_db_notification && targetUserIds.length > 0) {
      const notifications = targetUserIds.map(uid => ({
        user_id: uid,
        type: type || 'system',
        title,
        message: body,
        metadata: { url }, // Simple metadata
        read: false,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase.from('notifications').insert(notifications);
      if (insertError) {
        console.error("Error inserting notifications:", insertError);
        // Continue to send push even if DB insert fails (or maybe not? strictly speaking we want both)
      }
    }

    // 1. Get subscriptions for users
    const { data: subscriptionsData, error: subError } = await supabase
      .from("web_push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds)
      .eq("is_active", true);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers: corsHeaders });
    }

    const subscriptions = subscriptionsData as WebPushSubscription[] | null;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No active subscriptions found", success: true, count: 0 }), { status: 200, headers: corsHeaders });
    }

    // 2. Send push to all subscriptions
    const payload = JSON.stringify({
      title,
      body,
      url: url ?? "/",
      icon: icon ?? "/icons/icon-192.png",
      badge: badge ?? "/icons/icon-72.png",
      image,
      tag
    });

    const results = await Promise.allSettled(
      (subscriptions || []).map(async (sub: WebPushSubscription) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: sub.keys
          };
          await webpush.sendNotification(pushSubscription, payload);
          return { status: "fulfilled", endpoint: sub.endpoint };
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription is gone, delete it
            await supabase
              .from("web_push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
            return { status: "rejected", reason: "Gone", endpoint: sub.endpoint };
          }
          throw error;
        }
      })
    );

    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failureCount = results.length - successCount;

    return new Response(JSON.stringify({ 
      success: true, 
      sent: successCount, 
      failed: failureCount,
      total: results.length 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error("Push notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
