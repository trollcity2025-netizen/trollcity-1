export type StreamStatus = 'pending' | 'live' | 'ended';
export type LayoutMode = 'grid' | 'battle' | 'spotlight';

export interface Stream {
  id: string;
  user_id: string;
  title: string;
  category: string;
  status: StreamStatus;
  is_battle: boolean;
  viewer_count: number;
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
  hls_url?: string;
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
  user?: {
    username: string;
    avatar_url: string;
  };
}
