import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing production Supabase env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export type UserRole = 'user' | 'moderator' | 'admin' | 'troll_officer'
export type UserTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
export type StreamStatus = 'live' | 'ended'
export type TransactionType = 'purchase' | 'gift' | 'spin' | 'insurance' | 'cashout'

export interface UserProfile {
  id: string
  username: string
  avatar_url: string
  bio: string
  role: UserRole
  tier: UserTier
  paid_coin_balance: number
  free_coin_balance: number
  total_earned_coins: number
  total_spent_coins: number
  insurance_level: string | null
  insurance_expires_at: string | null
  no_kick_until: string | null
  no_ban_until: string | null
  created_at: string
  updated_at: string

  sav_bonus_coins?: number
  vived_bonus_coins?: number

}


export interface Stream {
  id: string
  broadcaster_id: string
  title: string
  category?: string
  status: StreamStatus
  start_time: string
  end_time: string | null
  current_viewers: number
  total_gifts_coins: number
  total_unique_gifters: number
  agora_channel: string
  agora_token: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  stream_id: string
  user_id: string
  content: string
  message_type: 'chat' | 'gift' | 'entrance'
  gift_amount: number | null
  created_at: string
}

export interface CoinTransaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  description: string
  metadata: Record<string, any>
  created_at: string
}

export interface CoinPackage {
  id: string
  name: string
  coin_amount: number
  price: number
  currency: string
  description: string
  is_active: boolean
  created_at: string
}

export interface CashoutTier {
  id: string
  coin_amount: number
  cash_amount: number
  currency: string
  processing_fee_percentage: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WheelSlice {
  id: string
  name: string
  type: 'coins' | 'bankrupt' | 'perk'
  value: number
  perk_type: 'no_kick' | 'no_ban' | null
  probability: number
  color: string
}

export interface InsurancePackage {
  id: string
  name: string
  level: string
  cost: number
  duration_days: number
  benefits: string[]
  is_active: boolean
}

export const ADMIN_EMAIL = (import.meta as any).env?.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com'
export const isAdminEmail = (email?: string) => String(email || '').trim().toLowerCase() === String(ADMIN_EMAIL).trim().toLowerCase()
