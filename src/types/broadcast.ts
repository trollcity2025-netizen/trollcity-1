export type StreamStatus = 'pending' | 'live' | 'ended';
export type LayoutMode = 'grid' | 'battle' | 'spotlight';

export interface Stream {
  id: string;
  user_id: string;
  title: string;
  category: string;
  stream_kind?: 'regular' | 'trollmers';
  game_stream_key?: string | null;
  room_name?: string | null;
  camera_ready?: boolean;
  status: StreamStatus;
  is_battle: boolean;
  battle_id?: string;
  viewer_count?: number;
  current_viewers: number;
  box_count: number;
  layout_mode: LayoutMode;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  seat_price: number;
  are_seats_locked: boolean;
  has_rgb_effect: boolean;
  rgb_purchased?: boolean;
  active_theme_url?: string;
  hls_path?: string;
  hls_url?: string;
  // Mux integration fields (added during migration)
  mux_playback_id?: string | null;
  mux_stream_id?: string | null;
  mux_stream_key?: string | null;
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
  };
  user_profiles?: {
    username: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
    created_at?: string;
    rgb_username_expires_at?: string;
    glowing_username_color?: string;
  };
  vehicle_status?: any; // Avoiding circular dependency or complex type for now
}
