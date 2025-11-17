// Local integration layer to provide Core helpers and AI invocation without external keys
export function attachIntegrations(supabase) {
  if (!supabase.integrations) supabase.integrations = {};
  if (!supabase.integrations.Core) {
    supabase.integrations.Core = {};
  }

  // Upload a public file to Supabase Storage and return its public URL
  supabase.integrations.Core.UploadFile = async ({ file, bucket = 'avatars', pathPrefix = 'uploads' }) => {
    if (!file) throw new Error('No file provided');
    const userId = (await supabase.auth.getUser()).data?.user?.id || 'anon';
    const ext = file.name?.split('.').pop() || 'jpg';
    const path = `${pathPrefix}/${userId}/${Date.now()}.${ext}`;
    const tryUpload = async (b) => {
      const { error: err } = await supabase.storage.from(b).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });
      if (err) throw err;
      const { data } = supabase.storage.from(b).getPublicUrl(path);
      return { file_url: data.publicUrl, bucket: b, path };
    };

    // Try provided bucket first, then fall back to common buckets (deduped)
    const candidates = Array.from(new Set([bucket, 'avatars', 'images', 'public']));
    let lastError = null;
    for (const b of candidates) {
      try {
        return await tryUpload(b);
      } catch (e) {
        lastError = e;
        const msg = (e?.message || '').toLowerCase();
        const isBucketMissing = msg.includes('bucket') && msg.includes('not found');
        const isRlsDenied = msg.includes('row-level security') || msg.includes('permission denied') || msg.includes('policy');
        // Continue trying next candidate when RLS/permission or bucket missing
        if (isRlsDenied || isBucketMissing) {
          continue;
        }
        // For other error types, stop and surface
        break;
      }
    }

    const lastMsg = (lastError?.message || String(lastError || '')).toLowerCase();
    const isRlsDenied = lastMsg.includes('row-level security') || lastMsg.includes('permission denied') || lastMsg.includes('policy');
    if (isRlsDenied) {
      throw new Error(
        `Upload blocked by Supabase Storage RLS. Allow authenticated insert/update on storage.objects for one of [${candidates.join(', ')}] or make the bucket public. Details: ${lastError?.message || lastError}`
      );
    }

    throw new Error(`Storage bucket missing. Please create one of [${candidates.join(', ')}] in Supabase Storage. Details: ${lastError?.message || lastError}`);
  };

  // Create a signed URL for a file in Storage
  supabase.integrations.Core.CreateFileSignedUrl = async ({ bucket = 'public', path, expiresIn = 3600 }) => {
    if (!path) throw new Error('Path is required');
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) throw error;
    return { signed_url: data.signedUrl };
  };

  // Upload a private file (use a private bucket)
  supabase.integrations.Core.UploadPrivateFile = async ({ file, bucket = 'private', pathPrefix = 'uploads' }) => {
    if (!file) throw new Error('No file provided');
    const userId = (await supabase.auth.getUser()).data?.user?.id || 'anon';
    const ext = file.name?.split('.').pop() || 'dat';
    const path = `${pathPrefix}/${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });
    if (error) throw error;
    return { bucket, path };
  };

  // Basic AI invocation without external deps; returns rule-based JSON from instruction
  supabase.integrations.Core.InvokeLLM = async ({ prompt, model = 'gpt-5-nano', store = false } = {}) => {
    if (!prompt || prompt.length < 1) throw new Error('Prompt is required');

    // If Supabase Edge Functions are configured, prefer calling the server-side
    // `openaiResponse` function so the OpenAI API key remains secret.
    try {
      if (supabase && supabase.functions && supabase.__isConfigured) {
        const payload = { input: prompt, model, store };
            const resp = await supabase.functions.invoke('openaiResponse', { body: payload });
            const data = resp?.data || resp;

            // Use helper to extract text/JSON
            try {
              const { extractOpenAIResponse } = await import('./openaiHelpers.js');
              const parsed = extractOpenAIResponse(data);
              if (parsed.json) return parsed.json;
              if (parsed.text) return { text: parsed.text, raw: parsed.raw };
            } catch (e) {
              console.warn('InvokeLLM: parse helper failed', e?.message || e);
            }

            return { raw: data };
      }
    } catch (e) {
      console.warn('InvokeLLM: server call failed, falling back to local rules:', e?.message || e);
    }

    // Fallback: local rule-based parsing (keeps previous behavior when offline)
    const cfg = {};
    const lower = prompt.toLowerCase();
    const incMatch = lower.match(/increase\s+(daily reward|reward)\s+to\s+(\d+)/);
    if (incMatch) cfg.daily_reward = Number(incMatch[2]);
    const enableMatch = lower.match(/enable\s+([a-z\s-]+)/);
    if (enableMatch) cfg[enableMatch[1].trim().replace(/\s+/g,'_')] = true;
    const setPriceMatch = lower.match(/(entrance effect price|price)\s+(to|=)\s*(\d+)/);
    if (setPriceMatch) cfg.entrance_effect_price = Number(setPriceMatch[3]);

    const text = Object.keys(cfg).length > 0
      ? JSON.stringify(cfg)
      : `{"note":"No structured commands detected","raw":"${prompt.replace(/"/g,'\\"')}"}`;
    return { text };
  };

  // Stubs
  supabase.integrations.Core.GenerateImage = async () => ({ url: null });
  supabase.integrations.Core.ExtractDataFromUploadedFile = async () => ({ data: null });
}
