// TypeScript types for Moderation System

export interface ModerationReport {
  id: string
  reporter_id: string
  reporter_username?: string
  target_user_id?: string | null
  target_username?: string | null
  stream_id?: string | null
  stream_title?: string | null
  reason: string
  description?: string | null
  status: 'pending' | 'reviewing' | 'resolved' | 'action_taken' | 'rejected'
  created_at: string
  resolved_at?: string | null
  reviewed_by?: string | null
  reviewer_username?: string | null
}

export interface ModerationAction {
  id: string
  action_type: 'warn' | 'suspend_stream' | 'ban_user' | 'unban_user'
  target_user_id?: string | null
  target_username?: string | null
  stream_id?: string | null
  stream_title?: string | null
  reason: string
  action_details?: string | null
  created_by: string
  creator_username?: string
  created_at: string
  expires_at?: string | null
  report_id?: string | null
}

export interface SubmitReportPayload {
  reporter_id: string
  target_user_id?: string | null
  stream_id?: string | null
  reason: string
  description?: string
}

export interface TakeActionPayload {
  report_id?: string
  action_type: 'warn' | 'suspend_stream' | 'ban_user' | 'unban_user'
  target_user_id?: string | null
  stream_id?: string | null
  reason: string
  action_details?: string
  expires_at?: string | null
  ban_duration_hours?: number | null
  honesty_message_shown?: boolean
}

export const REPORT_REASONS = [
  'bullying',
  'hate_speech',
  'illegal_content',
  'scam',
  'spam',
  'harassment',
  'inappropriate_content',
  'other'
] as const

export type ReportReason = typeof REPORT_REASONS[number]

