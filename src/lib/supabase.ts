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

export type UserRole = 'user' | 'moderator' | 'admin' | 'troll_officer' | 'troll_family' | 'troller'
export type UserTier = string // Now dynamic based on XP
export type StreamStatus = 'live' | 'ended'
export type TransactionType = 'purchase' | 'gift' | 'spin' | 'insurance' | 'cashout'

export interface UserProfile {
  id: string
  username: string
  avatar_url: string
  bio: string
  email?: string
  role: UserRole
  tier: UserTier
  xp: number // Total XP points
  level: number // Calculated from XP
  paid_coin_balance: number
  free_coin_balance: number
  total_earned_coins: number
  total_spent_coins: number
  insurance_level: string | null
  insurance_expires_at: string | null
  no_kick_until: string | null
  no_ban_until: string | null
  ban_expires_at?: string | null
  terms_accepted?: boolean
  badge?: string | null
  has_insurance?: boolean
  multiplier_active?: boolean
  multiplier_value?: number
  multiplier_expires?: string | null
  created_at: string
  updated_at: string

  sav_bonus_coins?: number
  vived_bonus_coins?: number
  payment_methods?: Array<any>
  payout_method?: string
  payout_details?: string

  // Officer fields
  is_troll_officer?: boolean
  is_officer_active?: boolean
  is_lead_officer?: boolean
  officer_level?: number // 1=Junior, 2=Senior, 3=Commander, 4=Elite Commander, 5=HQ Master
  officer_tier_badge?: string // 'blue', 'orange', 'red', 'purple', 'gold'
  
  // Officer Work Credit (OWC) fields
  owc_balance?: number // Current OWC balance
  total_owc_earned?: number // Lifetime OWC earned

  // Admin field
  is_admin?: boolean

  // Troller fields
  is_troller?: boolean
  troller_level?: number // 1=Basic Troller, 2=Chaos Agent, 3=Supreme Troll

  // OG User field
  is_og_user?: boolean

  // Language preference
  preferred_language?: string // 'en', 'es', 'ar', 'fr', 'fil', etc.

  // Kick/Ban fields
  kick_count?: number
  is_kicked?: boolean
  kicked_until?: string | null
  account_deleted_at?: string | null
  account_deletion_cooldown_until?: string | null
  account_reset_after_ban?: boolean

  // Square Card on File
  square_customer_id?: string | null
  square_card_id?: string | null

  // Empire Partner
  is_empire_partner?: boolean // Deprecated - use empire_role instead
  empire_role?: string | null // 'partner' when approved as Empire Partner

  // Moderation fields
  is_banned?: boolean
  is_officer?: boolean

  // Verification fields
  is_verified?: boolean
  verification_date?: string | null
  verification_paid_amount?: number | null
  verification_payment_method?: string | null

  // Officer reputation
  officer_reputation_score?: number

  // Ghost mode
  is_ghost_mode?: boolean

  // PayPal payout
  payout_paypal_email?: string | null

  // Broadcaster field
  is_broadcaster?: boolean
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
  livekit_room: string
  livekit_token: string | null
  multi_beam?: boolean
  thumbnail_url?: string | null
  is_testing_mode?: boolean
  is_live?: boolean
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
  processing_fee_percentage: number   // ← Correct and consistent
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
