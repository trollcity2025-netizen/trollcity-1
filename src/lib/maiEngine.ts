import { supabase } from './supabase'

type MaiRequestPayload = {
  personality_type: string
  dna_trait: string | null
  behavior_rules: any
  recent_events: any[]
  context: any
}

export async function initMaiRuntime() {
  return true
}

export async function generateMaiResponse(payload: MaiRequestPayload) {
  // Use environment variable or fallback to production URL
  const maiApiUrl = import.meta.env.VITE_MAI_API_URL || 'https://api.trollcity.app/api/generate'
  const res = await fetch(maiApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const j = await res.json().catch(() => ({}))
  return j
}

export async function simulateAvatarParticipation(userId: string, avatarId: string, context: any) {
  const { data: dna } = await supabase.from('troll_dna_profiles').select('*').eq('user_id', userId).maybeSingle()
  const { data: avatar } = await supabase.from('troll_ai_avatars').select('*').eq('id', avatarId).maybeSingle()
  const { data: events } = await supabase.from('troll_dna_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
  const resp = await generateMaiResponse({
    personality_type: avatar?.personality_type || 'neutral',
    dna_trait: dna?.primary_dna || null,
    behavior_rules: avatar?.behavior_rules || {},
    recent_events: events || [],
    context
  })
  return resp
}

export async function triggerMaiReaction(userId: string, eventType: string, metadata?: any) {
  const { data: avatars } = await supabase.from('troll_ai_avatars').select('*').eq('is_active', true)
  const { data: dna } = await supabase.from('troll_dna_profiles').select('*').eq('user_id', userId).maybeSingle()
  const primary = String(dna?.primary_dna || '').toUpperCase()
  const match = (avatars || []).find((a: any) => String(a.dna_key || '').toUpperCase() === primary) || (avatars || [])[0]
  if (!match) return null
  const { data: events } = await supabase.from('troll_dna_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5)
  const response = await generateMaiResponse({
    personality_type: match.personality_type || 'neutral',
    dna_trait: dna?.primary_dna || null,
    behavior_rules: match.behavior_rules || {},
    recent_events: events || [],
    context: { eventType, metadata }
  })
  const text = response?.text || response?.message || ''
  const streamId = metadata?.stream_id || metadata?.streamId
  if (text && streamId) {
    await supabase.from('messages').insert({
      stream_id: streamId,
      user_id: userId,
      content: text,
      message_type: 'entrance',
      gift_amount: null,
      created_at: new Date().toISOString()
    })
  }
  return { avatar: match, text }
}

