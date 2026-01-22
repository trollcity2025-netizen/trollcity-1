// TypeScript types for Trollifications (Notifications System)

export type NotificationType =
  | 'gift_received'
  | 'badge_unlocked'
  | 'payout_status'
  | 'moderation_action'
  | 'battle_result'
  | 'officer_update'
  | 'system_announcement'
  | 'vehicle_auction'
  | 'application_submitted'
  | 'report_filed'
  | 'payout_request'
  | 'support_ticket'
  | 'system_update'
  | 'stream_live'
  | 'join_approved'
  | 'moderation_alert'
  | 'new_follower'
  | 'message'
  | 'support_reply'
  | 'payout_update'
  | 'role_update'
  | 'application_result'
  | 'troll_drop'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  metadata: Record<string, any>
  is_read: boolean
  created_at: string
  username?: string
  avatar_url?: string
}

export interface NotificationMetadata {
  gift_id?: string
  sender_id?: string
  coins_spent?: number
  stream_id?: string
  badge_id?: string
  earned_at?: string
  payout_id?: string
  status?: string
  cash_amount?: number
  coins_redeemed?: number
  action_id?: string
  action_type?: string
  reason?: string
  created_by?: string
  expires_at?: string
  battle_id?: string
  winner_id?: string
  coins_earned?: number
  [key: string]: any
}

