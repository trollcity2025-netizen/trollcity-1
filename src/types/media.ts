// Media City Types

export interface ArtistProfile {
  id: string;
  user_id: string;
  artist_name: string;
  bio?: string;
  profile_banner_url?: string;
  avatar_url?: string;
  verified: boolean;
  followers_count: number;
  total_plays: number;
  total_tips: number;
  coins_earned: number;
  label_id?: string;
  genre?: string;
  location?: string;
  website_url?: string;
  social_links: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecordLabel {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  owner_user_id: string;
  founders: string[];
  revenue_split_artist: number;
  revenue_split_label: number;
  artist_count: number;
  total_plays: number;
  total_tips: number;
  verified: boolean;
  featured: boolean;
  creation_cost_paid: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LabelMember {
  id: string;
  label_id: string;
  artist_id: string;
  user_id: string;
  signed_at: string;
  contract_terms: Record<string, any>;
  revenue_split_artist: number;
  is_active: boolean;
  artist?: ArtistProfile;
}

export interface Album {
  id: string;
  artist_id: string;
  user_id: string;
  title: string;
  description?: string;
  cover_url?: string;
  release_type: 'single' | 'ep' | 'album';
  genre?: string;
  release_date?: string;
  total_tracks: number;
  total_plays: number;
  total_tips: number;
  is_published: boolean;
  label_id?: string;
  featured: boolean;
  created_at: string;
  updated_at: string;
  artist?: ArtistProfile;
  label?: RecordLabel;
}

export interface Song {
  id: string;
  artist_id: string;
  user_id: string;
  album_id?: string;
  label_id?: string;
  title: string;
  description?: string;
  audio_url: string;
  cover_url?: string;
  duration?: number;
  genre?: string;
  bpm?: number;
  key_signature?: string;
  isrc_code?: string;
  track_number?: number;
  plays: number;
  unique_plays: number;
  tips_total: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_published: boolean;
  is_explicit: boolean;
  featured: boolean;
  allow_tips: boolean;
  allow_downloads: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  published_at?: string;
  artist?: ArtistProfile;
  album?: Album;
  label?: RecordLabel;
  is_liked?: boolean;
}

export interface SongTip {
  id: string;
  song_id: string;
  artist_id: string;
  tipper_user_id: string;
  amount: number;
  tip_type: 'standard' | 'super' | 'mega';
  message?: string;
  is_anonymous: boolean;
  artist_earnings: number;
  label_earnings: number;
  created_at: string;
  tipper?: {
    username?: string;
    avatar_url?: string;
  };
}

export interface SongPlay {
  id: string;
  song_id: string;
  user_id?: string;
  session_id?: string;
  play_duration?: number;
  completed: boolean;
  source?: string;
  created_at: string;
}

export interface SongComment {
  id: string;
  song_id: string;
  user_id: string;
  content: string;
  parent_id?: string;
  likes_count: number;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    username?: string;
    avatar_url?: string;
  };
  replies?: SongComment[];
}

export interface StudioProject {
  id: string;
  user_id: string;
  artist_id?: string;
  title: string;
  project_type: 'recording' | 'multitrack' | 'mastering';
  recording_mode?: 'voice_only' | 'voice_beat' | 'multitrack';
  status: 'draft' | 'processing' | 'completed' | 'archived';
  vocal_track_url?: string;
  beat_track_url?: string;
  beat_url?: string;
  mixed_track_url?: string;
  effects_applied: string[];
  bpm?: number;
  key_signature?: string;
  duration?: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ChartEntry {
  id: string;
  song_id: string;
  artist_id: string;
  chart_type: 'trending' | 'top_tipped' | 'new_releases' | 'local';
  position: number;
  previous_position?: number;
  plays_count: number;
  tips_count: number;
  period_start: string;
  period_end: string;
  created_at: string;
  song?: Song;
  artist?: ArtistProfile;
}

export interface ArtistFollower {
  id: string;
  artist_id: string;
  follower_user_id: string;
  created_at: string;
}

// Enums and constants
export const TIP_AMOUNTS = [
  { amount: 10, label: '🎁 10 coins', type: 'standard' as const },
  { amount: 50, label: '🔥 50 coins', type: 'standard' as const },
  { amount: 100, label: '👑 100 coins', type: 'super' as const },
  { amount: 500, label: '🚀 500 coins', type: 'mega' as const },
];

export const GENRES = [
  'Hip Hop',
  'R&B',
  'Pop',
  'Rock',
  'Electronic',
  'Jazz',
  'Classical',
  'Country',
  'Reggae',
  'Latin',
  'Afrobeat',
  'K-Pop',
  'Metal',
  'Folk',
  'Blues',
  'Soul',
  'Funk',
  'Disco',
  'House',
  'Techno',
  'Other'
];

export const RELEASE_TYPES = [
  { value: 'single', label: 'Single', description: 'One track release' },
  { value: 'ep', label: 'EP', description: '2-6 tracks' },
  { value: 'album', label: 'Album', description: '7+ tracks' },
];

export const LABEL_CREATION_COST = 10000;

// Audio player state
export interface AudioPlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  queue: Song[];
  queueIndex: number;
  isMuted: boolean;
  repeatMode: 'none' | 'one' | 'all';
  shuffleMode: boolean;
}

// Studio recorder types
export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  hasPermission: boolean | null;
  error: string | null;
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
}

export interface TrackLayer {
  id: string;
  name: string;
  type: 'vocal' | 'beat' | 'harmony' | 'effect';
  audioUrl: string;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  waveformData?: number[];
}

// Discovery feed types
export type DiscoveryFeedType = 'trending' | 'new_releases' | 'top_tipped' | 'local' | 'label_picks';

export interface DiscoveryFilters {
  genre?: string;
  timeframe?: 'day' | 'week' | 'month' | 'all';
  sortBy?: 'popular' | 'recent' | 'tipped';
}

// Upload state
export interface UploadState {
  file: File | null;
  previewUrl: string | null;
  uploadProgress: number;
  isUploading: boolean;
  error: string | null;
  coverImage: File | null;
  coverPreviewUrl: string | null;
}
