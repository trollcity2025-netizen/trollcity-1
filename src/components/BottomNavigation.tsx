import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, MessageSquare, Store, Video, User, Shield, Gavel, Star, Zap, DollarSign, Users, AlertTriangle, Ban, Settings, Heart, LogOut, FileText, ShoppingBag, Briefcase, Banknote, Gamepad2, Music, Swords, Camera, Gift } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useGameNavigate } from './game/GameNavigation'

export default function BottomNavigation() {
  const { user, profile, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const gameNavigate = useGameNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLiveMenuOpen, setIsLiveMenuOpen] = useState(false)

  useEffect(() => {
    if (isMenuOpen || isLiveMenuOpen) {
      document.body.classList.add('no-scroll')
    } else {
      document.body.classList.remove('no-scroll')
    }
    return () => {
      document.body.classList.remove('no-scroll')
    }
  }, [isMenuOpen, isLiveMenuOpen])

  useEffect(() => {
    setIsMenuOpen(false)
    setIsLiveMenuOpen(false)
  }, [location.pathname])

  const liveCategories = [
    { label: 'All Streams', icon: Video, path: '/live' },
    { label: 'Just Chatting', icon: MessageSquare, path: '/live/just-chatting' },
    { label: 'Gaming', icon: Gamepad2, path: '/live/gaming' },
    { label: 'Music', icon: Music, path: '/live/music' },
    { label: 'Battles', icon: Swords, path: '/live/battles' },
    { label: 'IRL', icon: Camera, path: '/live/irl' }
  ]

  const handleLogout = async () => {
    try {
      // Check for active session first
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData?.session) {
          await supabase.auth.signOut()
        }
      } catch (e) {
        console.warn('Error checking/signing out session:', e)
      }

      logout() // Clear store state

      // Clear client storage
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch (e) {
        console.error('Error clearing storage:', e)
      }

      toast.success('Logged out successfully')
      setIsMenuOpen(false)
      navigate('/exit')
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error logging out')
    }
  }

  if (!user || !profile) return null

  // Determine Role
  const role = profile.role || 'viewer' // viewer, broadcaster, admin, officer, vip

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/live'
    }
    return location.pathname.startsWith(path)
  }

  // Define Center Button based on Role
  const getCenterButton = () => {
    switch (role as string) {
      case 'admin':
        return { label: 'Admin Panel', icon: Shield, action: () => setIsMenuOpen(true) }
      case 'broadcaster':
        return { label: 'Go Live', icon: Video, action: () => setIsMenuOpen(true) }
      case 'officer':
        return { label: 'Moderation', icon: Gavel, action: () => setIsMenuOpen(true) }
      case 'vip':
        return { label: 'Talent Tools', icon: Star, action: () => setIsMenuOpen(true) }
      default: // viewer
        return { label: 'Explore Live', icon: Zap, action: () => setIsMenuOpen(true) }
    }
  }

  const centerBtn = getCenterButton()

  // Re-ordering to match: Home, Live, CENTER, Inbox, Profile
  const orderedItems: any[] = [
    { icon: Home, label: 'Home', path: '/', active: isActive('/') && location.pathname !== '/live' },
    { 
      icon: Video, 
      label: 'Live', 
      path: '/live',
      action: () => setIsLiveMenuOpen(true), 
      active: isActive('/live') || isLiveMenuOpen 
    },
    { isCenter: true, ...centerBtn },
    { icon: MessageSquare, label: 'TCPS', path: '/tcps', active: isActive('/tcps') },
    { icon: User, label: 'Profile', path: `/profile/${profile?.username || profile?.id}`, active: isActive('/profile') }
  ]

  // Popup Menu Options
  const getMenuOptions = () => {
    switch (role as string) {
      case 'broadcaster':
        return [
          { category: 'Streaming', label: 'Start Stream', icon: Video, path: '/go-live' },
          { category: 'Streaming', label: 'Summary', icon: FileText, path: '/broadcast-summary' },
          { category: 'Finance', label: 'My Earnings', icon: DollarSign, path: '/earnings' },
          { category: 'Community', label: 'My Guests', icon: Users, path: '/guests' }
        ]
      case 'admin':
        return [
          { category: 'Management', label: 'Court', icon: Gavel, path: '/troll-court' },
          { category: 'Management', label: 'Ban User', icon: Ban, path: '/admin/bans' },
          { category: 'Content', label: 'Applications', icon: FileText, path: '/admin/applications' },
          { category: 'Content', label: 'Marketplace', icon: ShoppingBag, path: '/admin/marketplace' },
          { category: 'Content', label: 'Reports', icon: Shield, path: '/admin/officer-reports' },
          { category: 'Finance', label: 'Earnings', icon: DollarSign, path: '/admin/earnings' },
          { category: 'System', label: 'System Tools', icon: Settings, path: '/admin/dashboard' }
        ]
      case 'officer':
        return [
          { category: 'Moderation', label: 'Mute User', icon: MicOffIcon, path: '/officer/mute' },
          { category: 'Moderation', label: 'Kick User', icon: AlertTriangle, path: '/officer/kick' },
          { category: 'Moderation', label: 'Report', icon: Shield, path: '/officer/reports' },
          { category: 'Lounge', label: 'Officer Lounge', icon: Briefcase, path: '/officer/lounge' },
          { category: 'Finance', label: 'Payroll', icon: Banknote, path: '/officer/payroll' }
        ]
      case 'viewer':
      default:
        return [
          { category: 'General', label: 'Go Live', icon: Video, path: '/go-live' },
          { category: 'General', label: 'Buy Coins', icon: Store, path: '/store' },
          { category: 'Creative', label: 'TrollG Studio', icon: Gift, path: '/trollg' },
          { category: 'General', label: 'Support', icon: Heart, path: '/support' }
        ]
    }
  }

  // Helper for icons not in top import
  const MicOffIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
  )

  const menuOptions = getMenuOptions()

  return (
    <>
      <nav className="bottom-nav bg-[#0D0D0D] border-t border-purple-700/30">
        <div className="bottom-nav-inner flex items-center justify-around px-0">
          {orderedItems.map((item: any, idx) => {
            const Icon = item.icon
            
            if (item.isCenter) {
               return (
                 <button
                   key="center-btn"
                   onClick={item.action}
                   className="flex flex-col items-center justify-center w-1/5 h-full -mt-4"
                 >
                   <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 p-[2px] shadow-[0_0_15px_rgba(124,58,237,0.5)]">
                     <div className="w-full h-full rounded-full bg-[#0D0D0D] flex items-center justify-center hover:bg-[#1a1a1a] transition-colors">
                       <Icon size={24} className="text-white" />
                     </div>
                   </div>
                   <span className="text-[10px] font-bold mt-1 text-purple-400">{item.label}</span>
                 </button>
               )
            }

            if (item.action) {
               return (
                 <button
                   key={idx}
                   onClick={item.action}
                   className={`flex flex-col items-center justify-center w-1/5 h-full transition-all active:scale-95 active:opacity-80 ${
                     item.active
                       ? 'text-troll-gold'
                       : 'text-gray-400 hover:text-gray-200'
                   }`}
                 >
                   <Icon size={24} className="mb-1" />
                   <span className="text-[10px] font-medium truncate">{item.label}</span>
                 </button>
               )
            }

            return (
              <button
                key={idx}
                onClick={() => gameNavigate(item.path!)}
                className={`flex flex-col items-center justify-center w-1/5 h-full transition-all active:scale-95 active:opacity-80 ${
                  item.active
                    ? 'text-troll-gold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={24} className="mb-1" />
                <span className="text-[10px] font-medium truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Role Action Popup */}
      <AnimatePresence>
        {isLiveMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLiveMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-[#121212] border-t border-purple-500/30 rounded-t-3xl p-6 z-[70] safe-area-bottom"
            >
              <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Live Categories</h3>
                <button
                  onClick={() => setIsLiveMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <Ban size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {liveCategories.map((cat, i) => {
                  const CatIcon = cat.icon
                  return (
                    <Link
                      key={i}
                      to={cat.path}
                      onClick={() => setIsLiveMenuOpen(false)}
                      className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors gap-2"
                    >
                      <div className="p-3 rounded-full bg-purple-500/20 text-purple-400">
                        <CatIcon size={24} />
                      </div>
                      <span className="text-white font-medium text-sm">{cat.label}</span>
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            
            {/* Menu */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-[#121212] border-t border-purple-500/30 rounded-t-3xl p-6 z-[70] safe-area-bottom"
            >
              <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white text-center flex-1">
                  {centerBtn.label} Actions
                </h3>
                <button
                  onClick={handleLogout}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                {Object.entries(
                  menuOptions.reduce((acc: any, opt: any) => {
                    const cat = opt.category || 'General'
                    if (!acc[cat]) acc[cat] = []
                    acc[cat].push(opt)
                    return acc
                  }, {})
                ).map(([category, options]: [string, any]) => (
                  <div key={category}>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">{category}</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {options.map((opt: any, i: number) => {
                        const OptIcon = opt.icon
                        return (
                          <Link
                            key={i}
                            to={opt.path}
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-4 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors"
                          >
                            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                              <OptIcon size={18} />
                            </div>
                            <span className="text-white font-medium text-sm">{opt.label}</span>
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
    </>
  )
}
