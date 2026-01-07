import { Trophy, Star, Shield, Zap, Gift, Crown, Radio, MessageCircle, Music, Palette } from 'lucide-react'

// --- XP Rates ---
export const XP_RATES = {
  DAILY_LOGIN: 25,
  WATCH_STREAM_10_MIN: 5,
  CHAT_MESSAGE: 1, // Limit 50/day
  SEND_GIFT_BASE: 10, // Plus value multiplier
  STREAM_10_MIN: 20,
  NEW_FOLLOWER: 50,
  WIN_EVENT: 200,
  
  // Caps
  DAILY_CHAT_XP_CAP: 50, // 50 messages
  DAILY_WATCH_XP_CAP: 120 // ~4 hours
}

// --- Level Calculator ---
// Simple curve: Level * 100 * Multiplier? Or just linear scaling?
// "Levels 1-50". Let's make it progressively harder.
// Level 1 -> 2: 100 XP
// Level 2 -> 3: 150 XP
// Formula: Base 100 * (1.1 ^ (Level - 1))
export const calculateNextLevelXp = (level: number) => {
  if (level >= 50) return 10000 // Cap or prestige logic
  return Math.floor(100 * Math.pow(1.1, level - 1))
}

// --- Perks ---
export interface Perk {
  id: string
  label: string
  description: string
  tier: 'citizen' | 'influencer' | 'legend' | 'prestige'
  levelRequired: number
  icon: any
  costTokens?: number // If 0/undefined, auto-unlocked at level
}

export const PERKS: Perk[] = [
  // Citizen Tier (1-10)
  { id: 'citizen_badge', label: 'Citizen Badge', description: 'Show off your status', tier: 'citizen', levelRequired: 1, icon: Shield },
  { id: 'profile_border_basic', label: 'Basic Profile Border', description: 'Decorate your avatar', tier: 'citizen', levelRequired: 2, icon: Shield },
  { id: 'coin_boost_2', label: '+2% Coin Boost', description: 'Earn more coins passively', tier: 'citizen', levelRequired: 3, icon: Zap },
  { id: 'spotlight_ticket', label: 'Spotlight Ticket', description: '15 min spotlight', tier: 'citizen', levelRequired: 4, icon: Radio },
  { id: 'daily_reward_10', label: '+10% Daily Reward', description: 'Login bonus increased', tier: 'citizen', levelRequired: 5, icon: Gift },
  { id: 'emojis_pack_1', label: 'Emoji Pack #1', description: 'New chat emojis', tier: 'citizen', levelRequired: 6, icon: MessageCircle },
  { id: 'xp_boost_5', label: '+5% XP Boost', description: 'Level up faster', tier: 'citizen', levelRequired: 7, icon: Star },
  { id: 'boost_token', label: 'Boost Token', description: 'Boost a stream', tier: 'citizen', levelRequired: 8, icon: Zap },
  { id: 'create_family', label: 'Create Family', description: 'Start your own Troll Family', tier: 'citizen', levelRequired: 9, icon: Crown },
  { id: 'rising_citizen_badge', label: 'Rising Citizen Badge', description: 'You are going places', tier: 'citizen', levelRequired: 10, icon: Shield },

  // Influencer Tier (11-25)
  { id: 'gift_xp_2', label: '+2% Gift XP', description: 'More XP from gifting', tier: 'influencer', levelRequired: 11, icon: Gift },
  { id: 'vip_chat_color', label: 'VIP Chat Color', description: 'Stand out in chat', tier: 'influencer', levelRequired: 12, icon: Palette },
  { id: 'mini_profile_glow', label: 'Mini Profile Glow', description: 'Shiny profile card', tier: 'influencer', levelRequired: 14, icon: Star },
  { id: 'streamer_intro', label: 'Streamer Intro Sound', description: 'Play sound when starting stream', tier: 'influencer', levelRequired: 16, icon: Music },
  { id: 'voice_replies', label: 'Voice Replies', description: 'Reply with voice messages', tier: 'influencer', levelRequired: 19, icon: MessageCircle },
  { id: 'influencer_badge', label: 'Influencer Badge', description: 'A true local celebrity', tier: 'influencer', levelRequired: 20, icon: Shield },
  
  // Legend Tier (26-50)
  { id: 'legend_chat_badge', label: 'Legend Chat Badge', description: 'Respect the legend', tier: 'legend', levelRequired: 27, icon: Shield },
  { id: 'shimmer_name', label: 'Shimmer Name Effect', description: 'Your name sparkles', tier: 'legend', levelRequired: 29, icon: Star },
  { id: 'legend_badge', label: 'Legend Badge', description: 'Top tier status', tier: 'legend', levelRequired: 30, icon: Crown },
  { id: 'custom_emote', label: 'Custom Emote Slot', description: 'Upload your own emote', tier: 'legend', levelRequired: 32, icon: MessageCircle },
  { id: 'cyber_city_theme', label: 'Theme: Cyber City', description: 'Exclusive app theme', tier: 'legend', levelRequired: 37, icon: Palette },
  { id: 'voice_room', label: 'Voice Room Access', description: 'Create voice-only rooms', tier: 'legend', levelRequired: 46, icon: Radio },
  { id: 'founders_wall', label: 'Founders Wall', description: 'Name listed on wall', tier: 'legend', levelRequired: 49, icon: Crown },
]

// --- Rewards ---
export const getLevelUpReward = (level: number) => {
  // Base reward
  const rewards = {
    coins: 0,
    items: [] as string[]
  }

  // Coin rewards logic
  if (level <= 10) rewards.coins = 50
  else if (level <= 25) rewards.coins = 100
  else if (level <= 50) rewards.coins = 250
  else rewards.coins = 500

  // Milestone bonuses
  if (level === 10) rewards.coins += 500
  if (level === 20) rewards.coins += 1000
  if (level === 30) rewards.coins += 2500
  if (level === 50) rewards.coins += 10000

  return rewards
}
