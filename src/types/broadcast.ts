export type StreamStatus = 'pending' | 'live' | 'ended';
export type LayoutMode = 'grid' | 'battle' | 'spotlight';

export interface Stream {
  id: string;
  user_id: string;
  title: string;
  category: string;
  stream_kind?: 'regular' | 'trollmers';
  camera_ready?: boolean;
  status: StreamStatus;
  is_battle: boolean;
  battle_id?: string;
  viewer_count?: number;
  current_viewers: number;
  box_count: number;
  total_likes?: number;
  layout_mode: LayoutMode;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  seat_price: number;
  seat_prices?: number[]; // Per-box pricing array: [host_price, seat1_price, seat2_price, ...]
  are_seats_locked: boolean;
  has_rgb_effect: boolean;
  rgb_purchased?: boolean;
  active_theme_url?: string;
  // Deprecated: HLS-based streaming removed. Use LiveKit for all streaming.
  // These fields remain for backward compatibility but are no longer used.
  hls_path?: string;
  hls_url?: string;
  // Featured broadcast fields
  is_featured?: boolean;
  featured_at?: string | null;
  featured_by?: string | null;
  // Password protection fields
  is_protected?: boolean;
  password_hash?: string;
}

export interface StreamGuest {
  id: string;
  stream_id: string;
  user_id: string;
  status: 'invited' | 'accepted' | 'rejected' | 'joined' | 'left';
  type: 'guest' | 'cohost';
  created_at: string;
}

export interface Gift {
  id: string;
  name: string;
  cost: number;
  icon_url: string;
  animation_url?: string;
}

export interface StreamGift {
  id: string;
  stream_id: string;
  sender_id: string;
  recipient_id: string;
  gift_id: string;
  created_at: string;
  sender?: {
    username: string;
    avatar_url: string;
  };
  gift?: Gift;
}

export interface ChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  content: string;
  created_at: string;
  type?: 'chat' | 'system';
  user?: {
    username: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
  };
  user_profiles?: {
    username: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
    created_at?: string;
    rgb_username_expires_at?: string;
    glowing_username_color?: string;
    // Minor safety fields
    has_children?: boolean;
    minor_allowed_on_stream?: boolean;
    minor_violation_count?: number;
    minor_last_violation?: string;
  };
}

// Minor Safety System Types
export type ReportType = 'HARASSMENT' | 'SPAM' | 'INAPPROPRIATE_CONTENT' | 'MINOR_LEFT_UNSUPERVISED' | 'OTHER';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
export type ViolationType = 'MINOR_UNSUPERVISED_STREAM' | 'HARASSMENT' | 'SPAM' | 'INAPPROPRIATE_CONTENT' | 'TERMS_VIOLATION' | 'OTHER';
export type CaseStatus = 'pending' | 'under_review' | 'guilty' | 'not_guilty' | 'dismissed';

export interface StreamReport {
  id: string;
  reporter_user_id: string;
  reported_stream_id?: string;
  reported_user_id?: string;
  report_type: ReportType;
  description?: string;
  screenshot_url?: string;
  status: ReportStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  // Joined fields
  reporter_name?: string;
  reported_name?: string;
  stream_title?: string;
}

export interface ModerationCase {
  id: string;
  user_id: string;
  violation_type: ViolationType;
  evidence_url?: string;
  report_id?: string;
  case_status: CaseStatus;
  assigned_moderator_id?: string;
  resolution_notes?: string;
  penalty_issued?: string;
  created_at: string;
  resolved_at?: string;
  // Joined fields
  username?: string;
  moderator_name?: string;
}

export interface ModerationLog {
  id: string;
  user_id?: string;
  stream_id?: string;
  action_type: string;
  action_description?: string;
  performed_by?: string;
  metadata?: Record<string, any>;
  created_at: string;
}
