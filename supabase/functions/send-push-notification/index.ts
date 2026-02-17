import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") ?? "5eec8cd7-849b-4e7c-b143-d6e2bf50c39a";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@trollcity.app";

type PushPayload = {
  user_id?: string;
  user_ids?: string[];
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
  image?: string;
  tag?: string;
  data?: Record<string, unknown>;
  broadcast_followers_id?: string;

  type?: string;
};

async function sendOneSignalPush(
  playerIds: string[],
  title: string,
  body: string,
  url?: string,
  data?: Record<string, unknown>
): Promise<{ success: number; failed: number }> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.log("OneSignal not configured - skipping");
    return { success: 0, failed: 0 };
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: body },
        url: url || "https://trollcity.app",
        data: data || {},
        ttl: 86400,
        priority: 10,
      }),
    });

    const result = await response.json();
    if (result?.id) {
      return { success: playerIds.length, failed: 0 };
    }
    console.error("OneSignal error:", result);
    return { success: 0, failed: playerIds.length };
  } catch (error) {
    console.error("OneSignal request error:", error);
    return { success: 0, failed: playerIds.length };
  }
}

function configureWebPush() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    return true;
  } catch (error) {
    console.error("Web push configuration error:", error);
    return false;
  }
}

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: Record<string, unknown>
): Promise<{ success: boolean; status?: number }> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      JSON.stringify(payload)
    );
    return { success: true };
  } catch (error: any) {
    const status = error?.statusCode || error?.status || undefined;
    return { success: false, status };
  }
}

async function isUserOnline(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_presence")
    .select("last_seen_at, status")
    .eq("user_id", userId)
    .single();
  if (!data) return false;
  const lastSeen = new Date(data.last_seen_at);
  return lastSeen >= new Date(Date.now() - 90 * 1000) && data.status !== "offline";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { ...corsHeaders, "Access-Control-Allow-Headers": "*" } });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const bodyJson = (await req.json().catch(() => ({}))) as PushPayload | any;

    let { user_id, title, body, url, icon, image, data } = bodyJson as PushPayload;
    const { user_ids, broadcast_followers_id, _conversation_id, _sender_id, type } = bodyJson as PushPayload;

    if (bodyJson?.type === "INSERT" && bodyJson?.table === "notifications" && bodyJson?.record) {
      const rec = bodyJson.record;
      user_id = rec.user_id;
      title = rec.title;
      body = rec.message;
      if (rec.metadata) {
        url = rec.metadata.url || rec.metadata.action_url;
        icon = rec.metadata.icon;
        image = rec.metadata.image;
        data = rec.metadata;
      }
    }

    if ((!user_id && (!user_ids || !user_ids.length) && !broadcast_followers_id) || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetUserIds: string[] = [];
    if (user_id) targetUserIds = [user_id];
    else if (user_ids?.length) targetUserIds = user_ids;
    else if (broadcast_followers_id) {
      const { data: f } = await supabase
        .from("user_follows")
        .select("follower_id")
        .eq("following_id", broadcast_followers_id);
      targetUserIds = f?.map((x: any) => x.follower_id) || [];
    }

    if (!targetUserIds.length) {
      return new Response(JSON.stringify({ message: "No targets", success: true, count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: oneSignalTokens } = await supabase
      .from("onesignal_tokens")
      .select("user_id, token")
      .in("user_id", targetUserIds)
      .eq("is_active", true);

    const { data: webPushSubs } = await supabase
      .from("web_push_subscriptions")
      .select("user_id, endpoint, keys")
      .in("user_id", targetUserIds);

    const userData = new Map<string, { oneSignal: string[]; webPush: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }> }>();
    targetUserIds.forEach((uid) => userData.set(uid, { oneSignal: [], webPush: [] }));
    oneSignalTokens?.forEach((t: any) => userData.get(t.user_id)?.oneSignal.push(t.token));
    webPushSubs?.forEach((s: any) => {
      if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) return;
      userData.get(s.user_id)?.webPush.push({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
    });

    const notificationData = { url, icon, image, tag: bodyJson?.tag, ...data };
    let oneSignalSent = 0;
    let oneSignalFailed = 0;
    let webPushSent = 0;
    let webPushFailed = 0;
    const invalidWebPushEndpoints: string[] = [];
    const offlineUsers: string[] = [];
    const webPushReady = configureWebPush();

    for (const [userId, tokens] of userData) {
      const online = await isUserOnline(supabase, userId);
      const hasPush = tokens.oneSignal.length > 0 || tokens.webPush.length > 0;

      if (tokens.oneSignal.length) {
        const result = await sendOneSignalPush(tokens.oneSignal, title, body, url, notificationData);
        oneSignalSent += result.success;
        oneSignalFailed += result.failed;
      }

      if (webPushReady && tokens.webPush.length) {
        for (const sub of tokens.webPush) {
          const result = await sendWebPush(sub, {
            title,
            body,
            url: url || "https://trollcity.app",
            icon,
            image,
            data: notificationData,
          });
          if (result.success) {
            webPushSent += 1;
          } else {
            webPushFailed += 1;
            if (result.status === 404 || result.status === 410) {
              invalidWebPushEndpoints.push(sub.endpoint);
            }
          }
        }
      }

      if (!online && !hasPush) {
        offlineUsers.push(userId);
      }
    }

    if (invalidWebPushEndpoints.length) {
      await supabase
        .from("web_push_subscriptions")
        .delete()
        .in("endpoint", invalidWebPushEndpoints);
    }

    const noTokens = targetUserIds.filter((uid) => {
      const t = userData.get(uid);
      return !t || (!t.oneSignal.length && !t.webPush.length);
    });

    const queuedSet = new Set([...offlineUsers, ...noTokens]);
    for (const uid of queuedSet) {
      const { error } = await supabase.from("offline_notifications").insert({
        user_id: uid,
        type: type || "system",
        title,
        message: body,
        metadata: notificationData,
        created_at: new Date().toISOString(),
      });
      if (error) console.warn("Failed to queue offline notification:", error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: { onesignal: oneSignalSent, webpush: webPushSent, total: oneSignalSent + webPushSent },
        failed: { onesignal: oneSignalFailed, webpush: webPushFailed },
        queued: queuedSet.size,
        source: "onesignal",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-push-notification error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});