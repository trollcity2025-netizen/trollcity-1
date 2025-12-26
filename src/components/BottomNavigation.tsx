import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, MessageSquare, Store, Video, User } from 'lucide-react'
import { useAuthStore } from '../lib/store'

export default function BottomNavigation() {
  const { user, profile } = useAuthStore()
  const location = useLocation()

  if (!user || !profile) return null

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/live'
    }
    return location.pathname.startsWith(path)
  }

  const navItems = [
    {
      icon: Home,
      label: 'Home',
      path: '/',
      active: isActive('/') || location.pathname === '/live'
    },
    {
      icon: MessageSquare,
      label: 'Messages',
      path: '/messages',
      active: isActive('/messages')
    },
    {
      icon: Store,
      label: 'Buy Coins',
      path: '/store',
      active: isActive('/store') || isActive('/coins')
    },
    {
      icon: Video,
      label: 'Go Live',
      path: '/go-live',
      active: isActive('/go-live')
    },
    {
      icon: User,
      label: 'Profile',
      path: `/profile/${profile?.username || profile?.id}`,
      active: isActive('/profile')
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0D0D0D] border-t border-purple-700/30 z-40 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-0">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-1/5 h-full transition-all active:scale-95 active:opacity-80 ${
                item.active
                  ? 'text-troll-gold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon size={24} className="mb-1" />
              <span className="text-xs font-medium truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
