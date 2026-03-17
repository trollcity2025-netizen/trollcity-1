/**
 * Username & Badge Design Showcase
 * 
 * This page showcases different design concepts for displaying usernames and badges
 * on Trollo Wall and profiles. Use this to evaluate and choose the best direction.
 * 
 * Access: /dev/badge-design-showcase
 */

import React, { useState } from 'react'
import { Crown, Shield, Skull, Star, Verified, Award, Zap, Heart, MessageSquare, Users, Flame, Gem, Sparkles, Hexagon, Circle, Square } from 'lucide-react'

// Mock user data for demonstration
const mockUsers = [
  {
    id: '1',
    username: 'TrollKing',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TrollKing',
    is_admin: true,
    is_troll_officer: false,
    officer_level: 0,
    is_troller: false,
    troller_level: 0,
    is_og_user: true,
    is_verified: true,
    is_gold: true,
    badge: 'president',
    empire_role: 'partner',
    level: 50,
    xp: 12500,
  },
  {
    id: '2',
    username: 'OfficerSarah',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=OfficerSarah',
    is_admin: false,
    is_troll_officer: true,
    officer_level: 3,
    is_troller: false,
    troller_level: 0,
    is_og_user: false,
    is_verified: true,
    is_gold: false,
    badge: null,
    empire_role: null,
    level: 35,
    xp: 8200,
  },
  {
    id: '3',
    username: 'ChaosMaster',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ChaosMaster',
    is_admin: false,
    is_troll_officer: false,
    officer_level: 0,
    is_troller: true,
    troller_level: 3,
    is_og_user: true,
    is_verified: false,
    is_gold: false,
    badge: null,
    empire_role: null,
    level: 28,
    xp: 6100,
  },
  {
    id: '4',
    username: 'Newbie2024',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Newbie2024',
    is_admin: false,
    is_troll_officer: false,
    officer_level: 0,
    is_troller: false,
    troller_level: 0,
    is_og_user: false,
    is_verified: false,
    is_gold: false,
    badge: null,
    empire_role: null,
    level: 3,
    xp: 150,
  },
  {
    id: '5',
    username: 'EmpirePartner',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=EmpirePartner',
    is_admin: false,
    is_troll_officer: false,
    officer_level: 0,
    is_troller: false,
    troller_level: 0,
    is_og_user: false,
    is_verified: true,
    is_gold: false,
    badge: null,
    empire_role: 'partner',
    level: 15,
    xp: 2800,
  },
]

// Design Concept 1: Minimal & Clean
const MinimalDesign = ({ user }: { user: typeof mockUsers[0] }) => {
  const getPrimaryBadge = () => {
    if (user.is_admin) return { icon: Crown, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Admin' }
    if (user.officer_level === 3) return { icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Commander' }
    if (user.officer_level === 2) return { icon: Shield, color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Sr. Officer' }
    if (user.officer_level === 1) return { icon: Shield, color: 'text-sky-400', bg: 'bg-sky-500/20', label: 'Officer' }
    if (user.troller_level === 3) return { icon: Skull, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Supreme' }
    if (user.troller_level === 2) return { icon: Skull, color: 'text-violet-400', bg: 'bg-violet-500/20', label: 'Chaos' }
    if (user.troller_level === 1) return { icon: Skull, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20', label: 'Troller' }
    return null
  }

  const badge = getPrimaryBadge()

  return (
    <div className="flex items-center gap-2">
      <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full" />
      <span className={`font-semibold ${user.is_gold ? 'text-yellow-400' : 'text-white'}`}>
        @{user.username}
      </span>
      {badge && (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${badge.bg} ${badge.color}`}>
          <badge.icon size={10} />
          {badge.label}
        </span>
      )}
      {user.is_og_user && <span className="text-yellow-500 text-xs">★</span>}
      {user.is_verified && <Verified size={12} className="text-blue-400" />}
    </div>
  )
}

// Design Concept 2: Neon Glow
const NeonGlowDesign = ({ user }: { user: typeof mockUsers[0] }) => {
  const getGlowColor = () => {
    if (user.is_admin) return 'shadow-[0_0_10px_rgba(248,113,113,0.5)] border-red-500/50'
    if (user.officer_level > 0) return 'shadow-[0_0_10px_rgba(96,165,250,0.5)] border-blue-500/50'
    if (user.troller_level > 0) return 'shadow-[0_0_10px_rgba(192,132,252,0.5)] border-purple-500/50'
    if (user.is_gold) return 'shadow-[0_0_10px_rgba(250,204,21,0.5)] border-yellow-500/50'
    return ''
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border ${getGlowColor()}`}>
      <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full ring-2 ring-white/20" />
      <div className="flex flex-col">
        <span className={`font-bold text-sm ${user.is_gold ? 'text-yellow-400' : 'text-white'}`}>
          {user.username}
        </span>
        <div className="flex items-center gap-1">
          {user.is_admin && <Crown size={12} className="text-red-400" />}
          {user.officer_level > 0 && <Shield size={12} className="text-blue-400" />}
          {user.troller_level > 0 && <Skull size={12} className="text-purple-400" />}
          {user.is_og_user && <Star size={12} className="text-yellow-500" />}
          {user.is_verified && <Verified size={12} className="text-cyan-400" />}
          {user.empire_role && <Gem size={12} className="text-purple-400" />}
        </div>
      </div>
    </div>
  )
}

// Design Concept 3: Badge Bar (horizontal)
const BadgeBarDesign = ({ user }: { user: typeof mockUsers[0] }) => {
  const badges = []
  
  if (user.is_admin) badges.push({ icon: Crown, color: 'bg-red-500', label: 'Admin' })
  else if (user.officer_level === 3) badges.push({ icon: Shield, color: 'bg-blue-600', label: 'Commander' })
  else if (user.officer_level === 2) badges.push({ icon: Shield, color: 'bg-blue-500', label: 'Sr. Officer' })
  else if (user.officer_level === 1) badges.push({ icon: Shield, color: 'bg-blue-400', label: 'Officer' })
  else if (user.troller_level === 3) badges.push({ icon: Skull, color: 'bg-purple-600', label: 'Supreme' })
  else if (user.troller_level === 2) badges.push({ icon: Skull, color: 'bg-purple-500', label: 'Chaos' })
  else if (user.troller_level === 1) badges.push({ icon: Skull, color: 'bg-purple-400', label: 'Troller' })
  
  if (user.is_og_user) badges.push({ icon: Star, color: 'bg-yellow-500', label: 'OG' })
  if (user.is_verified) badges.push({ icon: Verified, color: 'bg-cyan-500', label: 'Verified' })
  if (user.empire_role) badges.push({ icon: Gem, color: 'bg-purple-500', label: 'Partner' })
  if (user.is_gold) badges.push({ icon: Award, color: 'bg-yellow-400', label: 'Gold' })

  return (
    <div className="flex items-center gap-3">
      <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-bold ${user.is_gold ? 'text-yellow-400' : 'text-white'}`}>
            @{user.username}
          </span>
          <span className="text-xs text-white/40">Lvl {user.level}</span>
        </div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {badges.map((badge, i) => (
            <div
              key={i}
              className={`${badge.color} text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5`}
              title={badge.label}
            >
              <badge.icon size={10} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Design Concept 4: Card Style
const CardStyleDesign = ({ user }: { user: typeof mockUsers[0] }) => {
  const getRoleColor = () => {
    if (user.is_admin) return 'from-red-500/20 to-red-600/10 border-red-500/30'
    if (user.officer_level > 0) return 'from-blue-500/20 to-blue-600/10 border-blue-500/30'
    if (user.troller_level > 0) return 'from-purple-500/20 to-purple-600/10 border-purple-500/30'
    return 'from-zinc-500/20 to-zinc-600/10 border-zinc-500/30'
  }

  const roleLabel = user.is_admin ? 'Admin' : 
    user.officer_level === 3 ? 'Commander' :
    user.officer_level === 2 ? 'Sr. Officer' :
    user.officer_level === 1 ? 'Officer' :
    user.troller_level === 3 ? 'Supreme Troll' :
    user.troller_level === 2 ? 'Chaos Agent' :
    user.troller_level === 1 ? 'Troller' : 'Citizen'

  return (
    <div className={`p-3 rounded-xl bg-gradient-to-br ${getRoleColor()} border`}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <img src={user.avatar} alt={user.username} className="w-12 h-12 rounded-full" />
          {user.is_live && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-bold ${user.is_gold ? 'text-yellow-400' : 'text-white'}`}>
              {user.username}
            </span>
            {user.is_verified && <Verified size={14} className="text-blue-400" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs px-2 py-0.5 rounded bg-black/30 text-white/70">{roleLabel}</span>
            <span className="text-xs text-white/50">Lv.{user.level}</span>
          </div>
        </div>
        <div className="flex gap-1">
          {user.is_og_user && <Star size={16} className="text-yellow-500" />}
          {user.empire_role && <Gem size={16} className="text-purple-400" />}
        </div>
      </div>
    </div>
  )
}

// Design Concept 5: Pill Badges (horizontal scrolling)
const PillBadgesDesign = ({ user }: { user: typeof mockUsers[0] }) => {
  const badges: { label: string; color: string; icon?: React.ElementType }[] = []
  
  if (user.is_admin) badges.push({ label: 'Admin', color: 'bg-red-500 text-white' })
  if (user.officer_level > 0) badges.push({ 
    label: user.officer_level === 3 ? 'Commander' : user.officer_level === 2 ? 'Sr. Officer' : 'Officer', 
    color: 'bg-blue-500 text-white' 
  })
  if (user.troller_level > 0) badges.push({ 
    label: user.troller_level === 3 ? 'Supreme' : user.troller_level === 2 ? 'Chaos' : 'Troller', 
    color: 'bg-purple-500 text-white' 
  })
  if (user.is_og_user) badges.push({ label: 'OG', color: 'bg-yellow-500 text-black' })
  if (user.is_verified) badges.push({ label: 'Verified', color: 'bg-cyan-500 text-white' })
  if (user.empire_role) badges.push({ label: 'Partner', color: 'bg-purple-500 text-white' })
  if (user.is_gold) badges.push({ label: 'Gold', color: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black' })

  return (
    <div className="flex items-start gap-3">
      <img src={user.avatar} alt={user.username} className="w-12 h-12 rounded-full ring-2 ring-white/10" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-bold text-lg ${user.is_gold ? 'text-yellow-400' : 'text-white'}`}>
            {user.username}
          </span>
        </div>
        {badges.length > 0 && (
          <div className="flex gap-1 mt-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {badges.map((badge, i) => (
              <span
                key={i}
                className={`${badge.color} text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1`}
              >
                {badge.icon && <badge.icon size={12} />}
                {badge.label}
              </span>
            ))}
          </div>
        )}
        <div className="text-xs text-white/40 mt-1">Level {user.level} • {user.xp.toLocaleString()} XP</div>
      </div>
    </div>
  )
}

// Design Concept 6: Hexagonal / Gaming Style
const HexagonalDesign = ({ user }: { user: typeof mockUsers[0] }) => {
  const getHexColor = () => {
    if (user.is_admin) return '#ef4444'
    if (user.officer_level > 0) return '#3b82f6'
    if (user.troller_level > 0) return '#a855f7'
    if (user.is_gold) return '#eab308'
    return '#6b7280'
  }

  const hexColor = getHexColor()

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <svg width="52" height="48" viewBox="0 0 52 48" className="absolute -inset-0.5">
          <polygon
            points="26,0 52,13 52,35 26,48 0,35 0,13"
            fill="none"
            stroke={hexColor}
            strokeWidth="2"
            opacity="0.5"
          />
        </svg>
        <img 
          src={user.avatar} 
          alt={user.username} 
          className="w-10 h-10 rounded-full relative z-10"
          style={{ clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
        />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span 
            className="font-bold text-lg"
            style={{ 
              color: user.is_gold ? '#fbbf24' : '#fff',
              textShadow: `0 0 10px ${hexColor}40`
            }}
          >
            {user.username}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {user.is_admin && <Crown size={14} className="text-red-400" />}
          {user.officer_level > 0 && <Shield size={14} className="text-blue-400" />}
          {user.troller_level > 0 && <Skull size={14} className="text-purple-400" />}
          {user.is_og_user && <Star size={14} className="text-yellow-500" />}
          {user.is_verified && <Verified size={14} className="text-cyan-400" />}
          <span className="text-xs text-white/50">Lv.{user.level}</span>
        </div>
      </div>
    </div>
  )
}

// Design Concept 7: Avatar Frame
const AvatarFrameDesign = ({ user }: { user: typeof mockUsers[0] }) => {
  const getFrameColor = () => {
    if (user.is_admin) return 'ring-2 ring-red-500'
    if (user.officer_level === 3) return 'ring-2 ring-blue-600'
    if (user.officer_level > 0) return 'ring-2 ring-blue-400'
    if (user.troller_level > 0) return 'ring-2 ring-purple-500'
    if (user.is_gold) return 'ring-2 ring-yellow-400'
    return 'ring-2 ring-zinc-600'
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <img 
          src={user.avatar} 
          alt={user.username} 
          className={`w-12 h-12 rounded-full ${getFrameColor()}`}
        />
        {/* Corner badges */}
        {user.is_admin && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <Crown size={10} className="text-white" />
          </div>
        )}
        {user.is_verified && !user.is_admin && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
            <Verified size={10} className="text-white" />
          </div>
        )}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className={`font-bold ${user.is_gold ? 'text-yellow-400' : 'text-white'}`}>
            {user.username}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {user.is_og_user && <Star size={12} className="text-yellow-500" />}
          {user.empire_role && <Gem size={12} className="text-purple-400" />}
          <span className="text-xs text-white/50">Level {user.level}</span>
        </div>
      </div>
    </div>
  )
}

// Design Concept 8: Trophy Case
const TrophyCaseDesign = ({ user }: { user: typeof mockUsers[0] }) => {
  const trophies = []
  if (user.is_admin) trophies.push({ icon: Crown, color: 'text-red-400', bg: 'bg-red-500/20' })
  if (user.officer_level > 0) trophies.push({ icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/20' })
  if (user.troller_level > 0) trophies.push({ icon: Skull, color: 'text-purple-400', bg: 'bg-purple-500/20' })
  if (user.is_og_user) trophies.push({ icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-500/20' })
  if (user.is_verified) trophies.push({ icon: Verified, color: 'text-cyan-400', bg: 'bg-cyan-500/20' })
  if (user.empire_role) trophies.push({ icon: Gem, color: 'text-purple-400', bg: 'bg-purple-500/20' })
  if (user.is_gold) trophies.push({ icon: Award, color: 'text-yellow-400', bg: 'bg-yellow-500/20' })

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <img src={user.avatar} alt={user.username} className="w-14 h-14 rounded-xl" />
        <div className="absolute -bottom-2 -right-2 flex -space-x-2">
          {trophies.slice(0, 3).map((trophy, i) => (
            <div key={i} className={`${trophy.bg} ${trophy.color} w-6 h-6 rounded-full flex items-center justify-center border-2 border-black`}>
              <trophy.icon size={12} />
            </div>
          ))}
          {trophies.length > 3 && (
            <div className="w-6 h-6 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center border-2 border-black">
              +{trophies.length - 3}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1">
        <span className={`font-bold text-lg ${user.is_gold ? 'text-yellow-400' : 'text-white'}`}>
          {user.username}
        </span>
        <div className="text-xs text-white/50 mt-0.5">Level {user.level}</div>
      </div>
    </div>
  )
}

// Wall Post Mockup Component
const WallPostMockup = ({ user, design, designName }: { user: typeof mockUsers[0], design: React.ComponentType<{ user: typeof mockUsers[0] }>, designName: string }) => {
  const DesignComponent = design

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-start gap-3">
        <DesignComponent user={user} />
      </div>
      <p className="mt-3 text-white/80 text-sm">
        This is a sample post showing how the username and badges would look on the Trollo Wall with the "{designName}" design concept.
      </p>
      <div className="flex items-center gap-4 mt-3 text-white/50 text-sm">
        <span className="flex items-center gap-1"><Heart size={14} /> 24</span>
        <span className="flex items-center gap-1"><MessageSquare size={14} /> 5</span>
        <span className="text-xs">2 hours ago</span>
      </div>
    </div>
  )
}

// Profile Card Mockup
const ProfileCardMockup = ({ user, design }: { user: typeof mockUsers[0], design: React.ComponentType<{ user: typeof mockUsers[0] }> }) => {
  const DesignComponent = design

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="h-20 bg-gradient-to-r from-purple-600 to-pink-600" />
      <div className="p-4 pt-0">
        <div className="-mt-10 mb-3">
          <DesignComponent user={user} />
        </div>
        <div className="flex gap-4 text-center">
          <div className="flex-1 bg-zinc-800/50 rounded-lg p-2">
            <div className="text-lg font-bold text-white">{user.level}</div>
            <div className="text-xs text-white/50">Level</div>
          </div>
          <div className="flex-1 bg-zinc-800/50 rounded-lg p-2">
            <div className="text-lg font-bold text-white">{(user.xp / 1000).toFixed(1)}k</div>
            <div className="text-xs text-white/50">XP</div>
          </div>
          <div className="flex-1 bg-zinc-800/50 rounded-lg p-2">
            <div className="text-lg font-bold text-white">156</div>
            <div className="text-xs text-white/50">Posts</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BadgeDesignShowcase() {
  const [selectedDesign, setSelectedDesign] = useState<string>('minimal')
  const [viewMode, setViewMode] = useState<'wall' | 'profile'>('wall')

  const designs = [
    { id: 'minimal', name: 'Minimal & Clean', component: MinimalDesign, description: 'Simple, clean badges that don\'t distract' },
    { id: 'neon', name: 'Neon Glow', component: NeonGlowDesign, description: 'Glowing borders and cyberpunk aesthetic' },
    { id: 'badgebar', name: 'Badge Bar', component: BadgeBarDesign, description: 'Horizontal bar with colored badge dots' },
    { id: 'card', name: 'Card Style', component: CardStyleDesign, description: 'Full card with gradient background' },
    { id: 'pills', name: 'Pill Badges', component: PillBadgesDesign, description: 'Rounded pill badges with labels' },
    { id: 'hex', name: 'Hexagonal', component: HexagonalDesign, description: 'Gaming-style hexagonal avatar frame' },
    { id: 'frame', name: 'Avatar Frame', component: AvatarFrameDesign, description: 'Ring around avatar with corner badges' },
    { id: 'trophy', name: 'Trophy Case', component: TrophyCaseDesign, description: 'Badge icons shown in cluster near avatar' },
  ]

  const CurrentDesign = designs.find(d => d.id === selectedDesign)?.component || MinimalDesign

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Username & Badge Design Showcase
          </h1>
          <p className="text-white/60 mt-2">
            Explore different design concepts for displaying usernames and badges on Trollo Wall and profiles
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('wall')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'wall' 
                ? 'bg-purple-600 text-white' 
                : 'bg-zinc-800 text-white/60 hover:text-white'
            }`}
          >
            <MessageSquare size={16} className="inline mr-2" />
            Trollo Wall
          </button>
          <button
            onClick={() => setViewMode('profile')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'profile' 
                ? 'bg-purple-600 text-white' 
                : 'bg-zinc-800 text-white/60 hover:text-white'
            }`}
          >
            <Users size={16} className="inline mr-2" />
            Profile
          </button>
        </div>

        {/* Design Selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
          {designs.map(design => (
            <button
              key={design.id}
              onClick={() => setSelectedDesign(design.id)}
              className={`p-3 rounded-lg text-left transition-all ${
                selectedDesign === design.id
                  ? 'bg-purple-600/20 border-2 border-purple-500'
                  : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'
              }`}
            >
              <div className={`font-semibold ${selectedDesign === design.id ? 'text-purple-400' : 'text-white'}`}>
                {design.name}
              </div>
              <div className="text-xs text-white/50 mt-1">{design.description}</div>
            </button>
          ))}
        </div>

        {/* Live Preview */}
        <div className="bg-zinc-950 rounded-2xl p-6 border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="text-purple-400" />
            Live Preview - {viewMode === 'wall' ? 'Trollo Wall Posts' : 'Profile Cards'}
          </h2>
          
          {viewMode === 'wall' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {mockUsers.slice(0, 4).map(user => (
                <WallPostMockup 
                  key={user.id} 
                  user={user} 
                  design={CurrentDesign} 
                  designName={designs.find(d => d.id === selectedDesign)?.name}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {mockUsers.map(user => (
                <ProfileCardMockup 
                  key={user.id} 
                  user={user} 
                  design={CurrentDesign} 
                />
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-8 bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h3 className="text-lg font-semibold mb-4">Badge Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Crown size={16} className="text-red-400" />
              <span>Admin - Platform administrator</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-blue-400" />
              <span>Officer - Troll Officer ranks</span>
            </div>
            <div className="flex items-center gap-2">
              <Skull size={16} className="text-purple-400" />
              <span>Troller - Chaos role ranks</span>
            </div>
            <div className="flex items-center gap-2">
              <Star size={16} className="text-yellow-500" />
              <span>OG - Original user (pre-2026)</span>
            </div>
            <div className="flex items-center gap-2">
              <Verified size={16} className="text-cyan-400" />
              <span>Verified - Identity verified</span>
            </div>
            <div className="flex items-center gap-2">
              <Gem size={16} className="text-purple-400" />
              <span>Partner - Empire partner</span>
            </div>
            <div className="flex items-center gap-2">
              <Award size={16} className="text-yellow-400" />
              <span>Gold - Premium/Gold user</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-green-400" />
              <span>Level - User experience level</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <h4 className="font-semibold text-yellow-400 mb-2">💡 Design Notes</h4>
          <ul className="text-sm text-white/70 space-y-1">
            <li>• Badge priority: Admin {'\u003e'} President {'\u003e'} Officer {'\u003e'} Secretary {'\u003e'} Troller {'\u003e'} OG {'\u003e'} Other</li>
            <li>• Gold users get special username color (yellow/gold)</li>
            <li>• RGB usernames have animated color cycling effect</li>
            <li>• Empire partners show purple gem icon</li>
            <li>• Consider mobile responsiveness - some designs may need truncation</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
