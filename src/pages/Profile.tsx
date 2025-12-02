import React, { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Camera, Edit, Star, Settings, ChevronDown, ChevronUp, Crown, Shield, UserPlus, UserMinus, MessageCircle, Ban, Gift, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getTierFromXP, getLevelFromXP } from '../lib/tierSystem'
import XPProgressBar from '../components/XPProgressBar'
import SendGiftModal from '../components/SendGiftModal'
import GiftersModal from '../components/GiftersModal'
import ReportModal from '../components/ReportModal'
import { EmpireBadge } from '../components/EmpireBadge'

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
  const [showGiftersModal, setShowGiftersModal] = useState(false)
  const [giftersModalType, setGiftersModalType] = useState<'received' | 'sent'>('received')
  const [coinsReceived, setCoinsReceived] = useState(0)
  const [coinsSent, setCoinsSent] = useState(0)
  const [showReportModal, setShowReportModal] = useState(false)
  const [userPosts, setUserPosts] = useState<any[]>([])
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostImage, setNewPostImage] = useState<File | null>(null)
  const [hasAccess, setHasAccess] = useState<boolean>(true)
  const [checkingAccess, setCheckingAccess] = useState<boolean>(false)

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
        if (!profile?.id) {
          console.log('Profile not loaded yet, waiting...')
          return
        }
        
        let target = profile
        
        // If viewing another user's profile by ID
        if (userId && userId !== user?.id) {
          try {
            const { data, error } = await supabase
              .from('user_profiles')
              .select('*, avatar_url')
              .eq('id', userId)
              .maybeSingle()
            
            if (error) {
              console.error('Error loading user by ID:', error)
              toast.error('Failed to load user profile')
              navigate('/profile/me')
              return
            }
            
            if (data) {
              target = data
              setViewed(data)
            } else {
              // User not found, redirect to own profile
              toast.error('User not found')
              navigate('/profile/me')
              return
            }
          } catch (err) {
            console.error('Error in userId lookup:', err)
            toast.error('Failed to load profile')
            navigate('/profile/me')
            return
          }
        }
        // If viewing another user's profile by username
        else if (routeUsername && profile?.username !== routeUsername) {
          try {
            // Decode username in case it was URL encoded
            const decodedUsername = decodeURIComponent(routeUsername)
            
            // First try to find by username
            let { data, error } = await supabase
              .from('user_profiles')
              .select('*, avatar_url')
              .eq('username', decodedUsername)
              .maybeSingle()
            
            // If not found by username, try email prefix match
            if (!data && !error) {
              const { data: emailMatch, error: emailError } = await supabase
                .from('user_profiles')
                .select('*, avatar_url')
                .ilike('email', `${decodedUsername}@%`)
                .maybeSingle()
              data = emailMatch
              error = emailError
            }
            
            if (error) {
              console.error('Error loading user by username:', error)
              toast.error('Failed to load user profile')
              navigate('/profile/me')
              return
            }
            
            if (data) {
              target = data
              setViewed(data)
            } else {
              // User not found, redirect to own profile
              toast.error('User not found')
              navigate('/profile/me')
              return
            }
          } catch (err) {
            console.error('Error in username lookup:', err)
            toast.error('Failed to load profile')
            navigate('/profile/me')
            return
          }
        } else {
          // Viewing own profile
          setViewed(null)
        }
        
        // Ensure target is valid before proceeding
        if (!target || !target.id) {
          console.error('Invalid target profile:', target)
          return
        }
        
        // Load stats for the target profile
        try {
          const { data: streams, error: streamsError } = await supabase
            .from('streams')
            .select('id')
            .eq('broadcaster_id', target.id)
          
          if (streamsError) {
            console.error('Error loading streams:', streamsError)
          } else {
            setStreamsCreated((streams || []).length)
          }
        } catch (err) {
          console.error('Error fetching streams:', err)
        }
        
        try {
          const { data: followers, error: followersError } = await supabase
            .from('user_follows')
            .select('id')
            .eq('following_id', target.id)
          
          if (followersError) {
            console.error('Error loading followers:', followersError)
          } else {
            setFollowersCount((followers || []).length)
          }
        } catch (err) {
          console.error('Error fetching followers:', err)
        }
        
        try {
          const { data: following, error: followingError } = await supabase
            .from('user_follows')
            .select('id')
            .eq('follower_id', target.id)
          
          if (followingError) {
            console.error('Error loading following:', followingError)
          } else {
            setFollowingCount((following || []).length)
          }
        } catch (err) {
          console.error('Error fetching following:', err)
        }
        
        // Check if current user is following this profile
        if (user?.id && target.id !== user.id) {
          try {
            const { data: followCheck, error: followError } = await supabase
              .from('user_follows')
              .select('id')
              .eq('follower_id', user.id)
              .eq('following_id', target.id)
              .maybeSingle()
            
            if (!followError) {
              setIsFollowing(!!followCheck)
            }
            
            // Check if current user has blocked this profile
            const { data: blockCheck, error: blockError } = await supabase
              .from('blocked_users')
              .select('id')
              .eq('blocker_id', user.id)
              .eq('blocked_id', target.id)
              .maybeSingle()
            
            if (!blockError) {
              setIsBlocked(!!blockCheck)
            }
            
            // Check profile view access (don't auto-charge, just check)
            const viewPrice = target.profile_view_price || 0
            if (viewPrice > 0) {
              const accessKey = `tc-view-access-${user.id}-${target.id}`
              const lastAccess = localStorage.getItem(accessKey)
              const accessExpiry = 24 * 60 * 60 * 1000 // 24 hours
              
              // Check if access is still valid
              if (lastAccess && (Date.now() - parseInt(lastAccess)) < accessExpiry) {
                setHasAccess(true)
              } else {
                // Access expired or never granted - user needs to unlock manually
                setHasAccess(false)
              }
            } else {
              setHasAccess(true) // Free profile
            }
          } catch (err) {
            console.error('Error checking follow/block status:', err)
            setHasAccess(true) // Default to true on error
          }
        } else {
          setHasAccess(true) // Own profile always has access
        }
        
        // Load coins received and sent from gifts table
        try {
          const { data: receivedGifts, error: receivedError } = await supabase
            .from('gifts')
            .select('coins_spent')
            .eq('receiver_id', target.id)
          
          if (!receivedError && receivedGifts) {
            const totalReceived = receivedGifts.reduce((sum, gift) => sum + (gift.coins_spent || 0), 0)
            setCoinsReceived(totalReceived)
          }
        } catch (err) {
          console.error('Error loading coins received:', err)
        }
        
        try {
          const { data: sentGifts, error: sentError } = await supabase
            .from('gifts')
            .select('coins_spent')
            .eq('sender_id', target.id)
          
          if (!sentError && sentGifts) {
            const totalSent = sentGifts.reduce((sum, gift) => sum + (gift.coins_spent || 0), 0)
            setCoinsSent(totalSent)
          }
        } catch (err) {
          console.error('Error loading coins sent:', err)
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
      } catch (err) {
        console.error('Error in loadStats:', err)
        toast.error('Failed to load profile data')
      }
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

  useEffect(() => {
    const checkAccess = async () => {
      if (!user || !viewed || profile?.id === viewed.id) {
        setHasAccess(true)
        setCheckingAccess(false)
        return
      }
      
      setCheckingAccess(true)
      const price = (useAuthStore.getState().profile?.role === 'admin') ? 0 : viewedPrice()
      if (price <= 0) {
        setHasAccess(true)
        setCheckingAccess(false)
        return
      }
      
      // Check localStorage first
      try {
        const access = localStorage.getItem(`tc-view-access-${user.id}-${viewed.id}`)
        if (access) {
          setHasAccess(true)
          setCheckingAccess(false)
          return
        }
      } catch {}
      
      // Check via RPC
      try {
        const { data, error } = await supabase.rpc('pay_for_profile_view', {
          p_viewer_id: user.id,
          p_profile_owner_id: viewed.id
        })
        
        if (error && error.message.includes('Insufficient')) {
          setHasAccess(false)
        } else if (data?.has_access) {
          setHasAccess(true)
        } else {
          setHasAccess(false)
        }
      } catch {
        setHasAccess(false)
      } finally {
        setCheckingAccess(false)
      }
    }
    
    if (viewed && user && viewed.id !== user.id) {
      checkAccess()
    } else {
      setHasAccess(true)
      setCheckingAccess(false)
    }
  }, [viewed?.id, user?.id, profile?.id])

  const hasAccessToViewed = async () => {
    if (!user || !viewed) return false
    if (profile?.id === viewed.id) return true
    const price = (useAuthStore.getState().profile?.role === 'admin') ? 0 : viewedPrice()
    if (price <= 0) return true
    
    // Check if user has paid for access
    try {
      const { data, error } = await supabase.rpc('pay_for_profile_view', {
        p_viewer_id: user.id,
        p_profile_owner_id: viewed.id
      })
      
      if (error) {
        // If payment is required and user doesn't have access, return false
        if (error.message.includes('Insufficient')) {
          return false
        }
      }
      
      if (data?.has_access) {
        return true
      }
      
      // Fallback to localStorage check
      const access = localStorage.getItem(`tc-view-access-${user.id}-${viewed.id}`)
      return Boolean(access)
    } catch {
      return false
    }
  }
  const unlockViewedProfile = async () => {
    if (!user || !viewed || !profile) return
    const price = viewedPrice()
    if (price <= 0) {
      setHasAccess(true)
      return
    }
    
    try {
      const { data, error } = await supabase.rpc('pay_for_profile_view', {
        p_viewer_id: user.id,
        p_profile_owner_id: viewed.id
      })
      
      if (error) {
        if (error.message.includes('Insufficient')) {
          toast.error('Not enough paid coins')
        } else {
          toast.error('Failed to unlock profile')
        }
        return
      }
      
      if (data?.success && data?.has_access) {
        setHasAccess(true)
        try { localStorage.setItem(`tc-view-access-${user.id}-${viewed.id}`, String(Date.now())) } catch {}
        toast.success('Profile unlocked!')
        
        // Refresh profile balance
        const { data: updatedProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', profile.id)
          .single()
        if (updatedProfile) {
          useAuthStore.getState().setProfile(updatedProfile as any)
        }
      }
    } catch (error: any) {
      console.error('Error unlocking profile:', error)
      toast.error('Failed to unlock profile')
    }
  }

  const handleFollow = async () => {
    if (!user || !viewed || viewed.id === user.id) return
    
    // If unfollowing, no coin cost
    if (isFollowing) {
      try {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', viewed.id)
        setIsFollowing(false)
        setFollowersCount(prev => Math.max(0, prev - 1))
        toast.success('Unfollowed')
      } catch (error) {
        console.error('Follow error:', error)
        toast.error('Failed to unfollow')
      }
      return
    }
    
    // Following requires coins - use spend_coins RPC
    const FOLLOW_COST = 100 // 100 paid coins to follow
    try {
      if ((profile?.paid_coin_balance || 0) < FOLLOW_COST) {
        toast.error(`You need ${FOLLOW_COST} paid coins to follow`)
        return
      }
      
      // Deduct coins using spend_coins RPC
      const { data: spendResult, error: spendError } = await supabase.rpc('spend_coins', {
        p_sender_id: user.id,
        p_receiver_id: viewed.id, // Coins go to the person being followed
        p_coin_amount: FOLLOW_COST,
        p_source: 'follow',
        p_item: `Follow @${viewed.username}`
      })
      
      if (spendError) {
        throw spendError
      }
      
      if (spendResult && typeof spendResult === 'object' && 'success' in spendResult && !spendResult.success) {
        const errorMsg = (spendResult as any).error || 'Failed to follow'
        toast.error(errorMsg)
        return
      }
      
      // Create follow relationship
      const { error: followError } = await supabase
        .from('user_follows')
        .insert({ follower_id: user.id, following_id: viewed.id })
      
      if (followError) {
        throw followError
      }
      
      setIsFollowing(true)
      setFollowersCount(prev => prev + 1)
      toast.success(`Following @${viewed.username}!`)
      
      // Refresh profile balance
      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (updatedProfile) {
        useAuthStore.getState().setProfile(updatedProfile as any)
      }
    } catch (error: any) {
      console.error('Follow error:', error)
      toast.error(error?.message || 'Failed to follow')
    }
  }

  const handleBlock = async () => {
    if (!user || !viewed || viewed.id === user.id) return
    
    // Prevent blocking admins, officers, and trollers
    const viewedUserRole = viewed?.role || (viewed?.is_admin ? 'admin' : null) || 
                          (viewed?.is_troll_officer ? 'troll_officer' : null) ||
                          (viewed?.is_troller ? 'troller' : null)
    const cannotBeBlocked = viewedUserRole === 'admin' || viewedUserRole === 'troll_officer' || viewedUserRole === 'troller'
    
    if (cannotBeBlocked) {
      toast.error(`Cannot block ${viewedUserRole === 'admin' ? 'admins' : viewedUserRole === 'troll_officer' ? 'troll officers' : 'trollers'}`)
      return
    }
    
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

  const handleMessage = async () => {
    if (!viewed || !user || !profile) return

    // Check if user needs to pay to message (unless sender is admin, troll officer, or troller)
    const senderRole = profile.role
    const senderIsOfficer = profile.is_troll_officer || profile.is_officer
    const senderIsTroller = profile.is_troller
    const senderIsAdmin = senderRole === 'admin' || profile.is_admin

    const canMessageFree = senderIsAdmin || senderIsOfficer || senderIsTroller

    if (!canMessageFree && viewed.profile_view_price && viewed.profile_view_price > 0) {
      // User must pay profile view price to message
      const { data: paymentResult, error: paymentError } = await supabase.rpc('pay_for_profile_view', {
        p_viewer_id: user.id,
        p_profile_owner_id: viewed.id
      })

      if (paymentError || !paymentResult?.success) {
        const errorMsg = paymentResult?.error || paymentError?.message || 'Payment required to message this user'
        toast.error(errorMsg)
        return
      }
    }

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
      // Try multiple bucket names
      let bucketName = 'troll-city-assets'
      let uploadErr = null
      let publicUrl = null
      
      // Try troll-city-assets first
      const uploadResult = await supabase.storage
        .from(bucketName)
        .upload(path, file, { cacheControl: '3600', upsert: false })
      uploadErr = uploadResult.error
      
      // If that fails, try avatars bucket
      if (uploadErr) {
        bucketName = 'avatars'
        const retryResult = await supabase.storage
          .from(bucketName)
          .upload(path, file, { cacheControl: '3600', upsert: false })
        uploadErr = retryResult.error
      }
      
      // If that fails, try public bucket
      if (uploadErr) {
        bucketName = 'public'
        const retryResult = await supabase.storage
          .from(bucketName)
          .upload(path, file, { cacheControl: '3600', upsert: false })
        uploadErr = retryResult.error
      }
      
      if (uploadErr) throw uploadErr
      
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(path)
      publicUrl = urlData.publicUrl
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
  
  // Check if the viewed user is admin, officer, or troller (cannot be blocked)
  const viewedUserRole = viewed?.role || viewed?.is_admin ? 'admin' : 
                         viewed?.is_troll_officer || viewed?.role === 'troll_officer' ? 'troll_officer' :
                         viewed?.is_troller || viewed?.role === 'troller' ? 'troller' : null
  const cannotBeBlocked = viewedUserRole === 'admin' || viewedUserRole === 'troll_officer' || viewedUserRole === 'troller'

  // Filter sections based on whether viewing own profile or another user's
  const allSections = [
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
              
              {!cannotBeBlocked && (
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
              )}
              
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Report User
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
            !isViewingOtherUser && (
              <div className="flex flex-wrap gap-2">
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
                {profile?.empire_role !== 'partner' && (
                  <button
                    onClick={() => navigate('/empire-partner/apply')}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors"
                  >
                    <Crown className="w-4 h-4" />
                    Apply for Empire Partner
                  </button>
                )}
              </div>
            )
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
            <div className="text-gray-400 text-sm">Level</div>
            <div className="text-white text-2xl font-bold">
              {getLevelFromXP((viewed?.xp || profile?.xp) || 0, (viewed?.role || profile?.role) === 'admin')}
            </div>
          </div>
          <div 
            className="bg-[#0D0D0D] rounded-lg p-4 cursor-pointer hover:bg-[#1A1A1A] transition-colors"
            onClick={() => {
              setGiftersModalType('received')
              setShowGiftersModal(true)
            }}
            title="Click to see gifters"
          >
            <div className="text-gray-400 text-sm">Coins Received</div>
            <div className="text-white text-2xl font-bold">{coinsReceived.toLocaleString()}</div>
          </div>
          <div 
            className="bg-[#0D0D0D] rounded-lg p-4 cursor-pointer hover:bg-[#1A1A1A] transition-colors"
            onClick={() => {
              setGiftersModalType('sent')
              setShowGiftersModal(true)
            }}
            title="Click to see recipients"
          >
            <div className="text-gray-400 text-sm">Coins Sent</div>
            <div className="text-white text-2xl font-bold">{coinsSent.toLocaleString()}</div>
          </div>
          <div className="bg-[#0D0D0D] rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Earned</div>
            <div className="text-white text-2xl font-bold">{(viewed?.total_earned_coins || profile?.total_earned_coins || 0).toLocaleString()}</div>
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
          <div className="p-4 bg-[#0D0D0D] rounded-lg border border-purple-600/30">
            <div className="text-white font-semibold mb-3">Profile View Price (coins)</div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={2000}
                value={viewPrice}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(2000, Number(e.target.value || 0)))
                  setViewPrice(val)
                }}
                placeholder="Enter price in coins"
                className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg border border-purple-600 focus:border-purple-400 focus:outline-none"
              />
              <button
                onClick={async () => {
                  if (!profile?.id) {
                    toast.error('Profile not loaded')
                    return
                  }

                  const priceValue = Number(viewPrice)
                  if (isNaN(priceValue) || priceValue < 0) {
                    toast.error('Please enter a valid price (0-2000 coins)')
                    return
                  }

                  try {
                    const { error } = await supabase
                      .from('user_profiles')
                      .update({ 
                        profile_view_price: Math.floor(priceValue), 
                        updated_at: new Date().toISOString() 
                      })
                      .eq('id', profile.id)
                    
                    if (error) {
                      console.error('Error updating profile view price:', error)
                      toast.error(error.message || 'Failed to save profile view price')
                      return
                    }
                    
                    // Update local profile state
                    useAuthStore.getState().setProfile({ 
                      ...(profile as any), 
                      profile_view_price: Math.floor(priceValue) 
                    } as any)
                    
                    toast.success(`Profile view price saved: ${Math.floor(priceValue)} coins`)
                  } catch (err: any) {
                    console.error('Error saving profile view price:', err)
                    toast.error(err?.message || 'Failed to save profile view price')
                  }
                }}
                disabled={isNaN(Number(viewPrice)) || Number(viewPrice) < 0}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Viewers must pay this amount in paid coins to view your profile (max 2000 coins)
            </p>
          </div>
          <button
            onClick={async () => {
              // No confirmation - proceed directly
              const hasEnoughCoins = profile?.paid_coin_balance >= 500;
              const payEarly = hasEnoughCoins; // Auto-pay if user has enough coins
              
              try {
                const { data, error } = await supabase.rpc('delete_user_account', {
                  p_user_id: user?.id,
                  p_pay_early_fee: payEarly || false
                });
                
                if (error) throw error;
                
                if (data?.success) {
                  if (payEarly) {
                    toast.success('Account deleted. You can create a new account immediately.');
                  } else {
                    const cooldownDate = new Date(data.cooldown_until).toLocaleDateString();
                    toast.success(`Account deletion scheduled. You must wait until ${cooldownDate} before creating a new account, or pay $5 to skip.`);
                  }
                  
                  // Sign out and redirect to login
                  await supabase.auth.signOut();
                  useAuthStore.getState().logout();
                  localStorage.clear();
                  sessionStorage.clear();
                  navigate('/auth', { replace: true });
                } else {
                  toast.error(data?.error || 'Failed to delete account');
                }
              } catch (error: any) {
                console.error('Error deleting account:', error);
                toast.error(error?.message || 'Failed to delete account');
              }
            }}
            className="w-full py-2 border border-red-500 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
          >
            Delete Account
          </button>
        </div>
      )
    }
  ]

  // Filter sections: when viewing another user, only show stats and action buttons
  const sections = isViewingOtherUser 
    ? allSections.filter(s => s.id === 'stats' || s.id === 'profile_info')
    : allSections

  console.log('Profile component - profile:', profile, 'user:', user, 'routeUsername:', routeUsername)

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">Loading profile...</div>
          <div className="text-sm text-gray-400">User: {user?.email || 'No user'}</div>
          <div className="text-xs text-gray-500 mt-2">If this persists, try refreshing the page</div>
        </div>
      </div>
    )
  }

  // Show loading state while checking access for viewed profile
  if (viewed && profile.id !== viewed.id && checkingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">Loading profile...</div>
          <div className="text-sm text-gray-400">Checking access permissions...</div>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          {viewed && profile.id !== viewed.id && !hasAccess && !checkingAccess && (
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
          
          {viewed && profile.id !== viewed.id && checkingAccess && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="text-white">Loading...</div>
            </div>
          )}
          
          <div className="bg-[#1A1A1A] rounded-xl p-8 border border-[#2C2C2C] mb-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full overflow-hidden">
                  <img 
                    src={
                      (isViewingOtherUser && viewed?.avatar_url) 
                        ? viewed.avatar_url 
                        : (!isViewingOtherUser && profile?.avatar_url)
                        ? profile.avatar_url
                        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${(viewed?.username || profile?.username || 'user')}`
                    } 
                    alt={`${(viewed?.username || profile?.username || 'User')}'s avatar`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to dicebear if image fails to load
                      const target = e.target as HTMLImageElement
                      target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${(viewed?.username || profile?.username || 'user')}`
                    }}
                  />
                </div>
                {(!viewed || viewed.id === profile.id) && (
                  <button 
                    onClick={triggerAvatarUpload} 
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center border-2 border-[#1A1A1A]"
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                )}
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarUpload} 
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">@{(viewed?.username || profile.username)}</h1>
                    <EmpireBadge empireRole={viewed?.empire_role || profile?.empire_role} />
                  </div>
                  {/* Admin Badge */}
                  {(viewed?.role || profile.role) === 'admin' && (
                    <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      ADMIN
                    </span>
                  )}
                  {/* OG Badge - for early users (created before 2026-01-01) or Level 100 */}
                  {(viewed?.badge === 'og' || profile.badge === 'og' || getLevelFromXP((viewed?.xp || profile.xp) || 0, (viewed?.role || profile.role) === 'admin') === 100) && (
                    <span className="px-2 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold rounded-full flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      OG
                    </span>
                  )}
                </div>
                {/* Tier and Level Display */}
                <div className="mb-2">
                  <div className="text-purple-400 font-semibold text-sm">
                    Level {getLevelFromXP((viewed?.xp || profile.xp) || 0, (viewed?.role || profile.role) === 'admin')} - {getTierFromXP((viewed?.xp || profile.xp) || 0).title}
                  </div>
                  {/* XP Progress Bar */}
                  <XPProgressBar
                    key={(viewed?.xp || profile.xp) || 0}
                    currentXP={(viewed?.xp || profile.xp) || 0}
                    isAdmin={(viewed?.role || profile.role) === 'admin'}
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
        streamId={null as any}
      />
    )}
    
    {viewed && (
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetUserId={viewed.id}
        streamId={null}
        targetType="user"
        onSuccess={() => setShowReportModal(false)}
      />
    )}
    </>
  )
}

