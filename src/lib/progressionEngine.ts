import { supabase } from './supabase'
import { triggerMaiReaction } from './maiEngine'

export type DnaEventType =
  | 'WHEEL_BANKRUPT'
  | 'HIGH_RISK_SPIN'
  | 'SENT_CHAOS_GIFT'
  | 'HELPED_SMALL_STREAMER'
  | 'WON_FAMILY_WAR'
  | 'LOST_FAMILY_WAR'
  | 'SILENT_WATCHER'
  | 'STREAM_EVENT'
  | 'PURCHASE_EVENT'
  | 'LEGACY_EVENT'
  | 'EPIC_GIFT_CHAOS'
  | 'HIGH_SPENDER'
  | 'PAYMENT_METHOD_LINKED'
  | 'STREAM_START'
  | 'WAR_BEGIN'
  | 'HIGH_SPENDER_EVENT'

export async function addXp(userId: string, amount: number, reason?: string) {
  const { data, error } = await supabase.rpc('add_xp', { p_user_id: userId, p_amount: Math.max(0, Math.floor(amount)), p_reason: reason || null })
  return { data, error }
}

export async function recordEvent(userId: string, eventType: DnaEventType, payload?: any) {
  const { data, error } = await supabase.rpc('record_dna_event', { p_user_id: userId, p_event_type: eventType, p_data: payload || {} })
  return { data, error }
}

export async function mutateDnaForUser(userId: string, eventType: DnaEventType, payload?: any) {
  return await recordEvent(userId, eventType, payload)
}

export async function recordAppEvent(userId: string, eventType: DnaEventType, metadata?: any) {
  const payload = metadata || {}
  const { data, error } = await supabase.rpc('record_dna_event', { p_user_id: userId, p_event_type: eventType, p_data: payload })
  try { await triggerMaiReaction(userId, eventType, payload) } catch {}
  return { data, error }
}

export function dnaClassFor(primary: string | null | undefined) {
  const key = String(primary || '').toUpperCase()
  if (key === 'CHAOS_DNA') return 'dna-chaos'
  if (key === 'MAD_TROLL_DNA') return 'dna-mad'
  if (key === 'GHOST_DNA') return 'dna-ghost'
  if (key === 'GUARDIAN_DNA') return 'dna-guardian'
  if (key === 'WARRIOR_DNA') return 'dna-warrior'
  if (key === 'LEGACY_DNA') return 'dna-legacy'
  if (key === 'GAMBLER_DNA') return 'dna-gambler'
  return ''
}

export async function currentIdentity(userId: string) {
  const { data: lvl } = await supabase.from('user_levels').select('*').eq('user_id', userId).maybeSingle()
  const { data: dna } = await supabase.from('troll_dna_profiles').select('*').eq('user_id', userId).maybeSingle()
  return { level: lvl || { level: 1, xp: 0, next_level_xp: 100 }, dna: dna || { primary_dna: null, traits: [] } }
}

export async function getLevelProfile(userId: string) {
  const { data } = await supabase.from('user_levels').select('*').eq('user_id', userId).maybeSingle()
  return data || { level: 1, xp: 0, total_xp: 0, next_level_xp: 100 }
}

export async function getDnaProfile(userId: string) {
  const { data } = await supabase.from('troll_dna_profiles').select('*').eq('user_id', userId).maybeSingle()
  return data || { primary_dna: null, traits: [], aura_style: null, personality_scores: {}, evolution_score: 0 }
}

export async function getUserFullIdentity(userId: string) {
  const lvl = await getLevelProfile(userId)
  const dna = await getDnaProfile(userId)
  const { data: recent } = await supabase.from('troll_dna_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  return { level: lvl, dna, events: recent || [] }
}
