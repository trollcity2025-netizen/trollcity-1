export async function getAgoraToken(channelName, uid) {
  // Attempt to call edge function; otherwise return a safe placeholder
  const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || undefined;
  const devToken = import.meta.env.VITE_AGORA_DEV_TOKEN || null;
  const appId = import.meta.env.VITE_AGORA_APP_ID || null;
  if (devToken && appId) {
    return { token: devToken, appId, uid };
  }
  try {
    const url = base ? `${base}/generateagoratoken` : "/api/generateagoratoken"; // allow platform proxy
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelName, uid }),
    });
    const data = await res.json().catch(() => ({}));
    return data || {};
  } catch (_) {
    return {};
  }
}
