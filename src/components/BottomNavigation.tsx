import { useEffect, useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, MessageSquare, Video, User, Shield, Gavel, Star, DollarSign, Users, AlertTriangle, Ban, Settings, Heart, LogOut, FileText, ShoppingBag, Briefcase, Banknote, Camera, Mic, Menu, X, LogIn, UserPlus } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
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
  const location = useLocation()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [tcpsUnreadCount, setTcpsUnreadCount] = useState(0)
  
  // Mobile message bubble state - only show most recent
  const [recentMessage, setRecentMessage] = useState<RecentMessage | null>(null)
  const [showMessageBubble, setShowMessageBubble] = useState(false)
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Position state for draggable bubble
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 })

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

  // Fetch TCPS unread count
  useEffect(() => {
    if (!user?.id) return
    
    const fetchUnreadCount = async () => {
      const { data } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
      
      if (!data || data.length === 0) return
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
      
      setTcpsUnreadCount(totalCount)
    }
    
    fetchUnreadCount()
    
    const channel = supabase
      .channel('nav-unread-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages' }, () => {
        fetchUnreadCount()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_messages' }, () => {
        fetchUnreadCount()
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // Subscribe to new messages for mobile bubble notification
  useEffect(() => {
    if (!user?.id) return

    // Subscribe to all conversations the user is in
    const subscribeToMessages = async () => {
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (!memberships || memberships.length === 0) return

      const conversationIds = memberships.map(m => m.conversation_id)

      // Create a single channel for all conversations
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
            
            // Only show if it's not from current user and user is a member of this conversation
            if (newMsg.sender_id === user.id) return
            if (!conversationIds.includes(newMsg.conversation_id)) return

            // Fetch sender info
            const { data: sender } = await supabase
              .from('user_profiles')
              .select('username, avatar_url')
              .eq('id', newMsg.sender_id)
              .single()

            // Clear any existing timeout
            if (messageTimeoutRef.current) {
              clearTimeout(messageTimeoutRef.current)
            }

            // Set the recent message (only showing most recent)
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

            // Auto-hide after 8 seconds
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

  // Handle navigating to message from bubble
  const handleMessageBubbleClick = () => {
    if (recentMessage) {
      navigate(`/tcps?user=${recentMessage.sender_id}`)
      setShowMessageBubble(false)
    }
  }

  // Dismiss message bubble
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

  // Handle non-authenticated users - show signup/signin bubble
  if (!user || !profile) {
    return (
      <>
        {/* Draggable Floating Menu Bubble - Mobile Only (Guest) */}
        <motion.div
          drag
          dragMomentum={false}
          dragConstraints={{ left: -window.innerWidth + 80, right: 0, top: -window.innerHeight + 150, bottom: 0 }}
          initial={{ x: 0, y: 0 }}
          animate={{ x: bubblePosition.x, y: bubblePosition.y }}
          onDragEnd={(_, info) => {
            setBubblePosition({ x: info.point.x - window.innerWidth + 70, y: info.point.y - window.innerHeight + 70 })
          }}
          className="fixed bottom-20 right-4 z-[100] md:hidden"
          style={{ touchAction: 'none' }}
        >
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsMenuOpen(true)}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 p-[3px] shadow-[0_0_25px_rgba(124,58,237,0.7)]"
          >
            <div className="w-full h-full rounded-full bg-[#0D0D0D] flex items-center justify-center border border-white/10">
              <Menu size={28} className="text-white" />
            </div>
          </motion.button>
          
          {/* Drag hint */}
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 whitespace-nowrap opacity-60">
            Drag to move
          </div>
        </motion.div>

        {/* Guest Menu Popup */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] md:hidden"
              />
              
              {/* Menu */}
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed top-4 right-4 bottom-4 w-[65vw] max-w-[280px] bg-[#121212] border border-purple-500/30 rounded-2xl p-4 z-[70] md:hidden overflow-y-auto shadow-2xl"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 p-[2px]">
                      <div className="w-full h-full rounded-full bg-[#0D0D0D] flex items-center justify-center">
                        <User size={20} className="text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Welcome</h3>
                      <p className="text-xs text-gray-400">Sign in or join</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <Link
                    to="/auth"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 rounded-xl border border-purple-500/30 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30 transition-colors">
                      <LogIn size={20} />
                    </div>
                    <div className="flex-1">
                      <span className="text-white font-medium text-base block">Sign In</span>
                      <span className="text-gray-400 text-xs">Already have an account?</span>
                    </div>
                  </Link>
                  
                  <Link
                    to="/auth?tab=signup"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 hover:from-green-600/30 hover:to-emerald-600/30 rounded-xl border border-green-500/30 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-green-500/20 text-green-400 group-hover:bg-green-500/30 transition-colors">
                      <UserPlus size={20} />
                    </div>
                    <div className="flex-1">
                      <span className="text-white font-medium text-base block">Sign Up</span>
                      <span className="text-gray-400 text-xs">Create a new account</span>
                    </div>
                  </Link>

                  <div className="pt-2 border-t border-white/10">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">Browse</h4>
                    <div className="grid grid-cols-1 gap-2">
                      <Link
                        to="/live"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors"
                      >
                        <Video size={18} className="text-purple-400" />
                        <span className="text-white text-sm">Live Streams</span>
                      </Link>
                      <Link
                        to="/"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors"
                      >
                        <Home size={18} className="text-blue-400" />
                        <span className="text-white text-sm">Home</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    )
  }

  // Determine Role
  const role = profile.role || 'viewer'

  // Get role display name and icon
  const getRoleInfo = () => {
    switch (role as string) {
      case 'admin':
        return { label: 'Admin', icon: Shield, color: 'from-red-500 to-orange-500' }
      case 'broadcaster':
        return { label: 'Broadcaster', icon: Video, color: 'from-purple-500 to-blue-500' }
      case 'officer':
        return { label: 'Officer', icon: Gavel, color: 'from-blue-500 to-cyan-500' }
      case 'vip':
        return { label: 'VIP', icon: Star, color: 'from-yellow-500 to-amber-500' }
      default:
        return { label: 'Menu', icon: Menu, color: 'from-purple-600 to-blue-600' }
    }
  }

  const roleInfo = getRoleInfo()

  // Menu Options based on role
  const getMenuOptions = () => {
    const baseOptions = [
      { category: 'Navigation', label: 'Home', icon: Home, path: '/' },
      { category: 'Navigation', label: 'Live Streams', icon: Video, path: '/live' },
      { category: 'Navigation', label: 'Messages', icon: MessageSquare, path: '/tcps', badge: tcpsUnreadCount },
      { category: 'Navigation', label: 'My Profile', icon: User, path: `/profile/${profile?.username || profile?.id}` },
    ]

    switch (role as string) {
      case 'broadcaster':
        return [
          ...baseOptions,
          { category: 'Streaming', label: 'Start Stream', icon: Video, path: '/broadcast/setup' },
          { category: 'Streaming', label: 'Stream Summary', icon: FileText, path: '/broadcast/summary' },
          { category: 'Finance', label: 'My Earnings', icon: DollarSign, path: '/earnings' },
          { category: 'Community', label: 'My Guests', icon: Users, path: '/guests' }
        ]
      case 'admin':
        return [
          ...baseOptions,
          { category: 'Management', label: 'Court', icon: Gavel, path: '/troll-court' },
          { category: 'Streaming', label: 'Go Live', icon: Video, path: '/broadcast/setup' },
          { category: 'Management', label: 'Ban Management', icon: Ban, path: '/admin/ban-management' },
          { category: 'Content', label: 'Applications', icon: FileText, path: '/admin/applications' },
          { category: 'Content', label: 'Marketplace', icon: ShoppingBag, path: '/admin/marketplace' },
          { category: 'Content', label: 'Reports', icon: Shield, path: '/admin/officer-reports' },
          { category: 'Finance', label: 'Earnings', icon: DollarSign, path: '/admin/earnings' },
          { category: 'System', label: 'System Tools', icon: Settings, path: '/admin/system/health' }
        ]
      case 'officer':
        return [
          ...baseOptions,
          { category: 'Moderation', label: 'Mute User', icon: MicOffIcon, path: '/officer/mute' },
          { category: 'Moderation', label: 'Kick User', icon: AlertTriangle, path: '/officer/kick' },
          { category: 'Moderation', label: 'Reports', icon: Shield, path: '/officer/reports' },
          { category: 'Lounge', label: 'Officer Lounge', icon: Briefcase, path: '/officer/lounge' },
          { category: 'Finance', label: 'Payroll', icon: Banknote, path: '/officer/payroll' }
        ]
      case 'viewer':
      default:
        return [
          ...baseOptions,
          { category: 'General', label: 'Go Live', icon: Video, path: '/broadcast/setup' },
          { category: 'General', label: 'Store', icon: ShoppingBag, path: '/store' },
          { category: 'Creative', label: 'Troll Pods', icon: Mic, path: '/pods' },
          { category: 'General', label: 'Support', icon: Heart, path: '/support' }
        ]
    }
  }

  // Helper for icons not in top import
  const MicOffIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="1" y1="1" x2="23" y2="23"></line>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
      <line x1="12" y1="19" x2="12" y2="23"></line>
      <line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
  )

  const menuOptions = getMenuOptions()

  return (
    <>
      {/* Draggable Floating Menu Bubble - Mobile Only */}
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={{ left: -window.innerWidth + 80, right: 0, top: -window.innerHeight + 150, bottom: 0 }}
        initial={{ x: 0, y: 0 }}
        animate={{ x: bubblePosition.x, y: bubblePosition.y }}
        onDragEnd={(_, info) => {
          setBubblePosition({ x: info.point.x - window.innerWidth + 70, y: info.point.y - window.innerHeight + 70 })
        }}
        className="fixed bottom-20 right-4 z-[100] md:hidden"
        style={{ touchAction: 'none' }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsMenuOpen(true)}
          className={`w-16 h-16 rounded-full bg-gradient-to-tr ${roleInfo.color} p-[3px] shadow-[0_0_25px_rgba(124,58,237,0.7)]`}
        >
          <div className="w-full h-full rounded-full bg-[#0D0D0D] flex items-center justify-center border border-white/10">
            <roleInfo.icon size={28} className="text-white" />
          </div>
        </motion.button>
        
        {/* Unread indicator bubble */}
        {tcpsUnreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-[#0D0D0D] animate-pulse">
            {tcpsUnreadCount > 9 ? '9+' : tcpsUnreadCount}
          </div>
        )}
        
        {/* Drag hint */}
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 whitespace-nowrap opacity-60">
          Drag to move
        </div>
      </motion.div>

      {/* Role-Based Menu Popup */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] md:hidden"
            />
            
            {/* Menu */}
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-4 right-4 bottom-4 w-[65vw] max-w-[280px] bg-[#121212] border border-purple-500/30 rounded-2xl p-4 z-[70] md:hidden overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${roleInfo.color} p-[2px]`}>
                    <div className="w-full h-full rounded-full bg-[#0D0D0D] flex items-center justify-center">
                      <roleInfo.icon size={20} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{roleInfo.label}</h3>
                    <p className="text-xs text-gray-400">Tap to navigate</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLogout}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-colors"
                    title="Logout"
                  >
                    <LogOut size={18} />
                  </button>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                {Object.entries(
                  menuOptions.reduce((acc: any, opt: any) => {
                    const cat = opt.category || 'General'
                    if (!acc[cat]) acc[cat] = []
                    acc[cat].push(opt)
                    return acc
                  }, {})
                ).map(([category, options]: [string, any]) => (
                  <div key={category}>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">{category}</h4>
                    <div className="grid grid-cols-1 gap-1.5">
                      {options.map((opt: any, i: number) => {
                        const OptIcon = opt.icon
                        return (
                          <Link
                            key={i}
                            to={opt.path}
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors group"
                          >
                            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30 transition-colors">
                              <OptIcon size={18} />
                            </div>
                            <span className="text-white font-medium text-sm flex-1">{opt.label}</span>
                            {opt.badge > 0 && (
                              <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
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
            className="fixed top-20 right-4 left-4 md:left-auto md:w-80 bg-[#1A1A2E] border border-purple-500/30 rounded-2xl p-4 z-[80] shadow-2xl md:hidden cursor-pointer"
            onClick={handleMessageBubbleClick}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <img
                  src={recentMessage.sender_avatar_url || `https://ui-avatars.com/api/?name=${recentMessage.sender_username}&background=random`}
                  alt={recentMessage.sender_username}
                  className="w-12 h-12 rounded-full border-2 border-purple-500/30"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#1A1A2E]" />
              </div>
              
              {/* Message Content */}
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
            
            {/* Progress bar for auto-dismiss */}
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
