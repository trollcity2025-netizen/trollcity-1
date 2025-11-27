import React, { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Camera, Edit, Star, CreditCard, Settings, ChevronDown, ChevronUp, Crown, Shield, UserPlus, UserMinus, MessageCircle, Ban, Gift } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getTierFromXP, getLevelFromXP } from '../lib/tierSystem'
import XPProgressBar from '../components/XPProgressBar'
import SendGiftModal from '../components/SendGiftModal'

export default function Profile() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { username: routeUsername, userId } = useParams()
  const [viewed, setViewed] = useState<any | null>(null)
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'profile_info',
    'stats', 
    'entrance_effects',
    'payment_methods',
    'account_settings'
  ])
  const [editingProfile, setEditingProfile] = useState(false)
  const [bio, setBio] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [streamsCreated, setStreamsCreated] = useState(0)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [effects, setEffects] = useState<any[]>([])
  const [selectedEffectId, setSelectedEffectId] = useState<string>('')
  const [privateEnabled, setPrivateEnabled] = useState<boolean>(false)
  const [viewPrice, setViewPrice] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)

  // Initialize view price from profile
  useEffect(() => {
    if (profile) {
      setViewPrice(Number((profile as any)?.profile_view_price ?? 0))
    }
  }, [profile?.id])

  // Handle URL section parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const section = params.get('section')
    if (section && !expandedSections.includes(section)) {
      setExpandedSections(prev => [...prev, section])
    }
  }, [location.search])

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    
    try {
      const updates: any = { bio }
      
      // If username is being edited and changed
      if (editUsername && editUsername !== profile.username) {
        // Check username length limit (14 chars for regular users, unlimited for officers/admin)
        const maxLength = (profile.role === 'troll_officer' || profile.role === 'admin') ? 999 : 14
        if (editUsername.length > maxLength) {
          toast.error(`Username must be ${maxLength} characters or less`)
          return
        }
        
        // Check if username is already taken
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', editUsername)
          .maybeSingle()
        
        if (existing) {
          toast.error('Username already taken')
          return
        }
        
        updates.username = editUsername
      }
      
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', profile.id)

      if (error) throw error

      // Update local profile
      useAuthStore.getState().setProfile({ ...profile, ...updates })
      
      toast.success('Profile updated successfully!')
      setEditingProfile(false)
      setEditUsername('')
    } catch (error) {
      console.error('Update profile error:', error)
      toast.error('Failed to update profile')
    }
  }

  useEffect(() => {
    const loadStats = async () => {
      try {
        if (!profile?.id) return
        let target = profile
        
        // If viewing another user's profile by ID
        if (userId && userId !== user?.id) {
          const { data } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
          
          if (data) {
            target = data
            setViewed(data)
          } else {
            // User not found, redirect to own profile
            navigate('/profile/me')
            return
          }
        }
        // If viewing another user's profile by username
        else if (routeUsername && profile?.username !== routeUsername) {
          // First try to find by username
          let { data } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('username', routeUsername)
            .maybeSingle()
          
          // If not found by username, try email prefix match
          if (!data) {
            const { data: emailMatch } = await supabase
              .from('user_profiles')
              .select('*')
              .ilike('email', `${routeUsername}@%`)
              .maybeSingle()
            data = emailMatch
          }
          
          if (data) {
            target = data
            setViewed(data)
          } else {
            // User not found, redirect to own profile
            navigate('/profile/me')
            return
          }
        } else {
          // Viewing own profile
          setViewed(null)
        }
        
        const { data: streams } = await supabase
          .from('streams')
          .select('id')
          .eq('broadcaster_id', target.id)
        setStreamsCreated((streams || []).length)
        const { data: followers } = await supabase
          .from('user_follows')
          .select('id')
          .eq('following_id', target.id)
        setFollowersCount((followers || []).length)
        const { data: following } = await supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', target.id)
        setFollowingCount((following || []).length)
        
        // Check if current user is following this profile
        if (user?.id && target.id !== user.id) {
          const { data: followCheck } = await supabase
            .from('user_follows')
            .select('id')
            .eq('follower_id', user.id)
            .eq('following_id', target.id)
            .maybeSingle()
          setIsFollowing(!!followCheck)
          
          // Check if current user has blocked this profile
          const { data: blockCheck } = await supabase
            .from('blocked_users')
            .select('id')
            .eq('blocker_id', user.id)
            .eq('blocked_id', target.id)
            .maybeSingle()
          setIsBlocked(!!blockCheck)
        }
        
        // Try to load entrance effects (table might not exist yet)
        try {
          const { data: userEffects, error: effectsError } = await supabase
            .from('user_entrance_effects')
            .select('effect_id, entrance_effects:effect_id (*)')
            .eq('user_id', target.id)
          
          if (!effectsError && userEffects) {
            const mapped = (userEffects || []).map((row: any) => row.entrance_effects).filter(Boolean)
            if (mapped.length) {
              setEffects(mapped)
              try { localStorage.setItem('tc-effects', JSON.stringify(mapped)) } catch {}
            }
          }
        } catch (err) {
          // Table doesn't exist yet, that's okay
          console.log('Entrance effects table not available:', err)
        }
      } catch {}
    }
    loadStats()
    try {
      const cached = JSON.parse(localStorage.getItem('tc-effects') || '[]')
      setEffects(Array.isArray(cached) ? cached : [])
    } catch {}
    try {
      if (user?.id) {
        const sel = localStorage.getItem(`tc-selected-effect-${user.id}`) || ''
        setSelectedEffectId(sel)
        const priv = localStorage.getItem(`tc-private-profile-${user.id}`)
        setPrivateEnabled(priv === 'true')
      }
    } catch {}
  }, [profile?.id, user?.id, routeUsername])

  const viewedPrice = () => {
    const p = Number(viewed?.profile_view_price || localStorage.getItem(`tc-profile-view-price-${viewed?.id}`) || 0)
    return isNaN(p) ? 0 : p
  }
  const hasAccessToViewed = () => {
    if (!user || !viewed) return false
    if (profile?.id === viewed.id) return true
        const price = (useAuthStore.getState().profile?.role === 'admin') ? 0 : viewedPrice()
    if (price <= 0) return true
    try {
      const access = localStorage.getItem(`tc-view-access-${user.id}-${viewed.id}`)
      return Boolean(access)
    } catch {
      return false
    }
  }
  const unlockViewedProfile = async () => {
    if (!user || !viewed || !profile) return
    const price = viewedPrice()
    if (price <= 0) return
    if ((profile.paid_coin_balance || 0) < price) return toast.error('Not enough paid coins')
    try {
      const newBal = (profile.paid_coin_balance || 0) - price
      const { error } = await supabase
        .from('user_profiles')
        .update({ paid_coin_balance: newBal })
        .eq('id', profile.id)
      if (error) throw error
      await supabase
        .from('coin_transactions')
        .insert([{ user_id: profile.id, type: 'purchase', amount: -price, description: 'Profile view unlock', metadata: { target_id: viewed.id } }])
      useAuthStore.getState().setProfile({ ...profile, paid_coin_balance: newBal } as any)
    } catch {}
    try { localStorage.setItem(`tc-view-access-${user.id}-${viewed.id}`, String(Date.now())) } catch {}
    toast.success('Unlocked')
  }

  const handleFollow = async () => {
    if (!user || !viewed || viewed.id === user.id) return
    try {
      if (isFollowing) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', viewed.id)
        setIsFollowing(false)
        setFollowersCount(prev => Math.max(0, prev - 1))
        toast.success('Unfollowed')
      } else {
        await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: viewed.id })
        setIsFollowing(true)
        setFollowersCount(prev => prev + 1)
        toast.success('Following!')
      }
    } catch (error) {
      console.error('Follow error:', error)
      toast.error('Failed to update follow status')
    }
  }

  const handleBlock = async () => {
    if (!user || !viewed || viewed.id === user.id) return
    try {
      if (isBlocked) {
        await supabase
          .from('blocked_users')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', viewed.id)
        setIsBlocked(false)
        toast.success('Unblocked')
      } else {
        await supabase
          .from('blocked_users')
          .insert({ blocker_id: user.id, blocked_id: viewed.id })
        setIsBlocked(true)
        toast.success('Blocked')
      }
    } catch (error) {
      console.error('Block error:', error)
      toast.error('Failed to update block status')
    }
  }

  const handleMessage = () => {
    if (!viewed) return
    navigate(`/messages?user=${viewed.username}`)
  }

  const handleSelectEffect = (id: string) => {
    if (!user) return
    setSelectedEffectId(id)
    try { localStorage.setItem(`tc-selected-effect-${user.id}`, id) } catch {}
    toast.success('Entrance effect selected')
  }

  const triggerAvatarUpload = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    try {
      if (!file.type.startsWith('image/')) throw new Error('File must be an image')
      if (file.size > 5 * 1024 * 1024) throw new Error('Image too large (max 5MB)')
      const ext = file.name.split('.').pop()
      const name = `${user.id}-${Date.now()}.${ext}`
      const path = `avatars/${name}`
      const { error: uploadErr } = await supabase.storage
        .from('troll-city-assets')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage
        .from('troll-city-assets')
        .getPublicUrl(path)
      const { error: updateErr } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (updateErr) throw updateErr
      const { data: updated } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (updated) useAuthStore.getState().setProfile(updated as any)
      toast.success('Avatar uploaded')
    } catch (err: any) {
      try {
        const reader = new FileReader()
        reader.onloadend = async () => {
          const dataUrl = reader.result as string
          await supabase
            .from('user_profiles')
            .update({ avatar_url: dataUrl, updated_at: new Date().toISOString() })
            .eq('id', user!.id)
          const { data: updated } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user!.id)
            .single()
          if (updated) useAuthStore.getState().setProfile(updated as any)
          toast.success('Avatar uploaded')
        }
        reader.readAsDataURL(file)
      } catch {
        toast.error(err?.message || 'Failed to upload avatar')
      }
    }
  }

  const togglePrivateProfile = async () => {
    if (!profile || !user) return
    if (!privateEnabled) {
      const cost = 2000
      if ((profile.paid_coin_balance || 0) < cost) {
        toast.error('Requires 2,000 paid coins')
        return
      }
      try {
        const { error: updErr } = await supabase
          .from('user_profiles')
          .update({ paid_coin_balance: profile.paid_coin_balance - cost, updated_at: new Date().toISOString() })
          .eq('id', profile.id)
        if (updErr) throw updErr
        await supabase
          .from('coin_transactions')
          .insert([{ user_id: profile.id, type: 'purchase', amount: -cost, description: 'Private profile activation', metadata: { feature: 'private_profile' } }])
        useAuthStore.getState().setProfile({ ...profile, paid_coin_balance: profile.paid_coin_balance - cost } as any)
        setPrivateEnabled(true)
        try { localStorage.setItem(`tc-private-profile-${user.id}`, 'true') } catch {}
        toast.success('Private profile enabled')
      } catch {
        toast.error('Failed to enable private profile')
      }
    } else {
      setPrivateEnabled(false)
      try { localStorage.setItem(`tc-private-profile-${user.id}`, 'false') } catch {}
      toast.success('Private profile disabled')
    }
  }

  // Define this before sections array since it's used inside
  const isViewingOtherUser = viewed && user && viewed.id !== user.id

  const sections = [
    {
      id: 'profile_info',
      title: 'Profile Info',
      icon: <Camera className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          {user?.email && (!viewed || viewed.id === profile?.id || profile?.role === 'admin') && (
            <div className="p-3 rounded-lg bg-[#0D0D0D] border border-[#2C2C2C]">
              <div className="text-xs text-gray-500 mb-1">Email</div>
              <div className="text-sm text-gray-300">{user.email}</div>
            </div>
          )}
          <p className="text-gray-300">{bio}</p>
          
          {isViewingOtherUser && (
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={handleFollow}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isFollowing
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              
              <button
                onClick={handleMessage}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Message
              </button>
              
              <button
                onClick={() => setShowGiftModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Gift className="w-4 h-4" />
                Send Gift
              </button>
              
              <button
                onClick={handleBlock}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isBlocked
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                <Ban className="w-4 h-4" />
                {isBlocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          )}
          
          {editingProfile ? (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">
                  Username {(profile?.role !== 'troll_officer' && profile?.role !== 'admin') && '(max 14 characters)'}
                </div>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  maxLength={(profile?.role === 'troll_officer' || profile?.role === 'admin') ? undefined : 14}
                  className="w-full px-3 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-white placeholder-gray-500"
                  placeholder="Enter username..."
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Bio</div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-white placeholder-gray-500 resize-none h-20"
                  placeholder="Tell us about yourself..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveProfile}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingProfile(false)}
                  className="px-4 py-2 bg-[#2C2C2C] text-gray-300 rounded-lg hover:bg-[#3C3C3C] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingProfile(true)
                setEditUsername(profile?.username || '')
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </button>
          )}
        </div>
      )
    },
    {
      id: 'stats',
      title: 'Stats',
      icon: <div className="w-5 h-5 flex items-center justify-center">📊</div>,
      badge: null,
      content: (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#0D0D0D] rounded-lg p-4">
            <div className="text-gray-400 text-sm">Streams Created</div>
            <div className="text-white text-2xl font-bold">{streamsCreated}</div>
          </div>
          <div className="bg-[#0D0D0D] rounded-lg p-4">
            <div className="text-gray-400 text-sm">Followers</div>
            <div className="text-white text-2xl font-bold">{followersCount}</div>
          </div>
          <div className="bg-[#0D0D0D] rounded-lg p-4">
            <div className="text-gray-400 text-sm">Following</div>
            <div className="text-white text-2xl font-bold">{followingCount}</div>
          </div>
          <div className="bg-[#0D0D0D] rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Earned Coins</div>
            <div className="text-white text-2xl font-bold">{profile?.total_earned_coins || 0}</div>
          </div>
        </div>
      )
    },
    
    {
      id: 'entrance_effects',
      title: 'Entrance Effects',
      icon: <Star className="w-5 h-5 text-purple-500" />,
      badge: null,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {effects.map((e: any) => (
              <div key={e.id} className={`bg-[#0D0D0D] rounded-lg p-4 text-center border ${selectedEffectId===e.id?'border-purple-500':'border-[#2C2C2C]'}`}>
                <div className="text-2xl mb-2">{e.icon || '⭐'}</div>
                <div className="text-white font-medium mb-2">{e.name}</div>
                <button onClick={() => handleSelectEffect(e.id)} className={`w-full py-2 rounded ${selectedEffectId===e.id?'bg-purple-600 text-white':'bg-[#2C2C2C] text-gray-300'}`}>{selectedEffectId===e.id?'Selected':'Use'}</button>
              </div>
            ))}
          </div>
          <div>
            <button onClick={() => navigate('/store')} className="px-4 py-2 rounded bg-purple-600 text-white">Browse Effects</button>
          </div>
        </div>
      )
    },
    {
      id: 'payment_methods',
      title: 'Payment Methods',
      icon: <CreditCard className="w-5 h-5" />,
      content: (
        <div className="space-y-3">
          <button onClick={() => navigate('/account/wallet')} className="w-full py-2 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500 hover:text-white transition-colors">
            Manage Payment Methods
          </button>
          <DefaultPaymentMethod />
        </div>
      )
    },
    {
      id: 'account_settings',
      title: 'Account Settings',
      icon: <Settings className="w-5 h-5" />,
      content: (
        <div className="space-y-3">
          {user?.email && (!viewed || viewed.id === profile?.id || profile?.role === 'admin') && (
            <div className="p-3 rounded-lg bg-[#0D0D0D] border border-[#2C2C2C]">
              <div className="text-xs text-gray-500 mb-1">Account Email</div>
              <div className="text-sm text-gray-300">{user.email}</div>
            </div>
          )}
          <div className="p-3 bg-[#0D0D0D] rounded-lg">
            <div className="text-white mb-2">Profile View Price (max 2000 paid coins)</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={2000}
                value={viewPrice}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(2000, Number(e.target.value || 0)))
                  setViewPrice(val)
                }}
                onBlur={async () => {
                  try {
                    await supabase
                      .from('user_profiles')
                      .update({ profile_view_price: viewPrice, updated_at: new Date().toISOString() })
                      .eq('id', profile!.id)
                    useAuthStore.getState().setProfile({ ...(profile as any), profile_view_price: viewPrice } as any)
                  } catch {
                    try { localStorage.setItem(`tc-profile-view-price-${profile!.id}`, String(viewPrice)) } catch {}
                  }
                }}
                className="w-24 bg-gray-900 text-white p-2 rounded border border-purple-600"
              />
              <span className="text-xs text-gray-400">Viewers must pay to view and follow</span>
            </div>
          </div>
          <button className="w-full py-2 border border-red-500 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors">
            Delete Account
          </button>
        </div>
      )
    }
  ]

  console.log('Profile component - profile:', profile, 'user:', user, 'routeUsername:', routeUsername)

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-xl">Loading profile... (profile is null/undefined)</div>
        <div className="text-sm mt-4">User: {user?.email || 'No user'}</div>
      </div>
    )
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          {viewed && profile.id !== viewed.id && !hasAccessToViewed() && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="w-[360px] bg-[#121212] border border-purple-600 rounded-xl p-4">
                <div className="font-semibold mb-2">Unlock @{viewed.username}'s profile</div>
                <div className="text-xs text-gray-300 mb-3">Price: {viewedPrice()} paid coins</div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => navigate('/store')} className="px-3 py-1 rounded bg-gray-700 text-white text-xs">Get Coins</button>
                  <button onClick={unlockViewedProfile} className="px-3 py-1 rounded bg-purple-600 text-white text-xs">Unlock</button>
                </div>
              </div>
            </div>
          )}
          <div className="bg-[#1A1A1A] rounded-xl p-8 border border-[#2C2C2C] mb-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full overflow-hidden">
                  <img src={(viewed?.avatar_url || profile.avatar_url) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${(viewed?.username || profile.username)}`} alt="avatar" className="w-full h-full object-cover" />
                </div>
                {(!viewed || viewed.id === profile.id) && (
                  <button onClick={triggerAvatarUpload} className="absolute -bottom-1 -right-1 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center border-2 border-[#1A1A1A]">
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-white">@{(viewed?.username || profile.username)}</h1>
                  {/* Admin Badge */}
                  {(viewed?.role || profile.role) === 'admin' && (
                    <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      ADMIN
                    </span>
                  )}
                  {/* OG Badge - for early users (created before 2026-01-01) or Level 100 */}
                  {(viewed?.badge === 'og' || profile.badge === 'og' || getLevelFromXP((viewed?.xp || profile.xp) || 0) === 100) && (
                    <span className="px-2 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold rounded-full flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      OG
                    </span>
                  )}
                </div>
                {/* Tier and Level Display */}
                <div className="mb-2">
                  <div className="text-purple-400 font-semibold text-sm">
                    Level {getLevelFromXP((viewed?.xp || profile.xp) || 0)} - {getTierFromXP((viewed?.xp || profile.xp) || 0).title}
                  </div>
                  {/* XP Progress Bar */}
                  <XPProgressBar 
                    key={(viewed?.xp || profile.xp) || 0}
                    currentXP={(viewed?.xp || profile.xp) || 0} 
                    className="mt-2" 
                  />
                </div>
                {(!viewed || viewed.id === profile?.id || profile?.role === 'admin') && (
                  <p className="text-gray-400 mb-3">{user?.email || ''}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 text-xl font-bold">{(viewed?.paid_coin_balance ?? profile.paid_coin_balance)} Paid</span>
                  <span className="text-blue-400 text-xl font-bold">{(viewed?.free_coin_balance ?? profile.free_coin_balance)} Free</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.id} className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C]">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-6 hover:bg-[#2C2C2C] transition-colors rounded-t-xl"
                >
                  <div className="flex items-center gap-3">
                    {section.icon}
                    <span className="text-white font-semibold">{section.title}</span>
                    {section.badge && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        section.id === 'recent_streams' ? 'bg-red-500 text-white' :
                        section.id === 'entrance_effects' ? 'bg-purple-500 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {section.badge}
                      </span>
                    )}
                  </div>
                  {expandedSections.includes(section.id) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {expandedSections.includes(section.id) && (
                  <div className="px-6 pb-6 border-t border-[#2C2C2C]">
                    {section.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    
    {viewed && (
      <SendGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamerId={viewed.id}
        streamId="profile-gift"
      />
    )}
    </>
  )
}

function DefaultPaymentMethod() {
  const { profile, user } = useAuthStore()
  const [method, setMethod] = useState<any | null>(null)
  const [allMethods, setAllMethods] = useState<any[]>([])
  
  const loadMethods = async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', profile.id)
      .eq('provider', 'card')
      .order('is_default', { ascending: false })
    setAllMethods(data || [])
    setMethod(data?.find(m => m.is_default) || null)
  }

  useEffect(() => {
    loadMethods()
    
    // Set up real-time subscription for instant updates
    if (profile?.id) {
      const channel = supabase
        .channel(`payment_methods_profile_${profile.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_payment_methods',
          filter: `user_id=eq.${profile.id}`
        }, () => {
          loadMethods()
        })
        .subscribe()
      
      return () => {
        void supabase.removeChannel(channel)
      }
    }
  }, [profile?.id])

  const setAsDefault = async (methodId: string) => {
    if (!profile?.id) return
    try {
      await supabase
        .from('user_payment_methods')
        .update({ is_default: false })
        .eq('user_id', profile.id)
      
      await supabase
        .from('user_payment_methods')
        .update({ is_default: true })
        .eq('id', methodId)
      
      toast.success('Default payment method updated')
      loadMethods()
    } catch (error) {
      toast.error('Failed to update default payment method')
    }
  }

  const removeMethod = async (methodId: string) => {
    if (!profile?.id) return
    // Optimistic UI: remove locally first
    const backup = allMethods
    setAllMethods(prev => prev.filter(m => m.id !== methodId))
    if (method?.id === methodId) setMethod(null)

    try {
      const { error } = await supabase
        .from('user_payment_methods')
        .delete()
        .eq('id', methodId)

      if (error) {
        setAllMethods(backup)
        toast.error('Failed to remove payment method')
        return
      }

      toast.success('Payment method removed')
    } catch (error) {
      setAllMethods(backup)
      toast.error('Failed to remove payment method')
    }
  }

  if (!profile) return null
  
  return (
    <div className="space-y-3">
      {allMethods.length === 0 ? (
        <div className="p-4 rounded-lg bg-[#0D0D0D] border border-[#2C2C2C] text-center">
          <div className="text-sm text-gray-400 mb-2">No payment methods saved</div>
          <button
            onClick={() => window.location.href = '/account/wallet'}
            className="px-4 py-2 bg-troll-purple hover:bg-troll-purple/80 rounded-lg text-sm"
          >
            Add Payment Method
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {allMethods.map((m) => (
            <div
              key={m.id}
              className="p-3 rounded-lg bg-[#0D0D0D] border border-[#2C2C2C] flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-troll-neon-blue" />
                <div>
                  <div className="text-sm font-medium">
                    {m.brand || m.card_brand || 'Card'} •••• {m.last4 || m.last_4 || '****'}
                  </div>
                  {m.is_default && (
                    <div className="text-xs text-troll-neon-blue">Default</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {!m.is_default && (
                  <button
                    onClick={() => setAsDefault(m.id)}
                    className="px-3 py-1 text-xs bg-troll-purple/20 hover:bg-troll-purple/40 rounded border border-troll-purple"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => removeMethod(m.id)}
                  className="px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/40 rounded border border-red-500 text-red-400"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
