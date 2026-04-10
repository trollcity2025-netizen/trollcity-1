import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, MessageSquare, Video, Shield, Gavel, LogOut, FileText, ShoppingBag, Banknote, Mic, Menu, X, LogIn, UserPlus, Trash2, Building2, Landmark, Warehouse, Package, Store, Coins, TrendingUp, Shuffle, Scale, Crown, LifeBuoy, Waves, Globe, Gamepad2, Compass, Lock, BookOpen, Radio, LayoutDashboard, Newspaper, DollarSign, Users, AlertTriangle, Settings, Star, Eye, Siren, ClipboardList, BarChart3, MonitorDot, ScrollText, Calendar, Wallet, Trophy, Bell, Megaphone, Database, Heart } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { useBroadcastLockdown } from '@/hooks/useBroadcastLockdown'
import { usePresidentSystem } from '@/hooks/usePresidentSystem'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, UserRole } from '@/lib/supabase'
import { toast } from 'sonner'

interface RecentMessage {
  id: string
  sender_id: string
  sender_username: string
  sender_avatar_url: string | null
  content: string
  conversation_id: string
  created_at: string
}

export default function BottomNavigation() {
  const { user, profile, logout } = useAuthStore()
  const { isBroadcastLockedDown } = useBroadcastLockdown()
  const { currentElection, finalizeElection, loading } = usePresidentSystem()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [tcpsUnreadCount, setTcpsUnreadCount] = useState(0)
  const [notificationCount, setNotificationCount] = useState(0)
  const totalUnreadCount = tcpsUnreadCount + notificationCount
  
  // Bubble visibility state - always visible by default
  const [isBubbleVisible, setIsBubbleVisible] = useState(true)
  
  // Remove zone state
  const [showRemoveZone, setShowRemoveZone] = useState(false)
  const [isOverRemoveZone, setIsOverRemoveZone] = useState(false)
  
  // Mobile message bubble state - only show most recent
  const [recentMessage, setRecentMessage] = useState<RecentMessage | null>(null)
  const [showMessageBubble, setShowMessageBubble] = useState(false)
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Position state for draggable bubble
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 })
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false)

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Handle keyboard shortcut 'b' to reopen bubble
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if 'b' is pressed and not in an input field
      if (e.key === 'b' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        setIsBubbleVisible(true)
        toast.success('Navigation bubble restored', { duration: 2000 })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('no-scroll')
    } else {
      document.body.classList.remove('no-scroll')
    }
    return () => {
      document.body.classList.remove('no-scroll')
    }
  }, [isMenuOpen])

  // Fetch TCPS unread count - with debounce to prevent excessive requests
  useEffect(() => {
    if (!user?.id) return
    
    let isMounted = true
    let lastFetchTime = 0
    const MIN_FETCH_INTERVAL = 5000 // Only fetch every 5 seconds max
    
    const fetchUnreadCount = async () => {
      const now = Date.now()
      if (now - lastFetchTime < MIN_FETCH_INTERVAL) return
      if (!isMounted) return
      
      lastFetchTime = now
      
      const { data } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
      
      if (!isMounted) return
      
      if (!data || data.length === 0) {
        setTcpsUnreadCount(0)
        return
      }
      const convIds = data.map(d => d.conversation_id)
      
      // Batch count queries to avoid URL length limits
      const BATCH_SIZE = 50
      let totalCount = 0
      
      for (let i = 0; i < convIds.length; i += BATCH_SIZE) {
        const batch = convIds.slice(i, i + BATCH_SIZE)
        const { count } = await supabase
          .from('conversation_messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', batch)
          .neq('sender_id', user.id)
          .is('read_at', null)
        
        totalCount += count || 0
      }
      
      if (isMounted) {
        setTcpsUnreadCount(totalCount)
      }
    }
    
    fetchUnreadCount()
    
    // Build filter for only the user's conversations
    const fetchUserConvs = async () => {
      const { data } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
      return data?.map(d => d.conversation_id) || []
    }
    
    // Subscribe only to the user's conversation messages
    const setupSubscription = async () => {
      const userConvIds = await fetchUserConvs()
      if (!isMounted || userConvIds.length === 0) return
      
      const channel = supabase
        .channel('nav-unread-count')
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: `conversation_id=in.(${userConvIds.join(',')})` }, 
          () => { fetchUnreadCount() }
        )
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'conversation_messages', filter: `conversation_id=in.(${userConvIds.join(',')})` }, 
          () => { fetchUnreadCount() }
        )
        .subscribe()
      
      return channel
    }
    
    const channelPromise = setupSubscription()
    
    return () => {
      isMounted = false
      channelPromise.then(channel => {
        if (channel) supabase.removeChannel(channel)
      })
    }
  }, [user?.id])

  // Fetch notification count
  useEffect(() => {
    if (!user?.id) return
    
    const fetchNotificationCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .is('is_dismissed', null)
      
      setNotificationCount(count || 0)
    }
    
    fetchNotificationCount()
    
    const channel = supabase
      .channel('nav-notification-count')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchNotificationCount()
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchNotificationCount()
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // Subscribe to new messages for mobile bubble notification
  useEffect(() => {
    if (!user?.id) return

    const subscribeToMessages = async () => {
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (!memberships || memberships.length === 0) return

      const conversationIds = memberships.map(m => m.conversation_id)

      const channel = supabase
        .channel('mobile-message-bubble')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversation_messages'
          },
          async (payload) => {
            const newMsg = payload.new as any
            
            if (newMsg.sender_id === user.id) return
            if (!conversationIds.includes(newMsg.conversation_id)) return

            const { data: sender } = await supabase
              .from('user_profiles')
              .select('username, avatar_url')
              .eq('id', newMsg.sender_id)
              .single()

            if (messageTimeoutRef.current) {
              clearTimeout(messageTimeoutRef.current)
            }

            setRecentMessage({
              id: newMsg.id,
              sender_id: newMsg.sender_id,
              sender_username: sender?.username || 'Unknown',
              sender_avatar_url: sender?.avatar_url || null,
              content: newMsg.body,
              conversation_id: newMsg.conversation_id,
              created_at: newMsg.created_at
            })
            setShowMessageBubble(true)

            messageTimeoutRef.current = setTimeout(() => {
              setShowMessageBubble(false)
            }, 8000)
          }
        )
        .subscribe()

      return channel
    }

    let channel: any
    subscribeToMessages().then(ch => { channel = ch })

    return () => {
      if (channel) supabase.removeChannel(channel)
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current)
    }
  }, [user?.id])

  const handleMessageBubbleClick = () => {
    if (recentMessage) {
      navigate(`/tcps?user=${recentMessage.sender_id}`)
      setShowMessageBubble(false)
    }
  }

  const dismissMessageBubble = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMessageBubble(false)
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current)
    }
  }

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  // Handle marking messages/notifications as read
  const handleMessagesClick = async () => {
    // Mark all notifications as read
    if (user?.id && notificationCount > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false)
    }
    
    // Clear local counts immediately for better UX
    setNotificationCount(0)
    setTcpsUnreadCount(0)
    setIsMenuOpen(false)
  }

  const handleLogout = async () => {
    try {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) console.warn('supabase.signOut returned error:', error)
      } catch (e) {
        console.warn('Error signing out session:', e)
      }

      await logout()

      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch (e) {
        console.error('Error clearing storage:', e)
      }

      toast.success('Logged out successfully')
      setIsMenuOpen(false)
      navigate('/exit', { replace: true })
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error logging out')
      navigate('/exit', { replace: true })
    }
  }

  // Handle drag - show remove zone when dragging near bottom
  const handleDrag = useCallback((_: any, info: any) => {
    const windowHeight = window.innerHeight
    const bubbleY = info.point.y
    
    // Show remove zone when within 150px of bottom
    if (bubbleY > windowHeight - 150) {
      setShowRemoveZone(true)
      // Check if over the middle bottom area (remove zone)
      const windowWidth = window.innerWidth
      const bubbleX = info.point.x
      const isInCenter = bubbleX > windowWidth * 0.3 && bubbleX < windowWidth * 0.7
      setIsOverRemoveZone(isInCenter)
    } else {
      setShowRemoveZone(false)
      setIsOverRemoveZone(false)
    }
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback((_: any, info: any) => {
    setIsDragging(false)
    setShowRemoveZone(false)
    
    // If dropped in remove zone, hide the bubble
    if (isOverRemoveZone) {
      setIsBubbleVisible(false)
      toast.success('Navigation hidden. Press "B" to restore', { duration: 3000 })
      setIsOverRemoveZone(false)
      return
    }
    
    setBubblePosition({ 
      x: info.point.x - window.innerWidth + 70, 
      y: info.point.y - window.innerHeight + 70 
    })
  }, [isOverRemoveZone])

  // Determine Role - matches Sidebar.tsx role detection
  const role = profile?.role || 'viewer'
  const isAdmin = profile?.role === UserRole.ADMIN || profile?.troll_role === UserRole.ADMIN || profile?.role === UserRole.HR_ADMIN || (profile as any)?.is_admin;
  const isSecretary = profile?.role === UserRole.SECRETARY || profile?.troll_role === UserRole.SECRETARY;
  const isLead = profile?.role === UserRole.LEAD_TROLL_OFFICER || (profile as any)?.is_lead_troll_officer;
  const isOfficer = profile?.role === UserRole.TROLL_OFFICER || (profile as any)?.is_troll_officer;
  const isPresident = profile?.role === 'president' || profile?.troll_role === 'president' || (profile as any)?.is_president;
  const canSeeCourt = isOfficer || profile?.role === UserRole.LEAD_TROLL_OFFICER || isAdmin;

  const canBroadcast = () => {
    return !isBroadcastLockedDown && (profile?.role === 'broadcaster' || profile?.is_broadcaster || profile?.troll_role === 'broadcaster')
  }

  // Get role display name and icon
  const getRoleInfo = () => {
    if (isAdmin) return { label: 'Admin', icon: Shield, color: 'from-red-500 to-orange-500' }
    if (isLead) return { label: 'Lead Officer', icon: Star, color: 'from-yellow-500 to-amber-500' }
    if (isOfficer) return { label: 'Officer', icon: Gavel, color: 'from-blue-500 to-cyan-500' }
    if (isSecretary) return { label: 'Secretary', icon: ScrollText, color: 'from-pink-500 to-rose-500' }
    if (role === 'broadcaster') return { label: 'Broadcaster', icon: Video, color: 'from-purple-500 to-blue-500' }
    return { label: 'Menu', icon: Menu, color: 'from-purple-600 to-blue-600' }
  }

  const roleInfo = getRoleInfo()

  // Base pages available to all users
  const basePages = [
    // City Center
    { category: 'City Center', label: 'Home', icon: Home, path: '/' },
    { category: 'City Center', label: 'Troll Town', icon: Building2, path: '/trollstown' },
    { category: 'City Center', label: 'Living', icon: Warehouse, path: '/living' },
    { category: 'City Center', label: 'Inventory', icon: Package, path: '/inventory' },
    { category: 'City Center', label: 'Marketplace', icon: Store, path: '/marketplace' },
    { category: 'City Center', label: 'Leaderboard', icon: Trophy, path: '/leaderboard' },
    { category: 'City Center', label: 'Credit Scores', icon: TrendingUp, path: '/credit-scores' },
    { category: 'City Center', label: 'Coin Store', icon: Coins, path: '/store' },
    { category: 'City Center', label: 'Creator Switch', icon: Shuffle, path: '/creator-switch' },
    { category: 'City Center', label: 'Troll Court', icon: Scale, path: '/troll-court' },
    { category: 'City Center', label: 'Troll President', icon: Crown, path: '/president' },
    // Public Services
    { category: 'Public Services', label: 'Jail', icon: Lock, path: '/jail' },
    { category: 'Public Services', label: 'Troll Church', icon: BookOpen, path: '/church' },
    { category: 'Public Services', label: 'Support', icon: LifeBuoy, path: '/support' },
    { category: 'Public Services', label: 'Safety', icon: Shield, path: '/safety' },
    { category: 'Public Services', label: 'Trollified', icon: ShoppingBag, path: '/trollifieds' },
    { category: 'Public Services', label: 'Neighbors', icon: Building2, path: '/neighbors' },
    // Social
    { category: 'Social', label: 'Postal Service', icon: MessageSquare, path: '/tcps', badge: totalUnreadCount, onClick: handleMessagesClick },
    { category: 'Social', label: 'Notifications', icon: Bell, path: '/notifications', badge: notificationCount, onClick: handleMessagesClick },
    { category: 'Social', label: 'Troll Match', icon: Heart, path: '/match' },
    { category: 'Social', label: 'Troll Pods', icon: Mic, path: '/pods' },
    ...(isPresident ? [{ category: 'Social', label: 'President', icon: Crown, path: '/president' }] : []),
    { category: 'Social', label: 'Public Pool', icon: Waves, path: '/pool' },
    { category: 'Social', label: 'Universe Event', icon: Globe, path: '/universe-event' },
    { category: 'Social', label: 'Troll Wheel', icon: Gamepad2, path: '/troll-wheel' },
    // City Registry
    { category: 'City Registry', label: 'Careers', icon: FileText, path: '/application' },
    { category: 'City Registry', label: 'Interview Room', icon: Video, path: '/interview-room' },
    { category: 'City Registry', label: 'Wallet', icon: Banknote, path: '/wallet' },
    { category: 'City Registry', label: 'Appeals', icon: Scale, path: '/city-registry' },
  ]

  // Government Sector pages - shown to officers, lead, secretary, admin
  const governmentPages = []
  if (isOfficer || isSecretary) {
    governmentPages.push({ category: 'Government', label: 'Streams', icon: Radio, path: '/government/streams' })
  }
  if (isOfficer || isSecretary || isAdmin) {
    governmentPages.push({ category: 'Government', label: 'City Government', icon: Landmark, path: '/government' })
  }
  if (canSeeCourt) {
    governmentPages.push({ category: 'Government', label: 'Court Dockets', icon: Gavel, path: '/admin/court-dockets' })
  }
  if (isOfficer) {
    governmentPages.push(
      { category: 'Government', label: 'Officer Dashboard', icon: LayoutDashboard, path: '/officer/dashboard' },
      { category: 'Government', label: 'Officer Lounge', icon: Users, path: '/officer/lounge' },
      { category: 'Government', label: 'Moderation', icon: Eye, path: '/officer/moderation' },
      { category: 'Government', label: 'Scheduling', icon: Calendar, path: '/officer/scheduling' },
      { category: 'Government', label: 'OWC Dashboard', icon: LayoutDashboard, path: '/officer/owc' },
      { category: 'Government', label: 'Officer Payroll', icon: DollarSign, path: '/officer/payroll' },
    )
  }
  if (isLead) {
    governmentPages.push(
      { category: 'Government', label: 'Lead HQ', icon: Star, path: '/lead-officer' },
      { category: 'Government', label: 'Interviews', icon: Video, path: '/admin/interviews' },
      { category: 'Government', label: 'Weekly Reports', icon: BarChart3, path: '/admin/reports/weekly' },
      { category: 'Government', label: 'Creator Approvals', icon: ClipboardList, path: '/admin/creator-approvals' },
    )
  }
  if (isSecretary || isAdmin) {
    governmentPages.push(
      { category: 'Government', label: 'Secretary Console', icon: LayoutDashboard, path: '/secretary' },
      { category: 'Government', label: 'Appeals', icon: ScrollText, path: '/admin/appeals' },
      { category: 'Government', label: 'Manual Orders', icon: FileText, path: '/admin/manual-orders' },
    )
  }
  if ((profile as any)?.is_journalist || (profile as any)?.is_news_caster || (profile as any)?.is_chief_news_caster || isAdmin) {
    governmentPages.push({ category: 'Government', label: 'TCNN Dashboard', icon: Newspaper, path: '/tcnn/dashboard' })
  }

  // Admin pages
  const adminPages = []
  if (isAdmin) {
    adminPages.push(
      // City Management
      { category: 'Admin - City', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
      { category: 'Admin - City', label: 'Control Panel', icon: Settings, path: '/admin/control-panel' },
      { category: 'Admin - City', label: 'City Control', icon: MonitorDot, path: '/admin/system/health' },
      { category: 'Admin - City', label: 'User Search', icon: Users, path: '/admin/user-search' },
      { category: 'Admin - City', label: 'Role Management', icon: Shield, path: '/admin/role-management' },
      { category: 'Admin - City', label: 'Verified Users', icon: Eye, path: '/admin/verified-users' },
      // Moderation
      { category: 'Admin - Moderation', label: 'Ban Management', icon: AlertTriangle, path: '/admin/ban-management' },
      { category: 'Admin - Moderation', label: 'Chat Moderation', icon: MessageSquare, path: '/admin/chat-moderation' },
      { category: 'Admin - Moderation', label: 'Reports Queue', icon: FileText, path: '/admin/reports-queue' },
      { category: 'Admin - Moderation', label: 'Stream Monitor', icon: MonitorDot, path: '/admin/stream-monitor' },
      { category: 'Admin - Moderation', label: 'Critical Alerts', icon: Siren, path: '/admin/critical-alerts' },
      { category: 'Admin - Moderation', label: 'Jail Management', icon: Lock, path: '/admin/jail-management' },
      // Officers
      { category: 'Admin - Officers', label: 'Officer Management', icon: Gavel, path: '/admin/officer-management' },
      { category: 'Admin - Officers', label: 'Officer Shifts', icon: Calendar, path: '/admin/officer-shifts' },
      { category: 'Admin - Officers', label: 'Officer Reports', icon: FileText, path: '/admin/officer-reports' },
      { category: 'Admin - Officers', label: 'Live Officers', icon: MonitorDot, path: '/admin/officers-live' },
      { category: 'Admin - Officers', label: 'Officer Ops', icon: ClipboardList, path: '/admin/officer-operations' },
      // Content
      { category: 'Admin - Content', label: 'Applications', icon: FileText, path: '/admin/applications' },
      { category: 'Admin - Content', label: 'Announcements', icon: Megaphone, path: '/admin/announcements' },
      { category: 'Admin - Content', label: 'Send Notifications', icon: Bell, path: '/admin/send-notifications' },
      { category: 'Admin - Content', label: 'Media Library', icon: Eye, path: '/admin/media-library' },
      { category: 'Admin - Content', label: 'Marketplace Admin', icon: Store, path: '/admin/marketplace' },
      // Finance
      { category: 'Admin - Finance', label: 'Finance', icon: DollarSign, path: '/admin/finance' },
      { category: 'Admin - Finance', label: 'Payouts', icon: Wallet, path: '/admin/payouts' },
      { category: 'Admin - Finance', label: 'Payments', icon: Banknote, path: '/admin/payments' },
      { category: 'Admin - Finance', label: 'Earnings', icon: BarChart3, path: '/admin/earnings' },
      { category: 'Admin - Finance', label: 'Payment Logs', icon: FileText, path: '/admin/payment-logs' },
      { category: 'Admin - Finance', label: 'Cashout Manager', icon: DollarSign, path: '/admin/cashout-manager' },
      { category: 'Admin - Finance', label: 'Grant Coins', icon: Coins, path: '/admin/grant-coins' },
      // System
      { category: 'Admin - System', label: 'Export Data', icon: FileText, path: '/admin/export-data' },
      { category: 'Admin - System', label: 'Policies', icon: FileText, path: '/admin/docs/policies' },
      { category: 'Admin - System', label: 'Errors', icon: AlertTriangle, path: '/admin/errors' },
      { category: 'Admin - System', label: 'Buckets', icon: Database, path: '/admin/buckets' },
      { category: 'Admin - System', label: 'Changelog', icon: ScrollText, path: '/changelog' },
    )
  }

  // Menu Options - Role-based
  const getMenuOptions = () => {
    return [
      ...basePages,
      ...governmentPages,
      ...adminPages,
    ]
  }

  const menuOptions = getMenuOptions()

  return (
    <>
      {/* Full Screen Overlay when menu is open */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[55]"
          />
        )}
      </AnimatePresence>

      {/* Remove Zone - appears when dragging to bottom */}
      <AnimatePresence>
        {showRemoveZone && isDragging && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className={`fixed bottom-0 left-0 right-0 h-32 z-[90] flex items-center justify-center transition-colors ${
              isOverRemoveZone ? 'bg-red-500/40' : 'bg-red-500/20'
            }`}
          >
            <div className={`flex flex-col items-center gap-2 transition-transform ${isOverRemoveZone ? 'scale-110' : 'scale-100'}`}>
              <Trash2 size={32} className={isOverRemoveZone ? 'text-red-300' : 'text-red-400'} />
              <span className={`text-sm font-bold ${isOverRemoveZone ? 'text-red-200' : 'text-red-300'}`}>
                {isOverRemoveZone ? 'Release to Remove' : 'Drag here to hide'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draggable Floating Menu Bubble - Always Visible */}
      <AnimatePresence>
        {isBubbleVisible && isMobile && (
          <motion.div
            initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
            animate={{ scale: 1, opacity: 1, x: bubblePosition.x, y: bubblePosition.y }}
            exit={{ scale: 0, opacity: 0 }}
            drag
            dragMomentum={false}
            dragConstraints={{ left: -window.innerWidth + 80, right: 0, top: -window.innerHeight + 150, bottom: 0 }}
            onDragStart={() => setIsDragging(true)}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className="fixed bottom-20 right-4 z-[100]"
            style={{ touchAction: 'none' }}
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setIsMenuOpen(true)}
              className={`w-14 h-14 rounded-full bg-gradient-to-tr ${roleInfo.color} p-[2px] shadow-[0_0_25px_rgba(124,58,237,0.5)] hover:shadow-[0_0_35px_rgba(124,58,237,0.7)] transition-shadow duration-300`}
            >
              <div className="w-full h-full rounded-full bg-[#0D0D0D] flex items-center justify-center border border-white/[0.08]">
                <roleInfo.icon size={24} className="text-white" />
              </div>
            </motion.button>
            
            {/* Unread indicator bubble */}
            {totalUnreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-[#0D0D0D] animate-pulse">
                {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
              </div>
            )}
            
            {/* Drag hint */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 whitespace-nowrap opacity-60">
              Drag to move
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role-Based Menu Popup - Full Screen */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Full Screen Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/95 backdrop-blur-md z-[60]"
            />
            
            {/* Full Screen Menu */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-[70] overflow-y-auto bg-gradient-to-br from-[#080b14] via-[#0c101f] to-[#080b14]"
            >
              {/* President Tools for Current Presidents */}
              {isPresident && (
                <div className="p-4">
                  <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Crown className="w-5 h-5 text-yellow-400" />
                      President Tools
                    </h3>
                    {currentElection && currentElection.status !== 'finalized' ? (
                      <>
                        <p className="text-slate-400 mb-4">
                          Current election: {currentElection.title || 'Untitled'} - Status: {currentElection.status.toUpperCase()}
                        </p>
                        <button
                          onClick={() => { finalizeElection(currentElection.id); setIsMenuOpen(false); }}
                          disabled={loading}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                        >
                          End Election & Appoint President
                        </button>
                      </>
                    ) : (
                      <p className="text-slate-400 mb-4">
                        No active election. Your dashboard is accessible at /president
                      </p>
                    )}
                  </div>
                </div>
              )}
              {/* Header */}
              <div className="sticky top-0 z-10 bg-[#0a0e1a]/80 backdrop-blur-2xl border-b border-white/[0.06] p-4">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${roleInfo.color} p-[2px] shadow-[0_0_15px_rgba(124,58,237,0.3)]`}>
                      <div className="w-full h-full rounded-[10px] bg-[#0D0D0D] flex items-center justify-center">
                        <roleInfo.icon size={22} className="text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{roleInfo.label}</h3>
                      <p className="text-xs text-slate-500">Tap to navigate</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user && (
                      <button
                        onClick={handleLogout}
                        className="p-2.5 text-red-400/70 hover:text-red-300 hover:bg-red-500/[0.06] rounded-xl transition-colors"
                        title="Logout"
                      >
                        <LogOut size={20} />
                      </button>
                    )}
                    <button
                      onClick={() => setIsMenuOpen(false)}
                      className="p-2.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
                    >
                      <X size={22} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Menu Content */}
              <div className="p-4 max-w-4xl mx-auto">
                {!user ? (
                  // Guest View
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Link
                        to="/auth"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-4 p-5 bg-gradient-to-r from-purple-600/[0.08] to-blue-600/[0.08] hover:from-purple-600/[0.14] hover:to-blue-600/[0.14] rounded-xl border border-purple-500/[0.15] transition-all duration-200 group"
                      >
                        <div className="p-2.5 rounded-lg bg-purple-500/[0.12] text-purple-400 group-hover:bg-purple-500/[0.2] transition-colors">
                          <LogIn size={24} />
                        </div>
                        <div className="flex-1">
                          <span className="text-white font-bold text-base block">Sign In</span>
                          <span className="text-slate-400 text-xs">Already have an account?</span>
                        </div>
                      </Link>

                      <Link
                        to="/auth?tab=signup"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-4 p-5 bg-gradient-to-r from-green-600/[0.08] to-emerald-600/[0.08] hover:from-green-600/[0.14] hover:to-emerald-600/[0.14] rounded-xl border border-green-500/[0.15] transition-all duration-200 group"
                      >
                        <div className="p-2.5 rounded-lg bg-green-500/[0.12] text-green-400 group-hover:bg-green-500/[0.2] transition-colors">
                          <UserPlus size={24} />
                        </div>
                        <div className="flex-1">
                          <span className="text-white font-bold text-base block">Sign Up</span>
                          <span className="text-slate-400 text-xs">Create a new account</span>
                        </div>
                      </Link>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-3 px-1">Browse</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <Link
                          to="/live"
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 p-3.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl border border-white/[0.05] hover:border-white/[0.1] transition-all duration-200"
                        >
                          <Video size={20} className="text-purple-400" />
                          <span className="text-white font-medium text-sm">Live Streams</span>
                        </Link>
                        <Link
                          to="/"
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 p-3.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl border border-white/[0.05] hover:border-white/[0.1] transition-all duration-200"
                        >
                          <Home size={20} className="text-blue-400" />
                          <span className="text-white font-medium text-sm">Home</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Authenticated User View
                  <div className="space-y-6 mt-4">
                    {/* Go Live Button */}
                    <div>
                      {canBroadcast() ? (
                        <Link
                          to="/broadcast/setup"
                          onClick={() => setIsMenuOpen(false)}
                          className="relative flex items-center justify-center gap-3 w-full p-4 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 hover:from-yellow-500 hover:via-yellow-300 hover:to-yellow-500 text-black font-bold rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.5)] transition-all duration-300 hover:scale-[1.02] border border-yellow-200/50"
                        >
                          <Video size={22} className="text-black" />
                          <span className="uppercase tracking-wide text-base">Go Live</span>
                        </Link>
                      ) : (
                        <div className="relative flex items-center justify-center gap-3 w-full p-4 bg-gray-600/50 text-gray-400 font-bold rounded-xl border border-gray-500/30 cursor-not-allowed">
                          <Video size={22} className="text-gray-500" />
                          <span className="uppercase tracking-wide text-base">Go Live</span>
                        </div>
                      )}
                    </div>

                    {/* Explorer Feed */}
                    <div>
                      <Link
                        to="/explore"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-4 p-3.5 bg-gradient-to-r from-indigo-600/[0.1] to-purple-600/[0.1] hover:from-indigo-600/[0.18] hover:to-purple-600/[0.18] rounded-xl border border-indigo-500/[0.2] transition-all duration-200 group"
                      >
                        <div className="p-2.5 rounded-lg bg-indigo-500/[0.12] text-indigo-400 group-hover:bg-indigo-500/[0.2] transition-colors">
                          <Compass size={22} />
                        </div>
                        <div className="flex-1">
                          <span className="text-white font-bold text-sm block">Explorer Feed</span>
                          <span className="text-slate-400 text-xs">Discover new content</span>
                        </div>
                      </Link>
                    </div>

                    {Object.entries(
                      menuOptions.reduce((acc: any, opt: any) => {
                        const cat = opt.category || 'General'
                        if (!acc[cat]) acc[cat] = []
                        acc[cat].push(opt)
                        return acc
                      }, {})
                    ).map(([category, options]: [string, any]) => (
                      <div key={category}>
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-3 px-1">{category}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {options.map((opt: any, i: number) => {
                            const OptIcon = opt.icon
                            return (
                              <Link
                                key={i}
                                to={opt.path}
                                onClick={() => {
                                  if (opt.onClick) {
                                    opt.onClick()
                                  } else {
                                    setIsMenuOpen(false)
                                  }
                                }}
                                className="flex items-center gap-4 p-3.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl border border-white/[0.05] hover:border-white/[0.1] transition-all duration-200 group"
                              >
                                <div className="p-2.5 rounded-lg bg-purple-500/[0.08] text-purple-400 group-hover:bg-purple-500/[0.14] transition-colors">
                                  <OptIcon size={20} />
                                </div>
                                <span className="text-white font-medium text-sm flex-1">{opt.label}</span>
                                {opt.badge > 0 && (
                                  <span className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full">
                                    {opt.badge > 9 ? '9+' : opt.badge}
                                  </span>
                                )}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer hint */}
              <div className="sticky bottom-0 p-4 text-center">
                <p className="text-xs text-gray-600">
                  Press <kbd className="px-2 py-1 bg-white/10 rounded text-gray-400">B</kbd> to restore navigation bubble
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Message Notification Bubble - Only shows most recent message */}
      <AnimatePresence>
        {showMessageBubble && recentMessage && (
          <motion.div
            initial={{ x: 300, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 300, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-20 right-4 left-4 md:left-auto md:w-80 bg-[#1A1A2E] border border-purple-500/30 rounded-2xl p-4 z-[80] shadow-2xl cursor-pointer"
            onClick={handleMessageBubbleClick}
          >
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <img
                  src={recentMessage.sender_avatar_url || `https://ui-avatars.com/api/?name=${recentMessage.sender_username}&background=random`}
                  alt={recentMessage.sender_username}
                  className="w-12 h-12 rounded-full border-2 border-purple-500/30"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#1A1A2E]" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-white text-sm truncate">
                    {recentMessage.sender_username}
                  </h4>
                  <button
                    onClick={dismissMessageBubble}
                    className="text-gray-400 hover:text-white p-1 -mr-1 -mt-1 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-gray-300 text-sm mt-1 line-clamp-2">
                  {recentMessage.content}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Tap to reply
                </p>
              </div>
            </div>
            
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 8, ease: 'linear' }}
              className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-b-2xl origin-left"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
