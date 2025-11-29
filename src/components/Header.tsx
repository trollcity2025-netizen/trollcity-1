import React from 'react'
import { Link } from 'react-router-dom'
import { Search, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { getTierFromXP } from '../lib/tierSystem'

const Header = () => {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = React.useState('')

  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const query = searchQuery.trim().replace('@', '')
      
      // Validate alphanumeric only
      if (!/^[a-zA-Z0-9]+$/.test(query)) {
        toast.error('Username can only contain letters and numbers')
        return
      }

      try {
        // Search for user by username
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username')
          .eq('username', query)
          .single()

        if (error || !data) {
          toast.error('User not found')
          return
        }

        // Navigate to user profile
        navigate(`/profile/${data.username}`)
        setSearchQuery('')
      } catch (err) {
        console.error('Search error:', err)
        toast.error('Search failed')
      }
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Logged out successfully')
      useAuthStore.getState().logout()
      
      // FORCE CLEAR ALL APP DATA
      try {
        localStorage.clear()
        sessionStorage.clear()
        
        // Clear all indexed DB
        if (window.indexedDB) {
          const dbs = await window.indexedDB.databases()
          dbs.forEach((db: any) => {
            if (db.name) window.indexedDB.deleteDatabase(db.name)
          })
        }
      } catch (e) {
        console.error('Error clearing storage:', e)
      }
      
      // Force reload to clear memory
      window.location.href = '/auth'
    } catch (error) {
      toast.error('Error logging out')
    }
  }

  const getProfileLink = () => {
    const username = profile?.username
    console.log('getProfileLink - profile.username:', profile?.username, 'final username:', username)
    if (username) {
      return `/profile/${username}`
    }
    return '/profile/setup'
  }

  

  return (
    <header className="h-20 bg-troll-dark-bg/80 border-b border-troll-neon-pink/20 flex items-center justify-between px-8 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-troll-neon-pink/5 via-transparent to-troll-neon-green/5"></div>
      <div className="relative z-10 flex items-center space-x-6 flex-1">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-troll-neon-blue/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Search users (letters and numbers only)..."
            autoComplete="off"
            className="w-full pl-12 pr-6 py-3 bg-troll-dark-card/50 border border-troll-neon-pink/30 rounded-xl text-white placeholder-troll-neon-blue/50 focus:outline-none focus:ring-2 focus:ring-troll-neon-pink focus:border-troll-neon-pink transition-all duration-300 shadow-lg focus:shadow-troll-neon-pink/30"
          />
        </div>
      </div>

      <div className="relative z-10 flex items-center space-x-6">
        <Link 
          to={profile?.username ? `/profile/${profile.username}` : '/profile/me'}
          className={`p-3 text-troll-neon-blue/70 hover:text-troll-neon-green transition-all duration-300 group ${!profile?.username ? 'cursor-not-allowed opacity-50' : ''}`}
          onClick={(e) => {
            // allow navigation even if username not set (routes handle 'me')
          }}
        >
          <User className="w-6 h-6" />
        </Link>

        <div className="flex items-center space-x-4">
          <Link 
            to={getProfileLink()}
            className={`flex items-center space-x-4 hover:scale-105 transition-transform duration-300`}
          >
            <div className="text-right">
              <p className="text-sm font-bold text-white">
                {profile?.username || 'Set up profile'}
              </p>
              <p className="text-xs text-troll-neon-blue/70 capitalize font-semibold">
                {profile?.username ? (profile?.tier || getTierFromXP(profile?.xp || 0).title) : 'Set up profile'}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-troll-neon-gold to-troll-neon-orange rounded-full flex items-center justify-center shadow-lg shadow-troll-neon-gold/50 border-2 border-troll-neon-gold/50 overflow-hidden">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to initial if image fails to load
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <span className={`text-troll-dark-bg font-bold text-lg ${profile?.avatar_url ? 'hidden' : ''}`}>
                {profile?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-bold bg-gradient-to-r from-troll-neon-pink to-troll-neon-purple hover:from-troll-neon-pink/80 hover:to-troll-neon-purple/80 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-troll-neon-pink/50 hover:scale-105"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
