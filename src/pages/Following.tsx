import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase, UserProfile } from '../lib/supabase'

interface FollowRow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
  following?: UserProfile
}

export default function Following() {
  const { profile } = useAuthStore()
  const [rows, setRows] = useState<FollowRow[]>([])
  const [followers, setFollowers] = useState<FollowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      if (!profile) { setLoading(false); return }
      const { data } = await supabase
        .from('user_follows')
        .select('*, following:user_profiles!user_follows_following_id_fkey(*)')
        .eq('follower_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100)
      setRows(data || [])

      const { data: followerRows } = await supabase
        .from('user_follows')
        .select('*, following:user_profiles!user_follows_follower_id_fkey(*)')
        .eq('following_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100)
      // Remap so we use `following` field to represent the user profile on card
      const mappedFollowers = (followerRows || []).map((r: any) => ({
        ...r,
        following: r.following
      })) as FollowRow[]
      setFollowers(mappedFollowers)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-6">Followers & Following</h1>
        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('following')}
              className={`px-4 py-2 rounded-full text-sm font-medium ${activeTab==='following'?'bg-purple-600 text-white':'bg-[#2C2C2C] text-gray-300 hover:bg-[#3C3C3C]'}`}
            >Following</button>
            <button
              onClick={() => setActiveTab('followers')}
              className={`px-4 py-2 rounded-full text-sm font-medium ${activeTab==='followers'?'bg-purple-600 text-white':'bg-[#2C2C2C] text-gray-300 hover:bg-[#3C3C3C]'}`}
            >Followers</button>
          </div>
          {loading ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[#FFC93C]/20 rounded-full animate-pulse mx-auto mb-4"></div>
              <div className="text-[#FFC93C] font-bold text-xl">Loading connections...</div>
              <div className="text-gray-400 text-sm mt-2">Please wait while we fetch your following list</div>
            </div>
          ) : (
            <>
              {activeTab === 'following' ? (
                rows.length === 0 ? (
                  <div className="text-[#E2E2E2]/70">You are not following anyone yet</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rows.map((r) => (
                      <Link key={r.id} to={`/profile/${r.following?.username}`} className="p-4 bg-[#121212] rounded-lg border border-[#2C2C2C] hover:border-[#00D4FF] transition-colors">
                        <div className="flex items-center gap-3">
                          <img
                            src={r.following?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.following?.username}`}
                            alt={r.following?.username || ''}
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <div className="font-semibold">@{r.following?.username}</div>
                            <div className="text-xs text-[#E2E2E2]/60">Followed {new Date(r.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              ) : (
                followers.length === 0 ? (
                  <div className="text-[#E2E2E2]/70">No one is following you yet</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {followers.map((r) => (
                      <Link key={r.id} to={`/profile/${r.following?.username}`} className="p-4 bg-[#121212] rounded-lg border border-[#2C2C2C] hover:border-[#00D4FF] transition-colors">
                        <div className="flex items-center gap-3">
                          <img
                            src={r.following?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.following?.username}`}
                            alt={r.following?.username || ''}
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <div className="font-semibold">@{r.following?.username}</div>
                            <div className="text-xs text-[#E2E2E2]/60">Followed you {new Date(r.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
