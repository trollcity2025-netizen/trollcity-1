import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import * as webPush from 'https://esm.sh/web-push@3.6.6';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Notification types
interface NotificationPayload {
  type: 'BATTLE_INVITATION' | 'NEW_LIVESTREAM' | 'GIFT_RECEIVED' | 
        'PRIVATE_MESSAGE' | 'MODERATION_ALERT' | 'FRIEND_REQUEST' | 'STREAM_GOING_LIVE';
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  tag?: string;
}

interface PushRequest {
  userId: string;
  notification: NotificationPayload;
  options?: {
    ttl?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
  };
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@maitrollcity.com';

// Configure web-push
webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId, notification, options }: PushRequest = await req.json();

    if (!userId || !notification) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, notification' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('web_push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active subscriptions found for user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send push notification to all active subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string }
        };

        const payload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icons/icon-192.png',
          badge: notification.badge || '/icons/icon-72.png',
          image: notification.image,
          url: notification.url || '/',
          type: notification.type,
          tag: notification.tag || `troll-city-${Date.now()}`,
          requireInteraction: notification.requireInteraction || false,
          data: {
            ...notification.data,
            userId,
            timestamp: Date.now()
          }
        });

        try {
          await webPush.sendNotification(
            pushSubscription,
            payload,
            {
              TTL: options?.ttl || 86400,
              urgency: options?.urgency || 'normal',
              topic: options?.topic
            }
          );
          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          // If subscription is expired or invalid, mark it inactive
          if (error.statusCode === 410 || error.statusCode === 404) {
            await supabase
              .from('web_push_subscriptions')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('endpoint', sub.endpoint);
          }
          throw error;
        }
      })
    );

    // Log notification in database
    await supabase.from('push_notification_logs').insert({
      user_id: userId,
      notification_type: notification.type,
      title: notification.title,
      body: notification.body,
      sent_at: new Date().toISOString(),
      success_count: results.filter(r => r.status === 'fulfilled').length,
      failure_count: results.filter(r => r.status === 'rejected').length
    });

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed,
        total: subscriptions.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Push notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
