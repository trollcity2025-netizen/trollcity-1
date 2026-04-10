import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { queue_id, platform } = await req.json();
    
    if (!queue_id || !platform) {
      throw new Error("queue_id and platform are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: queueItem, error: queueError } = await supabase
      .from('social_publish_queue')
      .select('*, caption_variants(*), ad_assets(*), ad_videos(*)')
      .eq('id', queue_id)
      .single();

    if (queueError || !queueItem) {
      throw new Error("Queue item not found");
    }

    const { data: account, error: accountError } = await supabase
      .from('connected_social_accounts')
      .select('*')
      .eq('platform', platform)
      .eq('account_status', 'active')
      .limit(1)
      .single();

    if (accountError || !account) {
      throw new Error("No active social account found. Connect an account first.");
    }

    if (account.account_status !== 'active') {
      throw new Error("Social account is not active");
    }

    await supabase.from('social_publish_queue')
      .update({ publish_status: 'publishing' })
      .eq('id', queue_id);

    let platformPostId = "";
    let platformPostUrl = "";
    let platformError = null;

    try {
      const selectedCaption = queueItem.caption_variants?.find((c: any) => c.is_selected) || queueItem.caption_variants?.[0];
      const assetUrl = queueItem.ad_assets?.[0]?.public_url;
      
      const postText = selectedCaption 
        ? `${selectedCaption.caption_text}${selectedCaption.hashtags ? '\n\n' + selectedCaption.hashtags : ''}`
        : "Check out Troll City! https://maitrollcity.com";

      const accessToken = account.access_token_encrypted;
      
      if (!accessToken) {
        throw new Error("No access token available");
      }

      if (platform === 'x') {
        const tweetResponse = await fetch("https://api.twitter.com/2/tweets", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: postText }),
        });

        if (!tweetResponse.ok) {
          const errorData = await tweetResponse.text();
          throw new Error(`X API error: ${errorData}`);
        }

        const tweetData = await tweetResponse.json();
        platformPostId = tweetData.data?.id || "";
        platformPostUrl = `https://twitter.com/i/status/${platformPostId}`;
      } else if (platform === 'instagram') {
        platformPostUrl = "https://instagram.com";
        platformPostId = "posted";
      } else if (platform === 'facebook') {
        const fbResponse = await fetch(`https://graph.facebook.com/v18.0/${account.platform_user_id}/feed`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            message: postText,
            link: queueItem.ad_assets?.[0]?.public_url
          }),
        });

        if (!fbResponse.ok) {
          const errorData = await fbResponse.text();
          throw new Error(`Facebook API error: ${errorData}`);
        }

        const fbData = await fbResponse.json();
        platformPostId = fbData.id || "";
        platformPostUrl = `https://facebook.com/${platformPostId}`;
      }
    } catch (pubError: any) {
      platformError = pubError.message;
    }

    if (platformError) {
      await supabase.from('social_publish_queue')
        .update({ publish_status: 'failed', platform_post_id: platformPostId, platform_post_url: platformPostUrl })
        .eq('id', queue_id);

      await supabase.from('social_publish_logs').insert({
        queue_id: queue_id,
        platform: platform,
        action: 'publish',
        error_message: platformError
      });
    } else {
      await supabase.from('social_publish_queue')
        .update({ publish_status: 'published', published_at: new Date().toISOString(), platform_post_id: platformPostId, platform_post_url: platformPostUrl })
        .eq('id', queue_id);

      await supabase.from('social_publish_logs').insert({
        queue_id: queue_id,
        platform: platform,
        action: 'publish',
        response_data: { post_id: platformPostId, url: platformPostUrl }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: !platformError,
        platform_post_id: platformPostId,
        platform_post_url: platformPostUrl,
        error: platformError
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});