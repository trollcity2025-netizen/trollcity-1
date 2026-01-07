import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing production Supabase env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

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
  prestige_level?: number
  perk_tokens?: number
  xp_multiplier?: number
  coin_multiplier?: number
  troll_coins: number
  reserved_troll_coins?: number
  trollmonds?: number
  total_earned_coins: number
  total_spent_coins: number
  insurance_level: string | null
  insurance_expires_at: string | null
  rgb_username_expires_at?: string | null
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
  officer_role?: string | null // 'lead_officer', 'owner', or null
  officer_level?: number // 1=Junior, 2=Senior, 3=Commander, 4=Elite Commander, 5=HQ Master
  officer_tier_badge?: string // 'blue', 'orange', 'red', 'purple', 'gold'
  
  // Unified Role
  troll_role?: string | null
  
  // Officer Work Credit (OWC) fields
  owc_balance?: number // Current OWC balance
  total_owc_earned?: number // Lifetime OWC earned

  // Admin field
  is_admin?: boolean
  // TrollTract fields
  is_trolltract?: boolean
  trolltract_activated_at?: string | null

  // Troller fields
  is_troller?: boolean
  troller_level?: number // 1=Basic Troller, 2=Chaos Agent, 3=Supreme Troll

  // OG User field
  is_og_user?: boolean

  // Language preference
  preferred_language?: string // 'en', 'es', 'ar', 'fr', 'fil', etc.

  // Onboarding / W9 fields
  legal_full_name?: string
  date_of_birth?: string
  country?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state_region?: string
  postal_code?: string
  tax_id_last4?: string
  tax_classification?: 'individual' | 'business'
  w9_status?: 'pending' | 'submitted' | 'verified' | 'rejected'

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
  empire_role?: string | null // 'partner' when approved as Empire Partner
  empire_partner?: boolean // New field for partner status
  partner_status?: string | null // 'approved', 'pending', 'rejected'

  // Moderation fields
  is_banned?: boolean
  is_officer?: boolean

  // Verification fields
  is_verified?: boolean
  verification_date?: string | null
  verification_paid_amount?: number | null
  verification_payment_method?: string | null
  is_trolls_night_approved?: boolean
  trolls_night_rejection_count?: number
  // date_of_birth removed (duplicate)

  // Officer reputation
  officer_reputation_score?: number

  // Ghost mode
  is_ghost_mode?: boolean

  // PayPal payout
  payout_paypal_email?: string | null

  // Broadcaster field
  is_broadcaster?: boolean

  // Profile view price
  profile_view_price?: number

  // Application fields
  court_recording_consent?: boolean
  application_required?: boolean
  application_submitted?: boolean
  
  tax_status?: string
  tax_last_updated?: string
  tax_form_url?: string
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

export interface SystemError {
  id: string
  user_id?: string | null
  message: string
  stack?: string | null
  component?: string | null
  url?: string | null
  status: 'open' | 'resolved' | 'investigating'
  admin_response?: string | null
  created_at: string
  responded_at?: string | null
}

export const ADMIN_EMAIL = (import.meta as any).env?.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com'

// Production-ready admin email validation with additional security checks
export const isAdminEmail = (email?: string): boolean => {
  if (!email) return false
  
  const cleanEmail = String(email).trim().toLowerCase()
  const adminEmail = String(ADMIN_EMAIL).trim().toLowerCase()
  
  // Exact match validation
  return cleanEmail === adminEmail
}

// Role hierarchy and permissions management
export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  HR_ADMIN = 'hr_admin',
  LEAD_TROLL_OFFICER = 'lead_troll_officer',
  TROLL_OFFICER = 'troll_officer',
  TROLL_FAMILY = 'troll_family',
  TROLLER = 'troller',
  EMPIRE_PARTNER = 'empire_partner',
  SECRETARY = 'secretary'
}

export enum Permission {
  // Admin permissions
  MANAGE_USERS = 'manage_users',
  MANAGE_CONTENT = 'manage_content',
  MANAGE_FINANCES = 'manage_finances',
  MANAGE_SYSTEM = 'manage_system',
  
  // Officer permissions
  MODERATE_CHAT = 'moderate_chat',
  MODERATE_STREAMS = 'moderate_streams',
  MANAGE_REPORTS = 'manage_reports',
  ISSUE_WARNINGS = 'issue_warnings',
  
  // Content permissions
  BROADCAST = 'broadcast',
  CREATE_CONTENT = 'create_content',
  MONETIZE = 'monetize'
}

// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.MODERATOR]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS
  ],
  [UserRole.TROLL_OFFICER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS
  ],
  [UserRole.LEAD_TROLL_OFFICER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.MANAGE_USERS
  ],
  [UserRole.TROLL_FAMILY]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.TROLLER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT
  ],
  [UserRole.EMPIRE_PARTNER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.SECRETARY]: [
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_REPORTS,
    Permission.MANAGE_SYSTEM,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.HR_ADMIN]: [
    // HR Admin has user management permissions
    Permission.MANAGE_USERS,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.ADMIN]: [
    // Admin has all permissions
    Permission.MANAGE_USERS,
    Permission.MANAGE_CONTENT,
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_SYSTEM,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ]
}

// Enhanced role validation with comprehensive checks
export const hasPermission = (profile: UserProfile | null, permission: Permission): boolean => {
  if (!profile) return false
  
  // Admin has all permissions
  if (profile.role === UserRole.ADMIN || profile.is_admin) return true
  
  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[profile.role as UserRole] || []
  return rolePermissions.includes(permission)
}

// Enhanced role checking with multiple validation methods
export const hasRole = (
  profile: UserProfile | null,
  requiredRoles: UserRole | UserRole[],
  options: {
    requireActive?: boolean // For officers
    allowAdminOverride?: boolean
  } = {}
): boolean => {
  if (!profile) return false
  
  const { requireActive = false, allowAdminOverride = true } = options
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]
  
  // Admin override
  if (allowAdminOverride && (profile.role === UserRole.ADMIN || profile.is_admin)) {
    return true
  }
  
  // Direct role match
  if (roles.includes(profile.role as UserRole)) {
    // Additional checks for specific roles
    if (
      (profile.role === UserRole.TROLL_OFFICER ||
        profile.role === UserRole.LEAD_TROLL_OFFICER) &&
      requireActive
    ) {
      return Boolean(profile.is_officer_active)
    }
    return true
  }

  // Unified troll_role match
  if (profile.troll_role && roles.includes(profile.troll_role as UserRole)) {
    if (
      (profile.troll_role === UserRole.TROLL_OFFICER ||
        profile.troll_role === UserRole.LEAD_TROLL_OFFICER) &&
      requireActive
    ) {
      return Boolean(profile.is_officer_active)
    }
    return true
  }
  
  // Legacy role field compatibility
  if (roles.includes(UserRole.TROLL_OFFICER) && profile.is_troll_officer) {
    if (requireActive) {
      return Boolean(profile.is_officer_active)
    }
    return true
  }

  if (roles.includes(UserRole.LEAD_TROLL_OFFICER) && profile.is_lead_officer) {
    if (requireActive) {
      return Boolean(profile.is_officer_active)
    }
    return true
  }
  
  return false
}

// Production-ready profile validation
export const validateProfile = (profile: UserProfile | null): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} => {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!profile) {
    errors.push('Profile is null')
    return { isValid: false, errors, warnings }
  }
  
  // Required fields validation
  if (!profile.id) errors.push('Missing user ID')
  if (!profile.username) errors.push('Missing username')
  if (!profile.role) errors.push('Missing role')
  
  // Role-specific validations
  if (profile.role === UserRole.TROLL_OFFICER) {
    if (profile.is_officer_active && !profile.officer_level) {
      warnings.push('Officer is active but missing officer level')
    }
  }
  
  // Balance validation
  if (profile.troll_coins < 0) errors.push('Negative troll coins balance')
  if (profile.total_earned_coins < 0) errors.push('Negative total earned coins')
  
  // Permission warnings
  if (profile.role === UserRole.ADMIN && !profile.is_admin) {
    warnings.push('Admin role detected but is_admin flag is false')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

export async function ensureSupabaseSession(client: SupabaseClient) {
  const { data: sessionData, error } = await client.auth.getSession()
  if (error) {
    throw error
  }
  const session = sessionData?.session ?? null
  if (!session) {
    throw new Error('Not logged in yet')
  }

  return session
}

/**
 * ✅ Get active session with automatic refresh
 * This prevents race conditions by always refreshing before getting session
 */
export async function getActiveSession(): Promise<any> {
  try {
    // ✅ Fix: Check session first, ONLY refresh if missing
    // This avoids triggering unnecessary global auth updates
    const { data } = await supabase.auth.getSession()
    
    if (data.session?.access_token) {
      return data.session
    }

    // Only refresh if truly missing
    console.log('[getActiveSession] No active session found, attempting refresh...')
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    
    if (refreshError) {
      console.warn('[getActiveSession] Session error:', refreshError.message)
      return null
    }
    
    if (!refreshData.session?.access_token) {
      console.warn('[getActiveSession] No session found after refresh')
      return null
    }
    
    return refreshData.session
  } catch (err: any) {
    console.error('[getActiveSession] Error getting session:', err?.message)
    return null
  }
}

export async function reportError(params: {
  message: string
  stack?: string
  userId?: string | null
  url?: string
  component?: string
  context?: any
}) {
  try {
    const payload = {
      message: params.message?.slice(0, 1000),
      stack: params.stack?.slice(0, 4000),
      user_id: params.userId || null,
      url: params.url || (typeof window !== 'undefined' ? window.location.pathname : null),
      component: params.component || null,
      context: params.context ? JSON.stringify(params.context).slice(0, 8000) : {},
      status: 'open'
    }
    const { error } = await supabase.from('system_errors').insert(payload)
    if (error) {
      console.warn('Error reporting failed', error)
    }
  } catch (e: any) {
    console.warn('Error reporting threw', e?.message || e)
  }
}

export async function searchUsers(params: {
  query: string
  limit?: number
  select?: string
}): Promise<Array<{
  id: string
  username: string
  avatar_url?: string | null
  rgb_username_expires_at?: string | null
}>> {
  const limit = params.limit ?? 20
  const select = params.select ?? 'id, username, avatar_url, rgb_username_expires_at'
  const q = (params.query || '').trim().replace('@', '')

  if (!q) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(select)
      .order('created_at', { ascending: false })
      .limit(Math.max(limit, 1))
    if (error) {
      console.warn('searchUsers empty query failed', error)
      return []
    }
    return (data as any[]) || []
  }

  try {
    const { data, error } = await supabase.rpc('search_users', {
      p_query: q,
      p_limit: Math.max(limit, 1)
    })
    if (!error && Array.isArray(data)) {
      return data as any[]
    }
  } catch {
    // ignore and fallback
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select(select)
    .ilike('username', `%${q}%`)
    .order('username', { ascending: true })
    .limit(Math.max(limit, 1))

  if (error) {
    console.warn('searchUsers fallback failed', error)
    return []
  }
  return (data as any[]) || []
}

export interface SystemSettings {
  id: string
  payout_lock_enabled: boolean
  payout_lock_reason?: string | null
  payout_unlock_at?: string | null
  trial_started_at?: string | null
  trial_started_by?: string | null
  updated_at: string
}

export async function getSystemSettings(): Promise<SystemSettings | null> {
  const { data, error } = await supabase.rpc('get_system_settings')
  if (error) {
    console.warn('getSystemSettings error', error)
    return null
  }
  return (data as any) || null
}

export function getCountdown(target?: string | null): { totalMs: number; days: number; hours: number; minutes: number; seconds: number } {
  if (!target) return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
  const t = new Date(target).getTime() - Date.now()
  const totalMs = Math.max(t, 0)
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((totalMs % (1000 * 60)) / 1000)
  return { totalMs, days, hours, minutes, seconds }
}

export async function startLaunchTrial(adminUserId: string): Promise<SystemSettings | null> {
  const { data, error } = await supabase.rpc('start_launch_trial', { p_admin_id: adminUserId })
  if (error) {
    console.warn('startLaunchTrial error', error)
    return null
  }
  await supabase.rpc('notify_all_users', {
    p_title: 'Launch Trial started',
    p_message: 'Launch Trial started. Payouts unlock in 14 days.',
    p_type: 'system_update'
  })
  return (data as any) || null
}

export async function endTrialEarly(): Promise<SystemSettings | null> {
  const { data, error } = await supabase.rpc('end_trial_early')
  if (error) {
    console.warn('endTrialEarly error', error)
    return null
  }
  await supabase.rpc('notify_all_users', {
    p_title: 'Payouts are now open',
    p_message: 'Payouts are now open!',
    p_type: 'system_update'
  })
  return (data as any) || null
}

export async function relockPayouts(reason?: string): Promise<SystemSettings | null> {
  const { data, error } = await supabase.rpc('relock_payouts', { p_reason: reason || 'Emergency payout lock' })
  if (error) {
    console.warn('relockPayouts error', error)
    return null
  }
  return (data as any) || null
}

export async function autoUnlockPayouts(): Promise<SystemSettings | null> {
  const { data, error } = await supabase.rpc('auto_unlock_payouts')
  if (error) {
    console.warn('autoUnlockPayouts error', error)
    return null
  }
  if (data && (data as any)?.payout_lock_enabled === false) {
    await supabase.rpc('notify_all_users', {
      p_title: 'Payouts are now open',
      p_message: 'Payouts are now open!',
      p_type: 'system_update'
    })
  }
  return (data as any) || null
}
