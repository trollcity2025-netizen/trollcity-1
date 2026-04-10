import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RUNWAY_API_BASE = "https://api.dev.runwayml.com";

async function generateWithRunwayImage(supabaseClient: any, sourceImageUrl: string | null, prompt: string, width: number, height: number, assetType: string, jobId: string): Promise<string | null> {
  const apiKey = Deno.env.get("RUNWAY_API_KEY");
  if (!apiKey) {
    throw new Error("RUNWAY_API_KEY not configured in Supabase secrets.");
  }

  try {
    const ratio = width >= height ? "1344:768" : "768:1344";
    console.log('=== IMAGE GENERATION ===');
    console.log('Source image:', sourceImageUrl);
    console.log('Prompt:', prompt);
    
    // Use screenshot if available, otherwise use base64 encoded image
    let referenceUri = null;
    
    if (sourceImageUrl) {
      console.log('Uploading screenshot to Runway...');
      const uploadRes = await fetch(`${RUNWAY_API_BASE}/v1/assets`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06"
        },
        body: JSON.stringify({ uri: sourceImageUrl })
      });
      
      if (uploadRes.ok) {
        const data = await uploadRes.json();
        referenceUri = data.uri;
        console.log('Screenshot uploaded:', referenceUri);
      } else {
        console.log('Screenshot upload failed, trying base64...');
      }
    }
    
    // If screenshot didn't work, try uploading a simple base64 image
    if (!referenceUri) {
      console.log('Uploading base64 reference image...');
      // Simple purple gradient base64
      const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF8WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDUgNzkuMTYzNDk5LCAyMDE4LzA4LzEzLTE2OjQwOjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiIHhtcDpDcmVhdGVEYXRlPSIyMDI0LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyNC0wMS0wMVQwMDowMDowMCswMDowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyNC0wMS0wMVQwMDowMDowMCswMDowMCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpmMjg1YjZjMC1iNDQ1LTRiNzItOTRlZS1hYzE1OGE1ZmQ1YjYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6ZjI4NWI2YzAtYjQ0NS00YjcyLTk0ZWUtYWMxNThhNWZkNWI2IiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6ZjI4NWI2YzAtYjQ0NS00YjcyLTk0ZWUtYWMxNThhNWZkNWI2IiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyI+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNyZWF0ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6ZjI4NWI2YzAtYjQ0NS00YjcyLTk0ZWUtYWMxNThhNWZkNWI2IiBzdEV2dDp3aGVuPSIyMDI0LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+IGB4IAEAAAAASUVORK5CYII=";
      
      const uploadRes = await fetch(`${RUNWAY_API_BASE}/v1/assets`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06"
        },
        body: JSON.stringify({ uri: base64Image })
      });
      
      console.log('Base64 upload response:', uploadRes.status);
      
      if (uploadRes.ok) {
        const data = await uploadRes.json();
        referenceUri = data.uri;
        console.log('Base64 uploaded:', referenceUri);
      } else {
        const errText = await uploadRes.text();
        console.log('Base64 upload failed:', errText);
      }
    }
    
    console.log('Final referenceUri:', referenceUri);
    
    // Use the reference if available
    const requestBody: any = {
      model: "gemini_2.5_flash",
      promptText: prompt,
      ratio: ratio
    };
    
    if (referenceUri) {
      requestBody.referenceImages = [{ uri: referenceUri }];
    }
    
    console.log('Calling Runway API with gemini_2.5_flash...');
    const response = await fetch(`${RUNWAY_API_BASE}/v1/text_to_image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-Runway-Version": "2024-11-06"
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Runway API error: ${response.status} - ${errorText}`);
    }

    const taskData = await response.json();
    console.log('Task created:', taskData.id);

    let taskStatus = "PENDING";
    let outputUrl: string | null = null;
    
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`${RUNWAY_API_BASE}/v1/tasks/${taskData.id}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06"
        }
      });
      
      const statusData = await statusResponse.json();
      taskStatus = statusData.status;
      console.log('Status:', taskStatus);
      
      if (taskStatus === "SUCCEEDED" && statusData.output && statusData.output.length > 0) {
        outputUrl = statusData.output[0];
        break;
      }
      
      if (taskStatus === "FAILED") {
        throw new Error(`Task failed: ${statusData.error}`);
      }
    }

    if (!outputUrl) {
      throw new Error("No output from Runway");
    }

    console.log('Downloading image...');
    const imageResponse = await fetch(outputUrl);
    const arrayBuffer = await imageResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    console.log('Image size:', uint8Array.length);

    const path = `generated/${jobId}/${assetType}_${Date.now()}.png`;
    const { error } = await supabaseClient.storage
      .from('ad-assets')
      .upload(path, uint8Array, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      throw new Error(`Upload error: ${error.message}`);
    }

    const { data: urlData } = supabaseClient.storage.from('ad-assets').getPublicUrl(path);
    return urlData.publicUrl;
  } catch (err) {
    console.error('Error:', err);
    throw err;
  }
}

async function generateWithRunwayVideo(supabaseClient: any, sourceImageUrl: string | null, prompt: string, jobId: string): Promise<string | null> {
  const apiKey = Deno.env.get("RUNWAY_API_KEY");
  if (!apiKey) {
    throw new Error("RUNWAY_API_KEY not configured in Supabase secrets.");
  }

  try {
    console.log('=== VIDEO GENERATION ===');
    console.log('Source image:', sourceImageUrl);
    console.log('Prompt:', prompt);
    
    let inputImageUrl = sourceImageUrl;
    
    if (sourceImageUrl) {
      console.log('Uploading screenshot for video...');
      const uploadResponse = await fetch(`${RUNWAY_API_BASE}/v1/assets`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06"
        },
        body: JSON.stringify({ uri: sourceImageUrl })
      });
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        inputImageUrl = uploadData.uri;
        console.log('Uploaded:', inputImageUrl);
      }
    }

    // Use text-to-video if no screenshot, otherwise use image-to-video
    let taskId: string;
    
    if (!inputImageUrl) {
      console.log('Using text-to-video (no screenshot)');
      const response = await fetch(`${RUNWAY_API_BASE}/v1/text_to_video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06"
        },
        body: JSON.stringify({
          model: "gen4.5",
          promptText: prompt + " - high quality cinematic marketing video",
          ratio: "720:1280",
          duration: 5
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Runway API error: ${response.status} - ${errorText}`);
      }

      const taskData = await response.json();
      console.log('Task created:', taskData.id);
      taskId = taskData.id;
    } else {
      console.log('Using image-to-video');
      const response = await fetch(`${RUNWAY_API_BASE}/v1/image_to_video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06"
        },
        body: JSON.stringify({
          model: "gen4.5",
          promptImage: inputImageUrl,
          promptText: prompt + " - cinematic motion",
          ratio: "720:1280",
          duration: 5
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Runway API error: ${response.status} - ${errorText}`);
      }

      const taskData = await response.json();
      console.log('Task created:', taskData.id);
      taskId = taskData.id;
    }

    let taskStatus = "PENDING";
    let outputUrl: string | null = null;
    
    for (let i = 0; i < 120; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusResponse = await fetch(`${RUNWAY_API_BASE}/v1/tasks/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06"
        }
      });
      
      const statusData = await statusResponse.json();
      taskStatus = statusData.status;
      console.log('Status:', taskStatus);
      
      if (taskStatus === "SUCCEEDED" && statusData.output && statusData.output.length > 0) {
        outputUrl = statusData.output[0];
        break;
      }
      
      if (taskStatus === "FAILED") {
        throw new Error(`Task failed: ${statusData.error}`);
      }
    }

    if (!outputUrl) {
      throw new Error("No output from Runway");
    }

    console.log('Downloading video...');
    const videoResponse = await fetch(outputUrl);
    const arrayBuffer = await videoResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    console.log('Video size:', uint8Array.length);

    const path = `generated/${jobId}/video_${Date.now()}.mp4`;
    const { error } = await supabaseClient.storage
      .from('ad-assets')
      .upload(path, uint8Array, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (error) {
      throw new Error(`Upload error: ${error.message}`);
    }

    const { data: urlData } = supabaseClient.storage.from('ad-assets').getPublicUrl(path);
    return urlData.publicUrl;
  } catch (err) {
    console.error('Error:', err);
    throw err;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { source_id, generation_type, asset_type } = await req.json();
    if (!source_id) throw new Error("source_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: source } = await supabase.from('source_content_refs').select('*').eq('id', source_id).single();
    if (!source) throw new Error("Source not found");

    const { data: job } = await supabase.from('ad_generation_jobs').insert({
      source_content_id: source_id,
      job_type: generation_type,
      job_status: 'processing',
      template_type: source.content_type,
      started_at: new Date().toISOString()
    }).select().single();

    let assetsCreated: string[] = [];
    let videosCreated: string[] = [];

    try {
      const runwayKey = Deno.env.get("RUNWAY_API_KEY");
      if (!runwayKey) {
        throw new Error("RUNWAY_API_KEY not configured in Supabase secrets.");
      }
      
      const title = source.title || 'Troll City';
      const description = source.description || '';
      const prompt = `Professional promotional ad featuring ${title}. ${description}. Include www.maitrollcity.com text and "Mai Troll City on Google Play" badge. Digital city, cyberpunk, neon lights, high quality, marketing style, app store badge visible`;
      
      // Use screenshot_url if available, otherwise will generate without reference
      const sourceImageUrl = source.screenshot_url || null;
      
      console.log('Source screenshot_url:', sourceImageUrl);
      console.log('Source url (NOT used):', source.url);

      if (generation_type === 'image_ad' || generation_type === 'full_campaign') {
        // Allow generation even without screenshot - will use text-to-image
        console.log('Generating image (with or without screenshot reference)...');
        
        // Generate just 1 square image
        const size = { type: 'square_post', w: 1024, h: 1024 };
        
        const imageUrl = await generateWithRunwayImage(supabase, sourceImageUrl, prompt, size.w, size.h, size.type, job.id);
        console.log('Generated:', imageUrl);
        
        await supabase.from('ad_assets').insert({
          job_id: job.id,
          asset_type: size.type,
          width: size.w,
          height: size.h,
          public_url: imageUrl || null,
          metadata: { 
            title: source.title, 
            description: source.description,
            cta: source.cta_text,
            url: source.url
          }
        });
        assetsCreated.push(size.type);
      }

      if (generation_type === 'video_promo' || generation_type === 'full_campaign') {
        console.log('Generating video...');
        
        const videoPrompt = `Professional promotional video ad featuring ${title}. ${description}. Include www.maitrollcity.com text and "Mai Troll City on Google Play" badge. Digital city, cyberpunk, neon lights, high quality cinematic marketing video, app store badge visible`;
        
        const videoUrl = await generateWithRunwayVideo(supabase, sourceImageUrl, videoPrompt, job.id);
        console.log('Generated video:', videoUrl);
        
        await supabase.from('ad_videos').insert({
          job_id: job.id,
          template_type: source.content_type === 'stream' ? 'live_now_promo' : 'feature_promo',
          public_url: videoUrl || null,
          duration_seconds: 5,
          width: 720,
          height: 1280,
          metadata: { 
            title: source.title,
            description: source.description
          }
        });
        videosCreated.push('promo');
      }

      await supabase.from('ad_generation_jobs').update({ 
        job_status: 'completed', 
        completed_at: new Date().toISOString() 
      }).eq('id', job.id);

    } catch (genError: any) {
      await supabase.from('ad_generation_jobs').update({ 
        job_status: 'failed', 
        error_message: genError.message 
      }).eq('id', job.id);
      throw genError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        job_id: job.id,
        assets: assetsCreated,
        videos: videosCreated
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