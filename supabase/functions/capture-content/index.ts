import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THUMIO_API_KEY = Deno.env.get("THUMIO_API_KEY");

async function captureScreenshot(url: string, supabaseClient: any, sourceId: string): Promise<string | null> {
  try {
    // Try multiple screenshot services
    
    // Service 1: screenshotapi.net (free tier available)
    const services = [
      `https://screenshotapi.net/api/v1/screenshot?url=${encodeURIComponent(url)}&width=1200&height=800&output=image&format=png`,
      `https://image.thum.io/get/width/1200/height/800/capture/${encodeURIComponent(url)}`,
      `https://mini.screenshotapi.net/screenshot?url=${encodeURIComponent(url)}&width=1200&height=800&output=png`
    ];
    
    let screenshotUrl = null;
    
    for (const serviceUrl of services) {
      console.log('Trying screenshot service:', serviceUrl);
      
      try {
        const response = await fetch(serviceUrl);
        if (response.ok && response.headers.get('content-type')?.includes('image')) {
          const arrayBuffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          if (uint8Array.length > 1000) {
            console.log('Screenshot captured, size:', uint8Array.length);
            
            const path = `screenshots/${sourceId}_${Date.now()}.png`;
            const { data, error } = await supabaseClient.storage
              .from('ad-assets')
              .upload(path, uint8Array, {
                contentType: 'image/png',
                upsert: true
              });
            
            if (!error) {
              const { data: urlData } = supabaseClient.storage.from('ad-assets').getPublicUrl(path);
              screenshotUrl = urlData.publicUrl;
              console.log('Screenshot uploaded to:', screenshotUrl);
              break;
            }
          }
        }
      } catch (e) {
        console.log('Service failed:', e.message);
      }
    }
    
    // If services didn't work, try a different approach - capture via browserless or similar
    if (!screenshotUrl) {
      console.log('Trying browser-based screenshot...');
      // Last resort - try with wait parameter
      const lastTry = `https://image.thum.io/get/width/1200/height/800/capture/wait/5/${encodeURIComponent(url)}`;
      const response = await fetch(lastTry);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        if (uint8Array.length > 1000) {
          const path = `screenshots/${sourceId}_${Date.now()}.png`;
          const { error } = await supabaseClient.storage
            .from('ad-assets')
            .upload(path, uint8Array, { contentType: 'image/png', upsert: true });
          if (!error) {
            const { data: urlData } = supabaseClient.storage.from('ad-assets').getPublicUrl(path);
            screenshotUrl = urlData.publicUrl;
          }
        }
      }
    }
    
    return screenshotUrl;
  } catch (err) {
    console.error('Screenshot capture error:', err);
    return null;
  }
}

function detectContentType(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('/stream') || urlLower.includes('/live')) return 'stream';
  if (urlLower.includes('/pod')) return 'trollpod';
  if (urlLower.includes('/wall') || urlLower.includes('/feed')) return 'wall_post';
  if (urlLower.includes('/event')) return 'event';
  if (urlLower.includes('/career') || urlLower.includes('/jobs')) return 'career';
  if (urlLower.includes('/wallet') || urlLower.includes('/cashout')) return 'wallet';
  if (urlLower.includes('/gov')) return 'government';
  if (urlLower.includes('/court')) return 'court';
  if (urlLower.includes('/church')) return 'church';
  if (urlLower.includes('/safety')) return 'safety';
  if (urlLower.includes('/marketplace')) return 'marketplace';
  if (urlLower.includes('/profile') || urlLower.includes('/user/')) return 'profile';
  if (urlLower.includes('/family')) return 'family';
  if (urlLower.includes('/tcnn') || urlLower.includes('/news')) return 'tcnn';
  if (urlLower.includes('/battle')) return 'battle';
  if (urlLower.includes('/broadcast')) return 'broadcast';
  return 'unknown';
}

async function fetchPageContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TrollCity/1.0' }
    });
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Troll City Content';
    
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : 'Check out Troll City - the ultimate digital city experience!';
    
    return { title, description };
  } catch {
    return { title: 'Troll City', description: 'Join the digital city revolution!' };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url, capture_screenshot = true } = await req.json();
    if (!url) throw new Error("URL is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const contentType = detectContentType(url);
    const pageContent = await fetchPageContent(url);

    const ctaMap: Record<string, string> = {
      stream: "Go live on Troll City",
      trollpod: "Join the conversation",
      event: "Join the event",
      career: "Apply now",
      wallet: "Cash out for real",
      government: "Explore Troll City",
      court: "Enter Troll Court",
      church: "Join the community",
      safety: "Stay safe in Troll City",
      marketplace: "Shop now",
      battle: "Join the battle",
      broadcast: "Start broadcasting",
      profile: "Follow on Troll City",
      family: "Join the family",
      tcnn: "Read more on TCNN",
      wall_post: "Join Troll City"
    };

    // First create the source record
    const { data: source, error } = await supabase.from('source_content_refs').insert({
      content_type: contentType,
      content_id: crypto.randomUUID(),
      title: pageContent.title,
      description: pageContent.description,
      url: url,
      cta_text: ctaMap[contentType] || "Visit Troll City",
      stats: {}
    }).select().single();

    if (error) throw error;

    // Then capture screenshot if requested
    let screenshotUrl = null;
    if (capture_screenshot) {
      screenshotUrl = await captureScreenshot(url, supabase, source.id);
      
      if (screenshotUrl) {
        // Update the source with screenshot URL
        const { data: updatedSource, error: updateError } = await supabase
          .from('source_content_refs')
          .update({ screenshot_url: screenshotUrl })
          .eq('id', source.id)
          .select()
          .single();
        
        if (updateError) {
          console.error('Failed to update screenshot:', updateError);
        } else {
          return new Response(
            JSON.stringify({ 
              success: true, 
              source: updatedSource, 
              detected_type: contentType,
              screenshot: screenshotUrl
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        source, 
        detected_type: contentType,
        screenshot: screenshotUrl
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