import { supabaseAdmin } from '../_shared/auth'

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://trollcity.app'
const FALLBACK_PREVIEW_IMAGE = `${APP_URL}/preview-default.svg`

export const runtime = 'edge'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const broadcastId = params.id
  
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(broadcastId);
  
  let stream: any = null
  let broadcaster: any = null
  
  try {
    if (isUUID) {
      const { data, error } = await supabaseAdmin
        .from('streams')
        .select('*, user_profiles(username, avatar_url, thumbnail_url)')
        .eq('id', broadcastId)
        .maybeSingle();
      
      if (!error && data) {
        stream = data
        broadcaster = data.user_profiles
      }
    } else {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, username, avatar_url, thumbnail_url')
        .eq('username', broadcastId)
        .maybeSingle();
      
      if (!userError && userData) {
        const { data: streamData, error: streamError } = await supabaseAdmin
          .from('streams')
          .select('*, user_profiles(username, avatar_url, thumbnail_url)')
          .eq('user_id', userData.id)
          .eq('is_live', true)
          .eq('status', 'live')
          .maybeSingle();
        
        if (!streamError && streamData) {
          stream = streamData
          broadcaster = streamData.user_profiles || userData
        }
      }
    }
    
    if (!stream) {
      const html = generateSocialMetaHTML({
        title: 'Stream Not Found',
        description: 'This broadcast is not available.',
        image: FALLBACK_PREVIEW_IMAGE,
        url: `${APP_URL}/watch/${broadcastId}`,
        type: 'website',
        isLive: false
      })
      return new Response(html, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }
    
    const isLive = stream.status === 'live'
    const statusText = isLive ? 'LIVE' : 'Ended'
    const previewImage = stream.thumbnail_url || broadcaster?.thumbnail_url || broadcaster?.avatar_url || FALLBACK_PREVIEW_IMAGE
    
    const html = generateSocialMetaHTML({
      title: `${broadcaster?.username || 'Broadcaster'} is ${statusText} on Troll City`,
      description: stream.title || `Watch this live broadcast on Troll City`,
      image: previewImage,
      url: `${APP_URL}/watch/${stream.id}`,
      type: isLive ? 'video.other' : 'website',
      isLive,
      videoUrl: isLive ? `${APP_URL}/embed/${stream.id}` : null,
      twitterCard: isLive ? 'player' : 'summary_large_image',
      twitterPlayerUrl: isLive ? `${APP_URL}/embed/${stream.id}` : null
    })
    
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
    
  } catch (error) {
    console.error('[Social] Error:', error)
    
    const html = generateSocialMetaHTML({
      title: 'Troll City - Live Streaming',
      description: 'Join Troll City for live streaming and more.',
      image: FALLBACK_PREVIEW_IMAGE,
      url: `${APP_URL}/watch/${broadcastId}`,
      type: 'website',
      isLive: false
    })
    
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
}

function generateSocialMetaHTML(data: {
  title: string
  description: string
  image: string
  url: string
  type: string
  isLive: boolean
  videoUrl?: string | null
  twitterCard?: string
  twitterPlayerUrl?: string | null
}) {
  const { title, description, image, url, type, isLive, videoUrl, twitterCard, twitterPlayerUrl } = data
  
  const esc = (str: string) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(url)}">
  
  <meta property="og:type" content="${esc(type)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:site_name" content="Troll City">
  
  ${videoUrl ? `
  <meta property="og:video" content="${esc(videoUrl)}">
  <meta property="og:video:secure_url" content="${esc(videoUrl)}">
  <meta property="og:video:type" content="text/html">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">
  ` : ''}
  
  <meta name="twitter:card" content="${esc(twitterCard || 'summary_large_image')}">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">
  <meta name="twitter:site" content="@trollcityapp">
  
  ${twitterPlayerUrl ? `
  <meta name="twitter:player" content="${esc(twitterPlayerUrl)}">
  <meta name="twitter:player:width" content="1280">
  <meta name="twitter:player:height" content="720">
  ` : ''}
  
  ${isLive ? `
  <meta property="og:live" content="true">
  <meta property="og:stream:status" content="live">
  ` : ''}
  
  <style>
    body { margin: 0; padding: 0; background: #000; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
    .container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
    .live-badge { display: inline-block; background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: bold; margin-bottom: 16px; }
    h1 { font-size: 24px; margin: 0 0 8px 0; }
    p { font-size: 16px; color: #9ca3af; margin: 0 0 24px 0; }
    .preview-image { max-width: 100%; max-height: 400px; border-radius: 8px; margin-bottom: 24px; }
    .cta { display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    ${isLive ? '<span class="live-badge">● LIVE</span>' : ''}
    <img class="preview-image" src="${esc(image)}" alt="${esc(title)}" onerror="this.style.display='none'">
    <h1>${esc(title)}</h1>
    <p>${esc(description)}</p>
    <a class="cta" href="${esc(url)}">Watch Now</a>
  </div>
</body>
</html>`
  
  return html
}