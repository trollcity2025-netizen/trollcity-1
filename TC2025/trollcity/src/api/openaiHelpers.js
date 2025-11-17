// Helper to extract text and JSON from various OpenAI Responses API shapes
export function extractOpenAIResponse(resp) { 
  if (!resp) return { text: null, json: null, raw: resp };

  // Common fields to inspect
  const candidates = [];

  // Responses API: resp.output || resp.outputs
  if (resp.output) candidates.push(resp.output);
  if (resp.outputs) candidates.push(resp.outputs);
  if (resp.choices) candidates.push(resp.choices);
  if (resp.output_text) candidates.push(resp.output_text);
  if (typeof resp === 'string') candidates.push(resp);

  // Flatten candidate text pieces
  let collected = '';
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'string') {
      collected += (collected ? '\n' : '') + c;
      continue;
    }
    if (Array.isArray(c)) {
      for (const part of c) {
        if (!part) continue;
        if (typeof part === 'string') collected += (collected ? '\n' : '') + part;
        else if (part.text) collected += (collected ? '\n' : '') + part.text;
        else if (part.content) {
          if (typeof part.content === 'string') collected += (collected ? '\n' : '') + part.content;
          else if (Array.isArray(part.content)) {
            collected += (collected ? '\n' : '') + part.content.map(p => p?.text || p?.content || '').join(' ');
          }
        } else if (part.message && part.message.content) {
          if (typeof part.message.content === 'string') collected += (collected ? '\n' : '') + part.message.content;
          else if (Array.isArray(part.message.content)) collected += (collected ? '\n' : '') + part.message.content.map(p => p?.text || p?.content || '').join(' ');
        }
      }
      continue;
    }
    // object-like
    if (c.message && c.message.content) {
      if (typeof c.message.content === 'string') collected += (collected ? '\n' : '') + c.message.content;
      else if (Array.isArray(c.message.content)) collected += (collected ? '\n' : '') + c.message.content.map(p => p?.text || p?.content || '').join(' ');
    }
    if (c.content && typeof c.content === 'string') collected += (collected ? '\n' : '') + c.content;
    if (c.text && typeof c.text === 'string') collected += (collected ? '\n' : '') + c.text;
  }

  // Try to parse JSON from collected text
  let parsed = null;
  if (collected) {
    const firstJson = (() => {
      const idx = collected.indexOf('{');
      if (idx === -1) return null;
      const trimmed = collected.slice(idx);
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        // try to extract a JSON-ish substring using last closing brace
        const last = trimmed.lastIndexOf('}');
        if (last > 0) {
          const candidate = trimmed.slice(0, last + 1);
          try { return JSON.parse(candidate); } catch (e2) { return null; }
        }
        return null;
      }
    })();
    if (firstJson) parsed = firstJson;
  }

  return { text: collected || null, json: parsed, raw: resp };
}
