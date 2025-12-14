import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import {
  Gift,
  Sparkles,
  Sticker,
  Zap,
  ShoppingBag,
  Loader2,
  Crown,
  MessageCircle,
  Wand2,
  Users,
  Gavel,
  Star,
  Flame,
  Skull,
  Coins,
  ArrowRight,
  CheckCircle,
} from 'lucide-react'

interface TrollmondItem {
  id: string
  name: string
  icon: string
  value: number
  description: string
  category: string
}

// Curated fallback catalog so the shop is populated even when the DB table is empty.
const defaultTrollmondItems: TrollmondItem[] = [
  // Status & Prestige
  { id: 'status-neon-glow-purple', name: 'Neon Username Glow · Purple', icon: '💜', value: 750, description: 'Clean neon outline on your name.', category: 'Status & Prestige' },
  { id: 'status-neon-glow-gold', name: 'Neon Username Glow · Gold', icon: '🟡', value: 900, description: 'Gold aura that pops in every list.', category: 'Status & Prestige' },
  { id: 'status-neon-glow-crimson', name: 'Neon Username Glow · Blood Red', icon: '🟥', value: 950, description: 'Aggressive crimson glow with heat shimmer.', category: 'Status & Prestige' },
  { id: 'status-animated-outline', name: 'Animated Username Outline', icon: '⚡', value: 1100, description: 'Pulse / fire / lightning edge on your handle.', category: 'Status & Prestige' },
  { id: 'status-crown-mythic', name: 'Mythic Crown Icon', icon: '👑', value: 1250, description: 'Bronze → Diamond → Mythic progression crown.', category: 'Status & Prestige' },
  { id: 'status-verified-custom', name: 'Custom Verified Badge', icon: '🛡️', value: 1300, description: 'Verified-style badge with unique shape.', category: 'Status & Prestige' },
  { id: 'status-roman-level', name: 'Roman Numeral Level Badge', icon: 'Ⅹ', value: 800, description: 'Display I, V, X, L, C to flex your grind.', category: 'Status & Prestige' },
  { id: 'status-founder-aura', name: 'Founder Aura', icon: '✨', value: 1400, description: 'Soft halo behind avatar for early legends.', category: 'Status & Prestige' },
  { id: 'status-og-troll', name: 'OG Troll Badge', icon: '🏅', value: 1500, description: 'Limited seasonal OG tag with glow.', category: 'Status & Prestige' },
  { id: 'status-family-crest', name: 'Family Crest Overlay', icon: '🛡️', value: 1000, description: 'Overlay your family crest behind avatar.', category: 'Status & Prestige' },
  { id: 'status-animated-bio', name: 'Animated Bio Header', icon: '📜', value: 700, description: 'Animated topper for your profile bio.', category: 'Status & Prestige' },
  { id: 'status-prestige-nameplate', name: 'Prestige Nameplate', icon: '🎖️', value: 1200, description: 'Custom nameplate beneath username.', category: 'Status & Prestige' },

  // Avatar & Visual Flex
  { id: 'avatar-animated-frame-cyber', name: 'Animated Frame · Cyber', icon: '🟦', value: 650, description: 'High-energy neon circuit frame.', category: 'Avatar & Visual Flex' },
  { id: 'avatar-animated-frame-flame', name: 'Animated Frame · Flame', icon: '🔥', value: 700, description: 'Embers and sparks wrap your avatar.', category: 'Avatar & Visual Flex' },
  { id: 'avatar-animated-frame-void', name: 'Animated Frame · Void', icon: '🌑', value: 700, description: 'Void ripple effect around avatar.', category: 'Avatar & Visual Flex' },
  { id: 'avatar-3d-rings', name: '3D Avatar Border Rings', icon: '🪐', value: 900, description: 'Spinning rings for extra depth.', category: 'Avatar & Visual Flex' },
  { id: 'avatar-seasonal-skin', name: 'Seasonal Skin · Inferno', icon: '⚙️', value: 800, description: 'Seasonal avatar shell (Inferno / Neon Noir).', category: 'Avatar & Visual Flex' },
  { id: 'avatar-hologram', name: 'Hologram Avatar Effect', icon: '🔮', value: 950, description: 'Holographic shimmer with scan-lines.', category: 'Avatar & Visual Flex' },
  { id: 'avatar-shadow', name: 'Shadow Silhouette Avatar', icon: '🌘', value: 600, description: 'Shadowed silhouette with edge glow.', category: 'Avatar & Visual Flex' },
  { id: 'avatar-pixel-mode', name: 'Pixel Art Avatar Mode', icon: '🧊', value: 550, description: 'Toggle pixel-styled avatar render.', category: 'Avatar & Visual Flex' },
  { id: 'avatar-animated-eyes', name: 'Animated Eyes / Glow', icon: '👁️', value: 800, description: 'Subtle eye glows and blinks.', category: 'Avatar & Visual Flex' },
  { id: 'avatar-masks', name: 'Mask Overlay Pack', icon: '🎭', value: 750, description: 'Jester, Skull, Crowned Troll masks.', category: 'Avatar & Visual Flex' },
  { id: 'avatar-mythic-bg', name: 'Mythic Backgrounds Pack', icon: '🌌', value: 950, description: 'Galaxy, Throne Room, Void backdrops.', category: 'Avatar & Visual Flex' },

  // Chat Dominance
  { id: 'chat-animated-text', name: 'Animated Chat Text Effects', icon: '💬', value: 650, description: 'Animated text styling for limited time.', category: 'Chat Dominance' },
  { id: 'chat-rainbow-mode', name: 'Rainbow Chat Mode', icon: '🌈', value: 600, description: 'Timed rainbow gradient on your messages.', category: 'Chat Dominance' },
  { id: 'chat-metallic-font', name: 'Metallic Chat Font', icon: '🪙', value: 700, description: 'Chromed letter styling.', category: 'Chat Dominance' },
  { id: 'chat-emoji-burst', name: 'Emoji Burst Messages', icon: '💥', value: 550, description: 'Burst of emojis on send.', category: 'Chat Dominance' },
  { id: 'chat-custom-emote-slot', name: 'Custom Emote Slots', icon: '😀', value: 500, description: 'Add custom emotes to your kit.', category: 'Chat Dominance' },
  { id: 'chat-emote-pack', name: 'Emote Pack · Troll Crown', icon: '👑', value: 700, description: 'Laugh / Rage / Crown emote set.', category: 'Chat Dominance' },
  { id: 'chat-slowmode-bypass', name: 'Slow-Mode Bypass (short)', icon: '⏩', value: 800, description: 'Short-duration slow-mode skip.', category: 'Chat Dominance' },
  { id: 'chat-pinned-token', name: 'Pinned Message Token', icon: '📌', value: 900, description: 'Pin one message during a stream.', category: 'Chat Dominance' },
  { id: 'chat-auto-highlight', name: 'Auto-Highlight Messages', icon: '🔆', value: 650, description: 'Auto-highlight to stand out.', category: 'Chat Dominance' },
  { id: 'chat-whisper-color', name: 'Whisper Color Customizer', icon: '🗨️', value: 600, description: 'Change DM/whisper accent color.', category: 'Chat Dominance' },

  // Stream Visibility
  { id: 'stream-entrance-animation', name: 'Entrance Animation Pack', icon: '🚪', value: 900, description: 'Smoke, lightning, portal entrances.', category: 'Stream Visibility' },
  { id: 'stream-join-sound', name: 'Join Sound Effect', icon: '🎶', value: 650, description: 'Custom chime when you enter.', category: 'Stream Visibility' },
  { id: 'stream-profile-pop', name: 'Profile Pop-in Animation', icon: '📸', value: 750, description: 'Animated pop when you chat.', category: 'Stream Visibility' },
  { id: 'stream-spotlight-ring', name: 'Temporary Spotlight Ring', icon: '⭕', value: 800, description: 'Temporary spotlight while chatting.', category: 'Stream Visibility' },
  { id: 'stream-chat-glow', name: 'Chat Name Glow During Stream', icon: '🌟', value: 700, description: 'Live-only glow for visibility.', category: 'Stream Visibility' },
  { id: 'stream-onscreen-icon', name: 'On-Screen Icon While Chatting', icon: '🛰️', value: 650, description: 'Small icon appears when you speak.', category: 'Stream Visibility' },
  { id: 'stream-viewer-title', name: 'Viewer Title Banner', icon: '🏷️', value: 800, description: '“Elite Viewer” style banner.', category: 'Stream Visibility' },
  { id: 'stream-applause', name: 'Troll Applause Effect', icon: '👏', value: 600, description: 'Audience clap animation trigger.', category: 'Stream Visibility' },
  { id: 'stream-confetti', name: 'Confetti Reaction Button', icon: '🎊', value: 650, description: 'Confetti burst on demand.', category: 'Stream Visibility' },
  { id: 'stream-emoji-rain', name: 'Emoji Rain Trigger', icon: '🌧️', value: 650, description: 'Limited emoji rain drop.', category: 'Stream Visibility' },

  // Family & Social Flex
  { id: 'family-banner', name: 'Family Banner Designs', icon: '🛡️', value: 800, description: 'Unique banners for your family profile.', category: 'Family & Social Flex' },
  { id: 'family-chat-theme', name: 'Family Chat Color Theme', icon: '💠', value: 700, description: 'Custom palette for family chat.', category: 'Family & Social Flex' },
  { id: 'family-xp-boost', name: 'Family XP Boost Badge', icon: '📈', value: 750, description: 'Cosmetic XP badge flex.', category: 'Family & Social Flex' },
  { id: 'family-entrance', name: 'Family Entrance Effects', icon: '🚪', value: 850, description: 'Entrance visuals tied to family.', category: 'Family & Social Flex' },
  { id: 'family-leader-title', name: 'Family Leader Title Styles', icon: '🥇', value: 900, description: 'Leader-specific title looks.', category: 'Family & Social Flex' },
  { id: 'family-motto', name: 'Family Motto Display', icon: '📝', value: 600, description: 'Showcase motto under crest.', category: 'Family & Social Flex' },
  { id: 'family-frame', name: 'Family Profile Frame', icon: '🖼️', value: 800, description: 'Frame that carries family colors.', category: 'Family & Social Flex' },
  { id: 'family-icon-pack', name: 'Family Icon Set', icon: '🎯', value: 700, description: 'Custom icon set for members.', category: 'Family & Social Flex' },
  { id: 'family-chat-emotes', name: 'Family Chat Emotes', icon: '😀', value: 650, description: 'Family-branded emote pack.', category: 'Family & Social Flex' },
  { id: 'family-aura', name: 'Family Aura Overlay', icon: '🌀', value: 850, description: 'Aura overlay when with family.', category: 'Family & Social Flex' },

  // Court & Authority
  { id: 'court-title', name: 'Courtroom Title Badge', icon: '⚖️', value: 900, description: 'Official badge for court mode.', category: 'Court & Authority' },
  { id: 'court-gavel', name: 'Gavel Animation', icon: '🔨', value: 700, description: 'Visual gavel slam animation.', category: 'Court & Authority' },
  { id: 'court-summon', name: 'Court Summon Animation', icon: '📜', value: 800, description: 'Summon scroll visual.', category: 'Court & Authority' },
  { id: 'court-verdict', name: 'Verdict Stamp Effect', icon: '🧾', value: 850, description: 'Guilty/Not Guilty stamp overlay.', category: 'Court & Authority' },
  { id: 'court-on-trial', name: '“On Trial” Overlay', icon: '🚨', value: 750, description: 'Red overlay frame for court scenes.', category: 'Court & Authority' },
  { id: 'court-evidence', name: 'Evidence Spotlight', icon: '🔦', value: 750, description: 'Spotlight animation on evidence.', category: 'Court & Authority' },
  { id: 'court-judge-bg', name: 'Judge Throne Background', icon: '👑', value: 950, description: 'Heavy throne room backdrop.', category: 'Court & Authority' },
  { id: 'court-entrance', name: 'Courtroom Entrance Effect', icon: '🚪', value: 800, description: 'Formal entrance visual.', category: 'Court & Authority' },
  { id: 'court-scroll-style', name: 'Legal Scroll Message Style', icon: '📜', value: 700, description: 'Court-styled chat bubble.', category: 'Court & Authority' },
  { id: 'court-role-icons', name: 'Court Role Icons Pack', icon: '🛡️', value: 650, description: 'Role icons for Judge/Defender/Accused.', category: 'Court & Authority' },

  // Gifts (Viewer → Creator flex)
  { id: 'gift-neon-rose', name: 'Neon Rose', icon: '🌹', value: 500, description: 'Neon rose with sender callout.', category: 'Prestige Gifts' },
  { id: 'gift-golden-goblet', name: 'Golden Goblet', icon: '🍷', value: 650, description: 'Gold goblet pour animation.', category: 'Prestige Gifts' },
  { id: 'gift-throne-drop', name: 'Throne Drop', icon: '🪑', value: 900, description: 'Throne descends from above.', category: 'Prestige Gifts' },
  { id: 'gift-dragon-scroll', name: 'Dragon Scroll', icon: '🐉', value: 850, description: 'Scroll unroll + dragon flare.', category: 'Prestige Gifts' },
  { id: 'gift-crown-explosion', name: 'Crown Explosion', icon: '💥', value: 1000, description: 'Crowns explode into stardust.', category: 'Prestige Gifts' },
  { id: 'gift-mythic-sigil', name: 'Mythic Sigil', icon: '🔱', value: 950, description: 'Mythic seal with glyphs.', category: 'Prestige Gifts' },
  { id: 'gift-eternal-flame', name: 'Eternal Flame', icon: '🔥', value: 1100, description: 'Persistent flame around sender tag.', category: 'Prestige Gifts' },
  { id: 'gift-shadow-crown', name: 'Shadow Crown', icon: '🕶️', value: 900, description: 'Shadow crown folds over avatar.', category: 'Prestige Gifts' },
  { id: 'gift-galaxy-crown', name: 'Galaxy Crown', icon: '🪐', value: 950, description: 'Galaxy swirl crown animation.', category: 'Prestige Gifts' },
  { id: 'gift-troll-totem', name: 'Troll Totem', icon: '🗿', value: 800, description: 'Totem rise + drums.', category: 'Prestige Gifts' },
  { id: 'gift-royal-banner', name: 'Royal Banner', icon: '🚩', value: 700, description: 'Banner drop with name plate.', category: 'Prestige Gifts' },
  { id: 'gift-neon-halo', name: 'Neon Halo', icon: '🕊️', value: 750, description: 'Neon halo pulse over avatar.', category: 'Prestige Gifts' },
  { id: 'gift-diamond-laugh', name: 'Diamond Laugh', icon: '💎', value: 850, description: 'Diamond laugh burst + audio.', category: 'Prestige Gifts' },
  { id: 'gift-cosmic-eye', name: 'Cosmic Eye', icon: '👁️', value: 800, description: 'Cosmic eye opens on screen.', category: 'Prestige Gifts' },
  { id: 'gift-inferno-crest', name: 'Inferno Crest', icon: '🔥', value: 900, description: 'Crest ignites around streamer.', category: 'Prestige Gifts' },

  // Achievement & Legacy
  { id: 'ach-stream-hours', name: 'Stream Hours Milestone Badge', icon: '⏱️', value: 700, description: 'Badge tied to hours streamed.', category: 'Achievement & Legacy' },
  { id: 'ach-viewer-loyalty', name: 'Viewer Loyalty Medal', icon: '🎖️', value: 700, description: 'Medal for long-term viewers.', category: 'Achievement & Legacy' },
  { id: 'ach-gift-rank', name: 'Gift Giver Rank Icon', icon: '🎁', value: 750, description: 'Ranks based on gifting.', category: 'Achievement & Legacy' },
  { id: 'ach-court-attendance', name: 'Court Attendance Badge', icon: '📅', value: 650, description: 'Attendance tracker badge.', category: 'Achievement & Legacy' },
  { id: 'ach-family-veteran', name: 'Family War Veteran Badge', icon: '⚔️', value: 800, description: 'Shows family war participation.', category: 'Achievement & Legacy' },
  { id: 'ach-season-champion', name: 'Season Champion Emblem', icon: '🏆', value: 900, description: 'Seasonal champion emblem.', category: 'Achievement & Legacy' },
  { id: 'ach-history-scroll', name: 'Troll History Scroll', icon: '📜', value: 700, description: 'Profile stat scroll of deeds.', category: 'Achievement & Legacy' },
  { id: 'ach-legacy-timestamp', name: 'Legacy Timestamp Marker', icon: '⏳', value: 750, description: 'Stamps your legacy moments.', category: 'Achievement & Legacy' },
  { id: 'ach-seen-it-all', name: '“Seen It All” Badge', icon: '🧠', value: 850, description: 'Badge for OG survivors.', category: 'Achievement & Legacy' },
  { id: 'ach-hall-of-trolls', name: 'Hall of Trolls Plaque', icon: '🪦', value: 1100, description: 'Plaque slot in Hall of Trolls.', category: 'Achievement & Legacy' },

  // Fun / Weird / Troll
  { id: 'fun-laugh-sfx', name: 'Troll Laugh Sound Button', icon: '😂', value: 500, description: 'Play a signature troll laugh.', category: 'Fun & Troll' },
  { id: 'fun-screen-shake', name: 'Screen Shake Reaction', icon: '🌪️', value: 650, description: 'Shake the viewport briefly.', category: 'Fun & Troll' },
  { id: 'fun-invert-chat', name: 'Invert Chat Colors', icon: '🔄', value: 550, description: '10s inverted chat chaos.', category: 'Fun & Troll' },
  { id: 'fun-emote-storm', name: 'Random Emote Storm', icon: '⛈️', value: 650, description: 'Spray random emotes everywhere.', category: 'Fun & Troll' },
  { id: 'fun-troll-horn', name: 'Troll Horn', icon: '📯', value: 500, description: 'Short horn blast on cue.', category: 'Fun & Troll' },
  { id: 'fun-fake-crown', name: 'Fake Crown (breakable)', icon: '🧢', value: 400, description: 'Crown that cracks after flex.', category: 'Fun & Troll' },
  { id: 'fun-banana-peel', name: 'Banana Peel Entrance', icon: '🍌', value: 450, description: 'Slip-in animation entrance.', category: 'Fun & Troll' },
  { id: 'fun-confusion-cloud', name: 'Confusion Cloud Effect', icon: '☁️', value: 500, description: 'Confusion mist around avatar.', category: 'Fun & Troll' },
  { id: 'fun-trollface-overlay', name: 'Trollface Overlay', icon: '😈', value: 600, description: 'Trollface pops over avatar.', category: 'Fun & Troll' },
  { id: 'fun-pixel-explosion', name: 'Pixel Explosion', icon: '💥', value: 550, description: '8-bit explosion reaction.', category: 'Fun & Troll' },

  // Ultra Rare / Long Grind
  { id: 'ultra-mythic-crown-aura', name: 'Mythic Crown Aura', icon: '👑', value: 2500, description: 'Constant mythic aura crown.', category: 'Ultra Rare' },
  { id: 'ultra-eternal-flame-border', name: 'Eternal Flame Border', icon: '🔥', value: 2300, description: 'Flame border that never dies.', category: 'Ultra Rare' },
  { id: 'ultra-galaxy-throne', name: 'Galaxy Throne Background', icon: '🪐', value: 2400, description: 'Permanent galaxy throne scene.', category: 'Ultra Rare' },
  { id: 'ultra-legend-title', name: 'Animated Title: Legend of Troll City', icon: '🏰', value: 2600, description: 'Animated “Legend of Troll City” title.', category: 'Ultra Rare' },
  { id: 'ultra-golden-family-crest', name: 'Golden Family Crest', icon: '🛡️', value: 2200, description: 'Golden crest reserved for elite families.', category: 'Ultra Rare' },
  { id: 'ultra-profile-music', name: 'Custom Profile Music', icon: '🎵', value: 2100, description: 'Loop a custom track on profile.', category: 'Ultra Rare' },
  { id: 'ultra-profile-spotlight', name: 'Profile Spotlight Slot', icon: '🔦', value: 2000, description: 'Spotlight animation on profile load.', category: 'Ultra Rare' },
  { id: 'ultra-permanent-chat', name: 'Permanent Chat Effect', icon: '🗯️', value: 2300, description: 'Locked-in signature chat effect.', category: 'Ultra Rare' },
  { id: 'ultra-unique-color', name: 'Unique Color (Locked)', icon: '🎨', value: 2500, description: 'One-of-a-kind color assignment.', category: 'Ultra Rare' },
  { id: 'ultra-hall-of-fame', name: 'Hall of Fame Entry', icon: '⭐', value: 3000, description: 'Permanent Hall of Fame placement.', category: 'Ultra Rare' },
]

export default function TrollmondsStore() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [items, setItems] = useState<TrollmondItem[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertAmount, setConvertAmount] = useState(100)
  const [converting, setConverting] = useState(false)

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('gift_items')
        .select('*')
        .eq('currency', 'trollmonds')
        .order('value', { ascending: true })
      
      if (error) throw error
      const dbItems = data || []
      const merged = [...dbItems]
      // Add curated defaults if not present in DB
      defaultTrollmondItems.forEach(item => {
        if (!merged.find(existing => existing.id === item.id)) {
          merged.push(item)
        }
      })
      setItems(merged)
    } catch (err) {
      console.error('Error loading items:', err)
    } finally {
      setLoading(false)
    }
  }

  const buyItem = async (item: TrollmondItem) => {
    if (!user || !profile) return toast.error('Please log in')
    if ((profile.free_coin_balance || 0) < item.value) return toast.error('Not enough Trollmonds')

    setPurchasing(item.id)
    try {
      const { data, error } = await supabase.rpc('purchase_inventory_item', {
        p_user_id: user.id,
        p_item_id: item.id,
        p_quantity: 1
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error)

      toast.success(`Purchased ${item.name}! Added to inventory.`)
      await refreshProfile() // Update balance
    } catch (err: any) {
      console.error('Purchase error:', err)
      toast.error(err.message || 'Failed to purchase')
    } finally {
      setPurchasing(null)
    }
  }

  const convertCoins = async () => {
    if (!user || !profile) return
    if ((profile.paid_coin_balance || 0) < convertAmount) return toast.error('Not enough Paid Coins')

    setConverting(true)
    try {
      const { data, error } = await supabase.rpc('convert_paid_coins_to_trollmonds', {
        p_user_id: user.id,
        p_paid_coins: convertAmount
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error)

      toast.success(`Converted ${convertAmount} Paid Coins to ${(convertAmount * 100).toLocaleString()} Trollmonds!`)
      await refreshProfile()
      setShowConvertModal(false)
      setConvertAmount(100)
    } catch (err: any) {
      console.error('Conversion error:', err)
      toast.error(err.message || 'Failed to convert')
    } finally {
      setConverting(false)
    }
  }

  const baseCategories = [
    { id: 'Status & Prestige', icon: Crown, label: 'Status & Prestige' },
    { id: 'Avatar & Visual Flex', icon: Sparkles, label: 'Avatar & Visual Flex' },
    { id: 'Chat Dominance', icon: MessageCircle, label: 'Chat Dominance' },
    { id: 'Stream Visibility', icon: Wand2, label: 'Stream Visibility' },
    { id: 'Family & Social Flex', icon: Users, label: 'Family & Social Flex' },
    { id: 'Court & Authority', icon: Gavel, label: 'Troll Court & Authority' },
    { id: 'Prestige Gifts', icon: Gift, label: 'Prestige Gifts' },
    { id: 'Achievement & Legacy', icon: Star, label: 'Achievement & Legacy' },
    { id: 'Fun & Troll', icon: Skull, label: 'Fun / Weird / Troll' },
    { id: 'Ultra Rare', icon: Flame, label: 'Ultra Rare' },
    // Legacy categories for DB items
    { id: 'Small Gifts', icon: Gift, label: 'Small Gifts' },
    { id: 'Fun Animations', icon: Sparkles, label: 'Fun Animations' },
    { id: 'Chat Stickers', icon: Sticker, label: 'Chat Stickers' },
    { id: 'Mini Effects', icon: Zap, label: 'Mini Effects' },
  ]

  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, TrollmondItem[]>)

  const categories = baseCategories.filter(cat => groupedItems[cat.id]?.length)

  if (loading) return (
    <div className="min-h-screen bg-[#0A0814] flex items-center justify-center text-white">
      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShoppingBag className="text-green-400" />
              Trollmonds Store
            </h1>
            <p className="text-gray-400">Spend your Trollmonds on exclusive items!</p>
          </div>
          
          <div className="bg-[#1A1A1A] px-6 py-3 rounded-xl border border-green-500/30 flex items-center gap-3">
            <span className="text-gray-400 text-sm">Your Balance</span>
            <span className="text-2xl font-bold text-green-400">
              {(profile?.free_coin_balance || 0).toLocaleString()}
            </span>
            <span className="text-xs text-green-500/70">Trollmonds</span>
          </div>
        </div>

        {/* Conversion Section */}
        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-purple-500/30 mb-10">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-purple-300">
            <Coins className="w-6 h-6" />
            Convert Paid Coins to Trollmonds
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#15151A] p-4 rounded-lg border border-[#2C2C2C]">
              <p className="text-sm text-gray-400 mb-1">Paid Coins Balance</p>
              <p className="text-2xl font-bold text-yellow-400">
                {(profile?.paid_coin_balance || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-[#15151A] p-4 rounded-lg border border-[#2C2C2C]">
              <p className="text-sm text-gray-400 mb-1">Trollmonds Balance</p>
              <p className="text-2xl font-bold text-green-400">
                {(profile?.free_coin_balance || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-[#15151A] p-4 rounded-lg border border-[#2C2C2C]">
              <p className="text-sm text-gray-400 mb-1">Conversion Rate</p>
              <p className="text-lg font-bold text-purple-400">
                100 Paid Coins <ArrowRight className="inline w-4 h-4 mx-1" /> 10,000 Trollmonds
              </p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-300 mb-3">Select amount to convert:</p>
            <div className="flex gap-3 flex-wrap">
              {[100, 500, 1000].map(amount => (
                <button
                  key={amount}
                  onClick={() => setConvertAmount(amount)}
                  disabled={(profile?.paid_coin_balance || 0) < amount}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    convertAmount === amount
                      ? 'bg-purple-600 text-white'
                      : 'bg-[#2C2C2C] text-gray-300 hover:bg-[#3C3C3C]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {amount} Coins
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowConvertModal(true)}
            disabled={(profile?.paid_coin_balance || 0) < convertAmount}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-5 h-5" />
            Convert {convertAmount} Coins to {(convertAmount * 100).toLocaleString()} Trollmonds
          </button>

          <div className="mt-4 text-xs text-gray-400">
            <p className="mb-2">💡 Trollmonds are in-app utility points for:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Trollmond Events & Giveaways</li>
              <li>Stream Boosts & Multipliers</li>
              <li>Family XP & Influence Perks</li>
              <li>Exclusive Chat Effects</li>
            </ul>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConvertModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1A1A1A] rounded-xl p-6 max-w-md w-full border border-purple-500/30">
              <h3 className="text-xl font-bold mb-4 text-center">Confirm Conversion</h3>
              <div className="text-center mb-6">
                <p className="text-gray-300 mb-2">
                  Convert <span className="text-yellow-400 font-bold">{convertAmount}</span> Paid Coins
                </p>
                <ArrowRight className="w-6 h-6 text-purple-400 mx-auto my-2" />
                <p className="text-gray-300">
                  to <span className="text-green-400 font-bold">{(convertAmount * 100).toLocaleString()}</span> Trollmonds
                </p>
              </div>
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-6">
                <p className="text-sm text-red-300">
                  ⚠️ This conversion is final. Trollmonds are in-app utility points and cannot be withdrawn or transferred.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={convertCoins}
                  disabled={converting}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-10">
          {categories.map(cat => {
            const catItems = groupedItems[cat.id]
            if (!catItems?.length) return null
            const Icon = cat.icon

            return (
              <div key={cat.id}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-300 border-b border-purple-500/20 pb-2">
                  <Icon className="w-5 h-5" />
                  {cat.label}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {catItems.map(item => (
                    <div key={item.id} className="bg-[#15151A] rounded-xl p-4 border border-[#2C2C2C] hover:border-purple-500/50 transition-all group">
                      <div className="text-4xl text-center mb-3">{item.icon}</div>
                      <h3 className="font-semibold text-center mb-1 truncate">{item.name}</h3>
                      <p className="text-xs text-gray-500 text-center mb-3 h-8 line-clamp-2">{item.description}</p>
                      <button
                        onClick={() => buyItem(item)}
                        disabled={!!purchasing}
                        className="w-full py-2 bg-green-900/30 hover:bg-green-600 text-green-400 hover:text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        {purchasing === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Buy'}
                        {item.value} 💎
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
