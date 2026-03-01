/**
 * Broadcast Category Configuration
 * 
 * This file defines the behavior, layouts, and features for each broadcast category.
 * All category-specific logic should be driven by this configuration.
 */

// Category types
export type BroadcastCategoryId = 
  | 'general' 
  | 'just_chatting' 
  | 'gaming' 
  | 'irl' 
  | 'debate' 
  | 'education' 
  | 'fitness' 
  | 'business' 
  | 'spiritual' 
  | 'trollmers'
  | 'election';

// Layout modes
export type LayoutMode = 'grid' | 'split' | 'classroom' | 'spotlight' | 'debate';

// Role labels per category
export type RoleLabel = 'Broadcaster' | 'Host' | 'Teacher' | 'Trainer' | 'Debater' | 'Challenger';

// Category configuration interface
export interface BroadcastCategoryConfig {
  id: BroadcastCategoryId;
  name: string;
  icon: string;
  description: string;
  
  // Layout settings
  layoutMode: LayoutMode;
  defaultBoxCount: number;
  maxBoxCount: number;
  allowGuestBoxes: boolean;
  allowAddBox: boolean;
  allowDeductBox: boolean;
  
  // Role settings
  hostRoleLabel: RoleLabel;
  
  // Camera settings
  allowFrontCamera: boolean;
  allowRearCamera: boolean;
  forceRearCamera: boolean;
  
  // Special features
  hasOBSIntegration: boolean;
  hasYouTubePlayer: boolean;
  maxYouTubePlayerBoxes: number; // Total boxes including YouTube player
  hasMatchingSystem: boolean;
  matchingTerminology: string; // e.g., "Battle", "Match", "Connect", "Network"
  requiresReligion: boolean;
  availableReligions?: string[];
  
  // Battle/matching settings
  supportsBattles: boolean;
  battleType: 'standard' | 'business' | 'spiritual' | 'none';
  filterByReligion?: boolean;
  
  // Category-specific restrictions
  isOneWayBroadcast: boolean; // No viewer-initiated actions
  requiresMinFollowers?: number;
  requiresCamera?: boolean;
  
  // UI visibility settings
  showCoinBalanceInChat: boolean; // Show coin balance in live chat header
}

// Available religions for Spiritual category
export const AVAILABLE_RELIGIONS = [
  'Christianity',
  'Catholicism',
  'Islam',
  'Judaism',
  'Hinduism',
  'Buddhism',
  'Sikhism',
  'Atheism',
  'Agnosticism',
  'Other'
];

// Category configurations
export const BROADCAST_CATEGORIES: Record<BroadcastCategoryId, BroadcastCategoryConfig> = {
  // 1. General Chat - Default broadcast layout
  general: {
    id: 'general',
    name: 'General Chat',
    icon: '💬',
    description: 'Default broadcast layout for casual conversations',
    layoutMode: 'grid',
    defaultBoxCount: 1,
    maxBoxCount: 9,
    allowGuestBoxes: true,
    allowAddBox: true,
    allowDeductBox: true,
    hostRoleLabel: 'Broadcaster',
    allowFrontCamera: true,
    allowRearCamera: true,
    forceRearCamera: false,
    hasOBSIntegration: false,
    hasYouTubePlayer: false,
    maxYouTubePlayerBoxes: 0,
    hasMatchingSystem: false,
    matchingTerminology: 'Battle',
    requiresReligion: false,
    supportsBattles: false,
    battleType: 'none',
    isOneWayBroadcast: false,
    showCoinBalanceInChat: false, // Live chat category - no coin balance
  },

  // 2. Just Chatting - Same as General Chat but with Add/Deduct Box controls
  just_chatting: {
    id: 'just_chatting',
    name: 'Just Chatting',
    icon: '☕',
    description: 'Casual conversations with friends',
    layoutMode: 'grid',
    defaultBoxCount: 1,
    maxBoxCount: 6,
    allowGuestBoxes: true,
    allowAddBox: true,
    allowDeductBox: true,
    hostRoleLabel: 'Broadcaster',
    allowFrontCamera: true,
    allowRearCamera: true,
    forceRearCamera: false,
    hasOBSIntegration: false,
    hasYouTubePlayer: false,
    maxYouTubePlayerBoxes: 0,
    hasMatchingSystem: false,
    matchingTerminology: 'Battle',
    requiresReligion: false,
    supportsBattles: false,
    battleType: 'none',
    isOneWayBroadcast: false,
    showCoinBalanceInChat: false, // Live chat category - no coin balance
  },

  // 3. Gaming - OBS streaming with RTMP
  gaming: {
    id: 'gaming',
    name: 'Gaming',
    icon: '🎮',
    description: 'Stream games via OBS with RTMP ingest',
    layoutMode: 'grid',
    defaultBoxCount: 1,
    maxBoxCount: 6,
    allowGuestBoxes: true,
    allowAddBox: true,
    allowDeductBox: true,
    hostRoleLabel: 'Broadcaster',
    allowFrontCamera: true,
    allowRearCamera: true,
    forceRearCamera: false,
    hasOBSIntegration: true,
    hasYouTubePlayer: false,
    maxYouTubePlayerBoxes: 0,
    hasMatchingSystem: false,
    matchingTerminology: 'Battle',
    requiresReligion: false,
    supportsBattles: false,
    battleType: 'none',
    isOneWayBroadcast: false,
    showCoinBalanceInChat: true, // Stream category - show coin balance
  },

  // 4. IRL / Lifestyle - Rear camera only
  irl: {
    id: 'irl',
    name: 'IRL / Lifestyle',
    icon: '📍',
    description: 'First-person streaming with rear camera',
    layoutMode: 'spotlight',
    defaultBoxCount: 1,
    maxBoxCount: 6,
    allowGuestBoxes: true,
    allowAddBox: true,
    allowDeductBox: true,
    hostRoleLabel: 'Broadcaster',
    allowFrontCamera: false, // Disabled for IRL
    allowRearCamera: true,
    forceRearCamera: true, // Force rear camera
    hasOBSIntegration: false,
    hasYouTubePlayer: false,
    maxYouTubePlayerBoxes: 0,
    hasMatchingSystem: false,
    matchingTerminology: 'Battle',
    requiresReligion: false,
    supportsBattles: false,
    battleType: 'none',
    isOneWayBroadcast: false,
    showCoinBalanceInChat: true, // Stream category - show coin balance
  },

  // 5. Debate & Discussion - Split screen, 2 boxes only
  debate: {
    id: 'debate',
    name: 'Debate & Discussion',
    icon: '⚖️',
    description: 'Split-screen debate with equal participants',
    layoutMode: 'debate',
    defaultBoxCount: 2,
    maxBoxCount: 2, // Strictly 2 boxes
    allowGuestBoxes: false, // No additional boxes
    allowAddBox: false,
    allowDeductBox: false,
    hostRoleLabel: 'Debater',
    allowFrontCamera: true,
    allowRearCamera: true,
    forceRearCamera: false,
    hasOBSIntegration: false,
    hasYouTubePlayer: false,
    maxYouTubePlayerBoxes: 0,
    hasMatchingSystem: false,
    matchingTerminology: 'Battle',
    requiresReligion: false,
    supportsBattles: false,
    battleType: 'none', // Debate is not a battle
    isOneWayBroadcast: false,
    showCoinBalanceInChat: false, // Live chat category - no coin balance
  },

  // 6. Education - Classroom layout
  education: {
    id: 'education',
    name: 'Education',
    icon: '📚',
    description: 'Classroom environment with Teacher and Students',
    layoutMode: 'classroom',
    defaultBoxCount: 1,
    maxBoxCount: 9,
    allowGuestBoxes: true,
    allowAddBox: true,
    allowDeductBox: true,
    hostRoleLabel: 'Teacher', // Host appears as Teacher
    allowFrontCamera: true,
    allowRearCamera: true,
    forceRearCamera: false,
    hasOBSIntegration: false,
    hasYouTubePlayer: false,
    maxYouTubePlayerBoxes: 0,
    hasMatchingSystem: false,
    matchingTerminology: 'Battle',
    requiresReligion: false,
    supportsBattles: false,
    battleType: 'none',
    isOneWayBroadcast: false,
    showCoinBalanceInChat: false, // Live chat category - no coin balance
  },

  // 7. Fitness & Sports - One-way broadcast
  fitness: {
    id: 'fitness',
    name: 'Fitness & Sports',
    icon: '💪',
    description: 'One-way broadcast with Trainer role',
    layoutMode: 'spotlight',
    defaultBoxCount: 1,
    maxBoxCount: 4,
    allowGuestBoxes: true, // Trainer can invite
    allowAddBox: false, // Only trainer can add
    allowDeductBox: false,
    hostRoleLabel: 'Trainer', // Role label changes
    allowFrontCamera: true,
    allowRearCamera: true,
    forceRearCamera: false,
    hasOBSIntegration: false,
    hasYouTubePlayer: false,
    maxYouTubePlayerBoxes: 0,
    hasMatchingSystem: false,
    matchingTerminology: 'Battle',
    requiresReligion: false,
    supportsBattles: false,
    battleType: 'none',
    isOneWayBroadcast: true, // No viewer-initiated actions
    showCoinBalanceInChat: true, // Stream category - show coin balance
  },

  // 8. Business & Finance - Matching system with business terminology
  business: {
    id: 'business',
    name: 'Business & Finance',
    icon: '💼',
    description: 'Networking and business matching',
    layoutMode: 'grid',
    defaultBoxCount: 1,
    maxBoxCount: 4,
    allowGuestBoxes: true,
    allowAddBox: true,
    allowDeductBox: true,
    hostRoleLabel: 'Broadcaster',
    allowFrontCamera: true,
    allowRearCamera: true,
    forceRearCamera: false,
    hasOBSIntegration: false,
    hasYouTubePlayer: false,
    maxYouTubePlayerBoxes: 0,
    hasMatchingSystem: true,
    matchingTerminology: 'Connect', // Business terminology
    requiresReligion: false,
    supportsBattles: false,
    battleType: 'none',
    isOneWayBroadcast: false,
    showCoinBalanceInChat: true, // Stream category - show coin balance
  },

  // 9. Spiritual / Church - Religion matching
  spiritual: {
    id: 'spiritual',
    name: 'Spiritual / Church',
    icon: '✝️',
    description: 'Faith-based streaming with religion matching',
    layoutMode: 'grid',
    defaultBoxCount: 1,
    maxBoxCount: 4,
    allowGuestBoxes: true,
    allowAddBox: true,
    allowDeductBox: true,
    hostRoleLabel: 'Broadcaster',
    allowFrontCamera: true,
    allowRearCamera: true,
    forceRearCamera: false,
    hasOBSIntegration: false,
    hasYouTubePlayer: false,
    maxYouTubePlayerBoxes: 0,
    hasMatchingSystem: true,
    matchingTerminology: 'Fellowship',
    requiresReligion: true,
    availableReligions: AVAILABLE_RELIGIONS,
    supportsBattles: false,
    battleType: 'none',
    filterByReligion: true, // Match only same religion
    isOneWayBroadcast: false,
    showCoinBalanceInChat: true, // Stream category - show coin balance
  },

  // 10. Trollmers - Head-to-head battles
  trollmers: {
    id: 'trollmers',
    name: '🏆 Trollmers Head-to-Head',
    icon: '🏆',
    description: 'Competitive head-to-head streaming battles',
    layoutMode: 'grid',
    defaultBoxCount: 2,
    maxBoxCount: 6,
    allowGuestBoxes: true,
    allowAddBox: true,
    allowDeductBox: true,
    hostRoleLabel: 'Challenger',
    allowFrontCamera: true,
    allowRearCamera: true,
    forceRearCamera: false,
    hasOBSIntegration: false,
    hasYouTubePlayer: false,
    maxYouTubePlayerBoxes: 0,
    hasMatchingSystem: true,
    matchingTerminology: 'Battle',
    requiresReligion: false,
    supportsBattles: true,
    battleType: 'standard',
    isOneWayBroadcast: false,
    requiresMinFollowers: 100,
    requiresCamera: true,
    showCoinBalanceInChat: true, // Stream category - show coin balance
  },

  // 11. President Elections - Special category for elections (admin, secretary, lead troll officer, troll officers only)
  election: {
    id: 'election',
    name: '🗳️ President Elections',
    icon: '🗳️',
    description: 'Live election debates and voting streams',
    layoutMode: 'split',
    defaultBoxCount: 1,
    maxBoxCount: 1,
    allowGuestBoxes: false,
    allowAddBox: false,
    allowDeductBox: false,
    hostRoleLabel: 'Host',
    allowFrontCamera: true,
    allowRearCamera: true,
    forceRearCamera: false,
    hasOBSIntegration: false,
    hasYouTubePlayer: false,
    maxYouTubePlayerBoxes: 0,
    hasMatchingSystem: false,
    matchingTerminology: 'Debate',
    requiresReligion: false,
    supportsBattles: false,
    battleType: 'none',
    isOneWayBroadcast: false,
    requiresMinFollowers: 0,
    requiresCamera: true,
    showCoinBalanceInChat: true,
  },
};

// Helper function to get category config
export function getCategoryConfig(categoryId: string): BroadcastCategoryConfig {
  return BROADCAST_CATEGORIES[categoryId as BroadcastCategoryId] || BROADCAST_CATEGORIES.general;
}

// Helper to check if category supports battles
export function supportsBattles(categoryId: string): boolean {
  const config = getCategoryConfig(categoryId);
  return config.supportsBattles && config.battleType !== 'none';
}

// Helper to get matching terminology
export function getMatchingTerminology(categoryId: string): string {
  const config = getCategoryConfig(categoryId);
  return config.matchingTerminology;
}

// Helper to check if category uses OBS
export function hasOBSIntegration(categoryId: string): boolean {
  const config = getCategoryConfig(categoryId);
  return config.hasOBSIntegration;
}

// Helper to check if category uses YouTube player
export function hasYouTubePlayer(categoryId: string): boolean {
  const config = getCategoryConfig(categoryId);
  return config.hasYouTubePlayer;
}

// Helper to check if category requires religion selection
export function requiresReligion(categoryId: string): boolean {
  const config = getCategoryConfig(categoryId);
  return config.requiresReligion;
}

// Helper to check if category forces rear camera
export function forceRearCamera(categoryId: string): boolean {
  const config = getCategoryConfig(categoryId);
  return config.forceRearCamera;
}

// Helper to get host role label
export function getHostRoleLabel(categoryId: string): string {
  const config = getCategoryConfig(categoryId);
  return config.hostRoleLabel;
}

// Helper to get max box count
export function getMaxBoxCount(categoryId: string): number {
  const config = getCategoryConfig(categoryId);
  return config.maxBoxCount;
}

// Helper to check if category allows front camera
export function allowFrontCamera(categoryId: string): boolean {
  const config = getCategoryConfig(categoryId);
  return config.allowFrontCamera;
}

// Helper to check if category requires camera
export function requiresCamera(categoryId: string): boolean {
  const config = getCategoryConfig(categoryId);
  return !!config.requiresCamera;
}

// Helper to check if category shows coin balance in chat
export function showCoinBalanceInChat(categoryId: string): boolean {
  const config = getCategoryConfig(categoryId);
  return config.showCoinBalanceInChat;
}

// Get all categories as array for UI
export function getAllCategories(): BroadcastCategoryConfig[] {
  return Object.values(BROADCAST_CATEGORIES);
}
