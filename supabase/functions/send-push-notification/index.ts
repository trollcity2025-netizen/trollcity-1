import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";
import webpush from "https://esm.sh/web-push@3.6.7";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@trollcity.app";

interface PushRequest {
  user_id: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, unknown>;
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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200, 
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, content-length",
      }
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase keys not set");
      return new Response(JSON.stringify({ error: "Server configuration error: Supabase keys missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error("VAPID keys not set");
      return new Response(JSON.stringify({ error: "Server configuration error: VAPID keys missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Parse body carefully
    let bodyJson;
    try {
      bodyJson = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { 
      user_ids, 
      broadcast_followers_id, 
      conversation_id, 
      sender_id, 
      badge, 
      tag, 
      type,
      table,
      record 
    } = bodyJson as PushRequest & { user_ids?: string[], broadcast_followers_id?: string, conversation_id?: string, sender_id?: string, create_db_notification?: boolean, type?: string, record?: any, table?: string };

    let { 
      user_id, 
      title, 
      body, 
      url, 
      icon, 
      image, 
      data, 
      create_db_notification 
    } = bodyJson as PushRequest & { user_ids?: string[], broadcast_followers_id?: string, conversation_id?: string, sender_id?: string, create_db_notification?: boolean, type?: string, record?: any, table?: string };

    // Handle Supabase Database Webhook payload
    if (type === 'INSERT' && table === 'notifications' && record) {
      const record = bodyJson.record;
      console.log("Processing Webhook for notification:", record.id);
      
      user_id = record.user_id;
      title = record.title;
      body = record.message;
      
      // Parse metadata if needed
      if (record.metadata) {
        url = record.metadata.url || record.metadata.action_url;
        icon = record.metadata.icon;
        image = record.metadata.image;
        data = record.metadata;
      }
      
      // Prevent infinite loop: do not create another DB notification
      create_db_notification = false;
    }

    if ((!user_id && (!user_ids || user_ids.length === 0) && !broadcast_followers_id && !conversation_id) || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        return new Response(JSON.stringify({ error: "Database error fetching followers" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        return new Response(JSON.stringify({ error: "Database error fetching members" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Filter out sender if provided
      targetUserIds = (members as ConversationMember[]).map((m: ConversationMember) => m.user_id).filter((id: string) => id !== sender_id);
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ message: "No targets found", success: true, count: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Optional: Create DB notifications
    if (create_db_notification && targetUserIds.length > 0) {
      const notifications = targetUserIds.map(uid => ({
        user_id: uid,
        type: type || 'system',
        title,
        message: body,
        metadata: { url }, // Simple metadata
        is_read: false,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase.from('notifications').insert(notifications);
      if (insertError) {
        console.error("Error inserting notifications:", insertError);
        // Continue to send push even if DB insert fails
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
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const subscriptions = subscriptionsData as WebPushSubscription[] | null;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No active subscriptions found", success: true, count: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Send push to all subscriptions
    const payload = JSON.stringify({
      title,
      body,
      url: url ?? "/",
      icon: icon ?? "/icons/icon-192.png",
      badge: badge ?? "/icons/icon-72.png",
      image,
      tag,
      data
    });

    webpush.setVapidDetails(
      VAPID_SUBJECT,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const results = await Promise.allSettled(
      (subscriptions || []).map(async (sub: WebPushSubscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                auth: sub.keys.auth,
                p256dh: sub.keys.p256dh,
              },
            },
            payload
          );
          
          return { status: "fulfilled", endpoint: sub.endpoint };
        } catch (error: any) {
          console.error("WebPush send error:", error);
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

  } catch (e) {
    console.error("send-push-notification fatal:", e);
    return new Response(JSON.stringify({
      error: "send_push_failed",
      message: e instanceof Error ? e.message : String(e),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});