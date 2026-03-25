// src/pages/TrollFamily.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Users, Crown, Search } from 'lucide-react'

interface TrollFamily {
  id: string
  name: string
  description: string
  leader_id: string
  leader_username?: string
  member_count: number
  created_at: string
}

export default function TrollFamily() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [checking, setChecking] = useState(true)
  const [isLeader, setIsLeader] = useState(false)
  const [families, setFamilies] = useState<TrollFamily[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const checkLeadership = async () => {
      if (!user) {
        setChecking(false)
        navigate('/family/browse', { replace: true })
        return
      }

      try {
        const { data: leaderFamily } = await supabase
          .from('troll_families')
          .select('id')
          .eq('leader_id', user.id)
          .maybeSingle()

        setIsLeader(!!leaderFamily)
      } catch (error) {
        console.error('Error checking leadership:', error)
        setIsLeader(false)
      } finally {
        setChecking(false)
      }
    }

    checkLeadership()
  }, [navigate, user])

  // Fetch all families
  useEffect(() => {
    const fetchFamilies = async () => {
      setLoadingFamilies(true)
      try {
        // Fetch all families with member count
        const { data: familiesData, error } = await supabase
          .from('troll_families')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        // Get member counts for each family
        const { data: memberCounts } = await supabase
          .from('family_members')
          .select('family_id')

        const countMap: Record<string, number> = {}
        memberCounts?.forEach((member) => {
          countMap[member.family_id] = (countMap[member.family_id] || 0) + 1
        })

        // Get leader usernames
        const leaderIds = familiesData?.map(f => f.leader_id).filter(Boolean) || []
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', leaderIds)

        const usernameMap: Record<string, string> = {}
        profiles?.forEach(p => {
          usernameMap[p.id] = p.username
        })

        // Combine data
        const familiesWithCounts = familiesData?.map(family => ({
          ...family,
          leader_username: usernameMap[family.leader_id] || 'Unknown',
          member_count: countMap[family.id] || 0
        })) || []

        setFamilies(familiesWithCounts)
      } catch (error) {
        console.error('Error fetching families:', error)
      } finally {
        setLoadingFamilies(false)
      }
    }

    fetchFamilies()
  }, [])

  // Filter families based on search
  const filteredFamilies = families.filter(family =>
    family.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    family.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Troll Families</h1>
          <p className="text-gray-400">Your home away from home in Troll City</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search families..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          {isLeader && (
            <button
              onClick={() => navigate('/family/home')}
              className="flex-1 flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold py-3 px-6 rounded-xl transition-all"
            >
              <Crown className="w-5 h-5" />
              <span>My Family</span>
            </button>
          )}
          {!isLeader && (
            <button
              onClick={() => navigate('/apply/family')}
              className="flex-1 flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold py-3 px-6 rounded-xl transition-all"
            >
              <Users className="w-5 h-5" />
              <span>Create Family</span>
            </button>
          )}
        </div>

        {/* Families Grid */}
        {loadingFamilies ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"></div>
          </div>
        ) : filteredFamilies.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No families found</p>
            {searchTerm && (
              <p className="text-gray-500 text-sm">Try a different search term</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFamilies.map((family) => (
              <div
                key={family.id}
                className="bg-white/10 border border-white/20 rounded-xl p-4 hover:bg-white/20 transition cursor-pointer"
                onClick={() => navigate(`/family/${family.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Crown className="text-amber-400 w-5 h-5" />
                    {family.name}
                  </h3>
                  <span className="text-sm text-gray-400">
                    {family.member_count} members
                  </span>
                </div>
                {family.description && (
                  <p className="text-gray-300 text-sm mb-2">{family.description}</p>
                )}
                <p className="text-gray-500 text-xs">
                  Leader: {family.leader_username}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
