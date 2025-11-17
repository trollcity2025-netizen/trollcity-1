export function UNIVERSAL_COMMAND_PROMPT(text) {
  return `You are TrollCity Admin AI. ${text}`;
}

import { supabase } from '@/api/supabaseClient';

export async function executeCommand(command, options = {}) {
  try {
    console.info('[CommandEngine] executeCommand', { command, options });

    const prompt = UNIVERSAL_COMMAND_PROMPT(command);

    // Prefer calling server-side OpenAI via Supabase Edge Function
    if (supabase && supabase.functions && supabase.__isConfigured) {
      const resp = await supabase.functions.invoke('openaiResponse', { body: { input: prompt, model: options.model || 'gpt-5-nano' } });
        const data = resp?.data || resp;
        try {
          const { extractOpenAIResponse } = await import('./openaiHelpers.js');
          const parsed = extractOpenAIResponse(data);
          return { ok: true, result: parsed.json || parsed.text || parsed.raw };
        } catch (e) {
          return { ok: true, result: data };
        }
    }

    // Fallback: no-op result
    return { ok: true, result: null };
  } catch (e) {
    return { ok: false, error: e?.message || 'Command failed' };
  }
}

