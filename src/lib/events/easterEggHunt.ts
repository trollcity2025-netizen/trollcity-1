// Easter Egg Hunt System
// Manages hidden eggs across pages, reward distribution, and user limits
// Active May 5-7, max 10 eggs per user, all roles

import { supabase } from '@/lib/supabase'
import { addCoins } from '@/lib/coinTransactions'
import type { AbilityId } from '@/types/broadcastAbilities'

export const EASTER_HUNT_CONFIG = {
  startMonth: 5,
  startDay: 5,
  endMonth: 5,
  endDay: 7,
  maxEggsPerUser: 10,
  eggsPerPage: 3,
}

export type EggRewardType =
  | 'coins'
  | 'trollmonds'
  | 'kick_insurance'
  | 'free_box_price'
  | 'ability'

export interface EggReward {
  type: EggRewardType
  label: string
  amount?: number
  abilityId?: AbilityId
  insuranceHours?: number
}

// All 12 broadcast abilities with their weights
const ABILITY_POOL: { id: AbilityId; weight: number }[] = [
  { id: 'mute_hammer', weight: 10 },
  { id: 'truth_serum', weight: 5 },
  { id: 'fake_system_alert', weight: 10 },
  { id: 'gold_frame_broadcast', weight: 10 },
  { id: 'coin_drop_event', weight: 5 },
  { id: 'vip_chat_only', weight: 5 },
  { id: 'raid_another_stream', weight: 5 },
  { id: 'citywide_broadcast', weight: 1 },
  { id: 'troll_foot', weight: 5 },
  { id: 'team_freeze', weight: 12 },
  { id: 'reverse', weight: 12 },
  { id: 'double_xp', weight: 8 },
]

// Reward pool with weights (total ~100)
const REWARD_POOL: { reward: EggReward; weight: number }[] = [
  { reward: { type: 'coins', label: '+5 Troll Coins', amount: 5 }, weight: 20 },
  { reward: { type: 'coins', label: '+10 Troll Coins', amount: 10 }, weight: 15 },
  { reward: { type: 'coins', label: '+25 Troll Coins', amount: 25 }, weight: 8 },
  { reward: { type: 'trollmonds', label: '+10 Trollmonds', amount: 10 }, weight: 12 },
  { reward: { type: 'trollmonds', label: '+25 Trollmonds', amount: 25 }, weight: 6 },
  { reward: { type: 'kick_insurance', label: 'Kick Insurance 24h', insuranceHours: 24 }, weight: 10 },
  { reward: { type: 'free_box_price', label: 'Free Box Price' }, weight: 8 },
  // Abilities fill remaining weight (~14 total)
  ...ABILITY_POOL.map(a => ({
    reward: { type: 'ability' as EggRewardType, label: a.id.replace(/_/g, ' '), abilityId: a.id },
    weight: Math.round(a.weight * 0.8),
  })),
]

function weightedRandom<T>(pool: { item: T; weight: number }[]): T {
  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0)
  let random = Math.random() * totalWeight
  for (const p of pool) {
    random -= p.weight
    if (random <= 0) return p.item
  }
  return pool[pool.length - 1].item
}

export function generateRandomEggReward(): EggReward {
  const pool = REWARD_POOL.map(r => ({ item: r.reward, weight: r.weight }))
  return weightedRandom(pool)
}

export function isEasterHuntActive(): boolean {
  const now = new Date()
  const year = now.getFullYear()

  const start = new Date(year, EASTER_HUNT_CONFIG.startMonth - 1, EASTER_HUNT_CONFIG.startDay)
  const end = new Date(year, EASTER_HUNT_CONFIG.endMonth - 1, EASTER_HUNT_CONFIG.endDay, 23, 59, 59, 999)

  return now >= start && now <= end
}

// ── EGG FIND TRACKING (localStorage + DB sync) ──────────────────────────

interface EggFindRecord {
  eggId: string
  reward: EggReward
  foundAt: string
}

function getStorageKey(userId: string): string {
  return `easter_hunt_${userId}`
}

export function getLocalEggFinds(userId: string): EggFindRecord[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    if (!raw) return []
    const data = JSON.parse(raw)
    // Check if data is from current event window
    const year = new Date().getFullYear()
    if (data.year !== year) return []
    return data.finds || []
  } catch {
    return []
  }
}

export function saveLocalEggFind(userId: string, find: EggFindRecord): void {
  const year = new Date().getFullYear()
  const finds = getLocalEggFinds(userId)
  finds.push(find)
  localStorage.setItem(getStorageKey(userId), JSON.stringify({ year, finds }))
}

export function getUserEggCount(userId: string): number {
  return getLocalEggFinds(userId).length
}

export function canUserFindEgg(userId: string): boolean {
  return getUserEggCount(userId) < EASTER_HUNT_CONFIG.maxEggsPerUser
}

// ── REWARD APPLICATION ──────────────────────────────────────────────────

export async function applyEggReward(
  userId: string,
  reward: EggReward
): Promise<{ success: boolean; message: string }> {
  try {
    switch (reward.type) {
      case 'coins': {
        const result = await addCoins({
          userId,
          amount: reward.amount || 0,
          type: 'reward',
          description: `Easter Egg Hunt: ${reward.label}`,
          metadata: { source: 'easter_egg_hunt' },
        })
        if (!result.success) return { success: false, message: 'Failed to credit coins' }
        return { success: true, message: `+${reward.amount} Troll Coins credited!` }
      }

      case 'trollmonds': {
        const amount = reward.amount || 0
        const { error } = await supabase.rpc('increment_trollmonds', {
          p_user_id: userId,
          p_amount: amount,
        })
        if (error) {
          console.error('[Easter] Trollmond credit failed:', error)
          return { success: false, message: 'Failed to credit trollmonds' }
        }
        return { success: true, message: `+${amount} Trollmonds credited!` }
      }

      case 'kick_insurance': {
        const hours = reward.insuranceHours || 24
        const now = new Date()
        const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000)

        // Check for existing active kick insurance
        const { data: existing } = await supabase
          .from('user_insurances')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .in('protection_type', ['kick', 'full'])
          .gt('expires_at', now.toISOString())
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing) {
          // Extend existing
          const currentExpiry = new Date(existing.expires_at)
          const newExpiry = new Date(currentExpiry.getTime() + hours * 60 * 60 * 1000)
          await supabase
            .from('user_insurances')
            .update({ expires_at: newExpiry.toISOString(), updated_at: now.toISOString() })
            .eq('id', existing.id)
        } else {
          // Create new
          await supabase
            .from('user_insurances')
            .insert({
              user_id: userId,
              protection_type: 'kick',
              purchased_at: now.toISOString(),
              expires_at: expiresAt.toISOString(),
              is_active: true,
            })
        }
        return { success: true, message: `Kick Insurance for ${hours}h activated!` }
      }

      case 'free_box_price': {
        // Store a free box price credit in user_profiles
        const { error } = await supabase
          .from('user_profiles')
          .update({ free_box_price_credit: true })
          .eq('id', userId)

        if (error) {
          // Column might not exist yet, just log
          console.warn('[Easter] Free box price credit update failed:', error)
        }
        return { success: true, message: 'Free Box Price unlocked!' }
      }

      case 'ability': {
        if (!reward.abilityId) return { success: false, message: 'Unknown ability' }
        const { error } = await supabase.rpc('add_ability_to_inventory', {
          p_user_id: userId,
          p_ability_id: reward.abilityId,
        })
        if (error) {
          console.error('[Easter] Ability grant failed:', error)
          return { success: false, message: 'Failed to grant ability' }
        }
        const abilityName = reward.abilityId.replace(/_/g, ' ')
        return { success: true, message: `Ability unlocked: ${abilityName}!` }
      }

      default:
        return { success: false, message: 'Unknown reward type' }
    }
  } catch (err) {
    console.error('[Easter] applyEggReward error:', err)
    return { success: false, message: 'Failed to apply reward' }
  }
}

// ── EGG SPAWN POSITIONS ─────────────────────────────────────────────────

export interface EggSpawn {
  id: string
  x: number // percentage 5-95
  y: number // percentage 5-90
  colorIndex: number
}

const EGG_COLORS = [
  '#FFB6C1', // pink
  '#87CEEB', // blue
  '#DDA0DD', // purple
  '#98FB98', // green
  '#FFDAB9', // peach
  '#E6E6FA', // lavender
  '#B0E0E6', // powder blue
  '#FFFACD', // cream
]

export function generateEggSpawns(pageId: string, count: number = EASTER_HUNT_CONFIG.eggsPerPage): EggSpawn[] {
  // Use pageId as seed for consistent spawns per page per day
  const today = new Date().toISOString().split('T')[0]
  const seed = hashString(`${pageId}-${today}`)

  const spawns: EggSpawn[] = []
  for (let i = 0; i < count; i++) {
    const rng = seededRandom(seed + i)
    spawns.push({
      id: `${pageId}-egg-${i}-${today}`,
      x: 5 + rng() * 85,
      y: 5 + rng() * 80,
      colorIndex: Math.floor(rng() * EGG_COLORS.length),
    })
  }
  return spawns
}

export function getEggColor(index: number): string {
  return EGG_COLORS[index % EGG_COLORS.length]
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
