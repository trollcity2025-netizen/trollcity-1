// =============================================
// TROLL MATCH (TM) SYSTEM TYPES
// =============================================

// Available interests for users to select
export const TM_INTERESTS = [
  'Music (Rap)',
  'Music (R&B)',
  'Music (Pop)',
  'Music (Rock)',
  'Music (Country)',
  'Music (Electronic)',
  'Music (Other)',
  'Gaming',
  'Singing',
  'Movies',
  'Comedy',
  'Just Chatting',
  'Sports',
  'Content Creation',
  'Art & Design',
  'Cooking',
  'Travel',
  'Reading',
  'Fitness',
  'Technology',
  'Fashion',
  'Photography',
  'Dancing',
  'Cooking',
  'Nature',
  'Science',
  'History',
  'Politics',
  'Spirituality',
  'Pets',
] as const;

export type TMInterest = typeof TM_INTERESTS[number];

// Gender options for dating
export const TM_GENDERS = [
  'Male',
  'Female',
  'Non-binary',
  'Trans Male',
  'Trans Female',
  'Prefer not to say',
  'Custom',
] as const;

export type TMGender = typeof TM_GENDERS[number];

// Preference options for dating
export const TM_PREFERENCES = [
  'Male',
  'Female',
  'Non-binary',
  'Trans Male',
  'Trans Female',
  'Everyone',
] as const;

export type TMPreference = typeof TM_PREFERENCES[number];

// Extended user profile for TM
export interface TMProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  interests: TMInterest[];
  dating_enabled: boolean;
  gender: TMGender | null;
  preference: TMPreference[];
  message_price: number;
  is_online: boolean;
  last_active: string | null;
}

// Match user returned from TM matching
export interface TMMatch {
  user_id: string;
  username: string;
  avatar_url: string | null;
  interests: TMInterest[];
  shared_interests: TMInterest[];
  match_score: number;
  is_online: boolean;
  last_active: string | null;
  message_price?: number;
}

// Profile view for "Viewed Me" feature
export interface TMProfileView {
  viewer_id: string;
  username: string;
  avatar_url: string | null;
  viewed_at: string;
  is_online: boolean;
}

// TM Message for TCPS integration
export interface TMMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  price_paid: number;
  source: 'troll_match';
  created_at: string;
}

// Family invite for broadcaster-to-user invites
export interface TMFamilyInvite {
  id: string;
  inviter_id: string;
  invitee_id: string;
  family_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  // Joined fields
  inviter_username?: string;
  family_name?: string;
}

// TM Onboarding state
export interface TMOnboardingState {
  interests: TMInterest[];
  datingEnabled: boolean;
  gender: TMGender | null;
  preference: TMPreference[];
}

// TM Tab types
export type TMTab = 'all-users' | 'friends' | 'dating' | 'viewed-me';

// TM Message pricing info
export interface TMMessagePricing {
  userId: string;
  price: number;
  username: string;
}

// TCPS Composer params
export interface TMTCPSComposerParams {
  recipientId: string;
  source: 'troll_match';
  initialMessage?: string;
}

// Hook return types
export interface TMUseMatchesReturn {
  matches: TMMatch[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface TMUseViewedMeReturn {
  viewers: TMProfileView[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Family invite notification
export interface TMFamilyInviteNotification {
  id: string;
  inviterUsername: string;
  familyId: string;
  familyName: string;
  createdAt: string;
}

// All users for the user grid (shows all users with live status)
export interface TMAllUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  interests: TMInterest[];
  is_online: boolean;
  last_active: string | null;
  created_at: string;
  is_live: boolean;
  stream_id: string | null;
  current_viewers: number;
}
