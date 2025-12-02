// TypeScript types for Troll City Wall

export type WallPostType =
  | 'text'
  | 'stream_announce'
  | 'battle_result'
  | 'family_announce'
  | 'badge_earned'
  | 'system'

export interface WallPost {
  id: string
  user_id: string
  username?: string
  avatar_url?: string
  is_admin?: boolean
  is_troll_officer?: boolean
  is_og_user?: boolean
  post_type: WallPostType
  content: string
  metadata: Record<string, any>
  likes: number
  created_at: string
  user_liked?: boolean // Added client-side
}

export interface WallPostMetadata {
  stream_id?: string
  stream_title?: string
  battle_id?: string
  host_id?: string
  challenger_id?: string
  winner_id?: string
  host_total_coins?: number
  challenger_total_coins?: number
  family_id?: string
  family_name?: string
  badge_id?: string
  badge_name?: string
  earned_at?: string
  [key: string]: any
}

export interface CreateWallPostPayload {
  post_type: WallPostType
  content: string
  metadata?: WallPostMetadata
}

