import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, MessageSquare, Store, Video, User, Shield, Gavel, Star, Zap, DollarSign, Users, AlertTriangle, Ban, Settings, Heart } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { motion, AnimatePresence } from 'framer-motion'

export default function BottomNavigation() {
  const { user, profile } = useAuthStore()
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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
    switch (role) {
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

  const navItems = [
    {
      icon: Home,
      label: 'Home',
      path: '/',
      active: isActive('/')
    },
    {
      icon: MessageSquare,
      label: 'Inbox',
      path: '/messages',
      active: isActive('/messages')
    },
    {
      isCenter: true,
      ...centerBtn
    },
    {
      icon: Store, // Or maybe Heart/Support for Viewer? keeping Store/Inbox mapping from user req
      label: 'Create', // User said "Create / Broadcast" for universal category but specific logic for center. 
      // User said "Universal Nav Categories: Home, Live, Create / Broadcast, Inbox, Profile"
      // But then "Role-Based Bottom Nav: Different roles see different center button."
      // Let's stick to the 5 slots: Home, Live (or similar), CENTER, Inbox, Profile.
      // Wait, user said "Home, Live, Create / Broadcast, Inbox, Profile". That's 5.
      // And then "Different roles see different center button."
      // This implies the 3rd one IS the role based one.
      // So: 1. Home, 2. Live, 3. CENTER (Role), 4. Inbox, 5. Profile.
      // Let's adjust.
      // Actually user listed 5 universal categories then said different roles see different center button.
      // Example: Viewer center = "Explore Live".
      // So the mapping is:
      // 1. Home
      // 2. Live (or Search/Browse)
      // 3. CENTER (Role Action)
      // 4. Inbox
      // 5. Profile
      icon: Video, // Placeholder, logic below handles render
      label: 'Live',
      path: '/live', // or browse
      active: isActive('/live')
    },
    {
      icon: User,
      label: 'Profile',
      path: `/profile/${profile?.username || profile?.id}`,
      active: isActive('/profile')
    }
  ]

  // Re-ordering to match: Home, Live, CENTER, Inbox, Profile
  const orderedItems = [
    { icon: Home, label: 'Home', path: '/', active: isActive('/') && location.pathname !== '/live' },
    { icon: Video, label: 'Live', path: '/live', active: isActive('/live') },
    { isCenter: true, ...centerBtn },
    { icon: MessageSquare, label: 'Inbox', path: '/messages', active: isActive('/messages') },
    { icon: User, label: 'Profile', path: `/profile/${profile?.username || profile?.id}`, active: isActive('/profile') }
  ]

  // Popup Menu Options
  const getMenuOptions = () => {
    switch (role) {
      case 'broadcaster':
        return [
          { label: 'Start Stream', icon: Video, path: '/go-live' },
          { label: 'My Earnings', icon: DollarSign, path: '/earnings' },
          { label: 'My Guests', icon: Users, path: '/guests' }
        ]
      case 'admin':
        return [
          { label: 'Court', icon: Gavel, path: '/troll-court' },
          { label: 'Ban User', icon: Ban, path: '/admin/bans' },
          { label: 'System Tools', icon: Settings, path: '/admin/dashboard' }
        ]
      case 'officer':
        return [
          { label: 'Mute User', icon: MicOffIcon, path: '/officer/mute' },
          { label: 'Kick User', icon: AlertTriangle, path: '/officer/kick' },
          { label: 'Report', icon: Shield, path: '/officer/reports' }
        ]
      case 'viewer':
      default:
        return [
          { label: 'Become Broadcaster', icon: Video, path: '/onboarding' },
          { label: 'Buy Coins', icon: Store, path: '/store' },
          { label: 'Support', icon: Heart, path: '/support' }
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
      <nav className="bg-[#0D0D0D] border-t border-purple-700/30 safe-area-bottom shrink-0 z-50">
        <div className="flex items-center justify-around h-16 px-0">
          {orderedItems.map((item, idx) => {
            const Icon = item.icon
            
            if (item.isCenter) {
               return (
                 <button
                   key="center-btn"
                   onClick={item.action}
                   className="flex flex-col items-center justify-center w-1/5 h-full -mt-6"
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

            return (
              <Link
                key={idx}
                to={item.path!}
                className={`flex flex-col items-center justify-center w-1/5 h-full transition-all active:scale-95 active:opacity-80 ${
                  item.active
                    ? 'text-troll-gold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={24} className="mb-1" />
                <span className="text-[10px] font-medium truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Role Action Popup */}
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
              
              <h3 className="text-lg font-bold text-white mb-4 text-center">
                {centerBtn.label} Actions
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {menuOptions.map((opt, i) => {
                  const OptIcon = opt.icon
                  return (
                    <Link
                      key={i}
                      to={opt.path}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                        <OptIcon size={20} />
                      </div>
                      <span className="text-white font-medium">{opt.label}</span>
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
