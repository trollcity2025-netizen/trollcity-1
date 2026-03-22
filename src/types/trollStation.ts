export interface TrollStation {
  id: string;
  name: string;
  description: string | null;
  is_online: boolean;
  current_mode: 'auto' | 'live';
  current_dj_id: string | null;
  current_song_id: string | null;
  current_track_start: string | null;
  volume: number;
  voice_enabled: boolean;
  music_volume: number;
  livekit_room_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrollStationSong {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string;
  cover_url: string | null;
  duration: number | null;
  category: string | null;
  tags: string[] | null;
  submitted_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  rejection_reason: string | null;
  plays_count: number;
  likes_count: number;
  created_at: string;
  updated_at: string;
  submitter?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface TrollStationQueue {
  id: string;
  song_id: string;
  position: number;
  added_by: string | null;
  added_at: string;
  played_at: string | null;
  song?: TrollStationSong;
}

export interface TrollStationSession {
  id: string;
  dj_id: string;
  title: string | null;
  description: string | null;
  scheduled_start: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: 'scheduled' | 'live' | 'ended';
  max_cohosts: number;
  livekit_room_name: string | null;
  is_music_ducking: boolean;
  created_at: string;
  dj?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  cohosts?: TrollStationCohost[];
}

export interface TrollStationHost {
  id: string;
  user_id: string;
  role: 'admin' | 'manager' | 'dj';
  can_invite: boolean;
  can_moderate: boolean;
  assigned_by: string | null;
  created_at: string;
  user?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface TrollStationCohost {
  id: string;
  session_id: string;
  user_id: string;
  role: 'guest' | 'cohost';
  can_control_queue: boolean;
  is_speaking: boolean;
  joined_at: string;
  removed_at: string | null;
  user?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface TrollStationInvitation {
  id: string;
  session_id: string;
  invited_by: string;
  invited_user_id: string;
  role: 'guest' | 'cohost';
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
  inviter?: {
    id: string;
    username: string;
  };
  invited_user?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface TrollStationChat {
  id: string;
  session_id: string | null;
  user_id: string;
  message: string;
  is_system: boolean;
  created_at: string;
  user?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export type StationPermission = 
  | 'station:admin'
  | 'station:manage'
  | 'station:dj'
  | 'station:queue'
  | 'station:invite'
  | 'station:moderate'
  | 'station:submit'
  | 'station:chat';

export interface StationPermissions {
  isStationAdmin: boolean;
  isStationManager: boolean;
  isDJ: boolean;
  canControlQueue: boolean;
  canInvite: boolean;
  canModerate: boolean;
  canSubmit: boolean;
  canChat: boolean;
}

export type StationTab = 'nowPlaying' | 'queue' | 'hosts' | 'chat' | 'submit';

export interface AudioState {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
}

export interface VoiceState {
  isSpeaking: boolean;
  isConnected: boolean;
  audienceCount: number;
  speakers: {
    id: string;
    username: string;
    avatar_url: string | null;
    isSpeaking: boolean;
  }[];
}
