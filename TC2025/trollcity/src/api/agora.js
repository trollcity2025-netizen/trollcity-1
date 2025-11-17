// Accept either an object { channelName, uid, role } or positional args
export async function generateAgoraToken(channelNameOrOpts, roleOrUid = "publisher", maybeUid) {
  let channelName;
  let role = "publisher";
  let uid;

  if (typeof channelNameOrOpts === 'object' && channelNameOrOpts !== null) {
    ({ channelName, uid, role = 'publisher' } = channelNameOrOpts);
  } else {
    channelName = channelNameOrOpts;
    // If second arg is a string, treat it as role, otherwise as uid
    if (typeof roleOrUid === 'string') {
      role = roleOrUid || 'publisher';
      uid = maybeUid;
    } else {
      uid = roleOrUid;
    }
  }

  // Support both VITE_SUPABASE_FUNCTION_URL (singular) and older VITE_SUPABASE_FUNCTIONS_URL
  const base = import.meta.env.VITE_SUPABASE_FUNCTION_URL || import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || undefined;

  try {
    // If base already points to the full function endpoint (e.g. includes path), use it directly.
    // Otherwise fall back to local API route.
      // Prefer calling our new server-side OpenAI-like functions or Supabase function endpoint
      const url = base ? `${base}/get-agora-token` : "/api/get-agora-token"; // allow platform proxy
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelName, uid, role }),
    });
    const data = await res.json().catch(() => ({}));
    return data || {};
  } catch (err) {
    console.warn('generateAgoraToken fetch failed', err);
    return {};
  }
}

