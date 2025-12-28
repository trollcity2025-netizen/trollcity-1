// TypeScript types for Earnings System

export interface EarningsView {
  id: string
  username: string
  total_earned_coins: number
  troll_coins: number
  current_month_earnings: number
  current_month_transactions: number
  current_month_paid_out: number
  current_month_pending: number
  current_month_approved: number
  current_month_paid_count: number
  current_month_pending_count: number
  yearly_paid_usd: number
  yearly_payout_count: number
  tax_year: number
  irs_threshold_status: 'over_threshold' | 'nearing_threshold' | 'below_threshold'
  last_payout_at: string | null
  pending_requests_count: number
  lifetime_paid_usd: number
}

export interface MonthlyEarnings {
  month: string
  coins_earned_from_gifts: number
  gift_count: number
  unique_gifters: number
  troll_coins_earned: number
}

export interface PayoutRequest {
  id: string
  user_id: string
  cash_amount: number
  coins_redeemed: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  created_at: string
  processed_at: string | null
  admin_id: string | null
  notes: string | null
}

export interface RequestPayoutResponse {
  success: boolean
  payout_request_id?: string
  updated_balance?: number
  error?: string
}

