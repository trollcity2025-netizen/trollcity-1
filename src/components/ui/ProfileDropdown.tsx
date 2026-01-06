import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, 
  Settings, 
  LogOut, 
  Shield, 
  ChevronDown, 
  LayoutDashboard 
} from 'lucide-react'
import { useAuthStore } from '../../lib/store'
import { getTierFromXP } from '../../lib/tierSystem'

interface ProfileDropdownProps {
  onLogout: () => void
  className?: string
}

export default function ProfileDropdown({ onLogout, className }: ProfileDropdownProps) {
  const { profile } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const toggleDropdown = () => setIsOpen(!isOpen)

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!profile) return null

  const tier = profile.tier || getTierFromXP(profile.xp || 0).title
  const isOfficerOrAdmin = ['admin', 'troll_officer', 'lead_troll_officer'].includes(profile.role || '') || profile.is_lead_officer

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all duration-300 group outline-none"
      >
        <div className="text-right hidden md:block">
          <p className={`text-sm font-bold ${profile?.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date() ? 'rgb-username' : 'text-white'}`}>
            {profile.username}
          </p>
          <p className="text-xs text-troll-neon-blue/70 capitalize font-semibold">
            {tier}
          </p>
        </div>
        
        <div className="relative">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-troll-neon-gold to-troll-neon-orange rounded-full flex items-center justify-center shadow-lg shadow-troll-neon-gold/20 border-2 border-troll-neon-gold/50 overflow-hidden group-hover:scale-105 transition-transform duration-300">
            {profile.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.username} 
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-troll-dark-bg font-bold text-lg">
                {profile.username?.[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-[#1A1A1A] rounded-full p-0.5 md:hidden">
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 w-64 bg-[#15151E] border border-troll-neon-purple/30 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl"
          >
            {/* Mobile-only header info */}
            <div className="p-4 border-b border-white/10 md:hidden bg-white/5">
              <p className={`font-bold text-lg ${profile?.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date() ? 'rgb-username' : 'text-white'}`}>
                {profile.username}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-troll-neon-purple/20 text-troll-neon-purple border border-troll-neon-purple/30 capitalize">
                  {tier}
                </span>
                {isOfficerOrAdmin && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 capitalize">
                    {profile.role?.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>

            <div className="p-2 space-y-1">
              <Link 
                to={`/profile/${profile.username}`}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              >
                <User className="w-4 h-4 text-troll-neon-blue" />
                <span>Profile</span>
              </Link>
              
              <Link 
                to="/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4 text-troll-neon-pink" />
                <span>Settings</span>
              </Link>

              {isOfficerOrAdmin && (
                <Link 
                  to="/admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 text-yellow-400" />
                  <span>Admin Panel</span>
                </Link>
              )}
            </div>

            <div className="p-2 border-t border-white/10">
              <button
                onClick={() => {
                  onLogout()
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
