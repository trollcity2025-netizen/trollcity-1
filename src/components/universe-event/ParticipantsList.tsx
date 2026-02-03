import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Participant } from './types'
import { Input } from '../ui/input'
import { Search, User } from 'lucide-react'
import { Card, CardContent } from '../ui/card'

interface ParticipantsListProps {
  tournamentId: string
}

export default function ParticipantsList({ tournamentId }: ParticipantsListProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'eliminated'>('all')

  useEffect(() => {
    const fetchParticipants = async () => {
      setLoading(true)
      // Fetch participants with user profile
      // Note: Assuming user_profiles is the table name for profiles. 
      // If public_profiles exists as per prompt, we might need to adjust, 
      // but usually joining on user_profiles (or whatever the relation is) is needed.
      // The prompt says "tournament_participants join public_profiles (safe view)".
      // I'll try to join user_profiles first as it's more standard in Supabase setups usually unless specified otherwise.
      // Wait, prompt says: "If public_profiles view exists, use it. If not, use safe columns from user_profiles".
      // I'll try to select from user_profiles first.
      
      const { data, error } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          user_profiles:user_id (
            username,
            avatar_url,
            created_at
          )
        `)
        .eq('tournament_id', tournamentId)
  
      if (error) {
        console.error('Error fetching participants:', error)
      } else {
        // Map data to match Participant interface
        const mappedData = data.map((p: any) => ({
          ...p,
          user_profile: p.user_profiles
        }))
        // Filter out withdrawn participants immediately
        const activeParticipants = mappedData.filter((p: any) => {
           const isWithdrawn = p.status === 'withdrawn' || p.stats?.withdrawn === true
           return !isWithdrawn
        })
        setParticipants(activeParticipants)
      }
      setLoading(false)
    }

    fetchParticipants()
  }, [tournamentId])

  const filteredParticipants = participants.filter(p => {
    const username = p.user_profile?.username || ''
    const matchesSearch = username.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || p.status === filter
    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-6">
      <div className="flex gap-4 flex-col sm:flex-row">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
          <Input 
            disabled={false}
            placeholder="Search participants..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-black/40 border-purple-500/30 text-white placeholder:text-gray-500 focus:border-purple-500 focus:shadow-[0_0_15px_rgba(147,51,234,0.3)] transition-all"
          />
        </div>
        <select 
          className="bg-black/40 border border-purple-500/30 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:shadow-[0_0_15px_rgba(147,51,234,0.3)] transition-all"
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="eliminated">Eliminated</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <div className="text-gray-400 animate-pulse">Loading participants...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredParticipants.map((p) => (
            <Card key={p.user_id} className="bg-black/60 border-purple-500/20 hover:border-purple-500/50 hover:bg-black/80 hover:shadow-[0_0_20px_rgba(147,51,234,0.15)] transition-all duration-300 group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-purple-900/30 flex items-center justify-center overflow-hidden border-2 border-purple-500/30 group-hover:border-purple-400 group-hover:shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all shrink-0">
                  {p.user_profile?.avatar_url ? (
                    <img src={p.user_profile.avatar_url} alt={p.user_profile.username} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-6 w-6 text-purple-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <UserNameWithAge 
                    user={{
                      username: p.user_profile?.username || 'Unknown User',
                      id: p.user_id,
                      created_at: (p.user_profile as any)?.created_at
                    }}
                    className="font-bold text-white truncate text-lg group-hover:text-purple-300 transition-colors"
                  />
                  <div className="text-xs text-gray-400 flex gap-2 items-center mt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_5px_rgba(34,197,94,0.2)]' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {(p.status || 'Active')}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className="text-gray-300 font-medium">Wins: <span className="text-white">{p.wins || 0}</span></span>
                  </div>
                </div>
                <div className="text-right shrink-0 bg-purple-900/10 p-2 rounded-lg border border-purple-500/10 group-hover:border-purple-500/30 transition-colors">
                  <div className="text-xl font-black text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]">{p.points || 0}</div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest">Pts</div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredParticipants.length === 0 && (
             <div className="col-span-full text-center py-16 border border-dashed border-gray-800 rounded-2xl bg-black/20">
               <User className="w-12 h-12 text-gray-700 mx-auto mb-3" />
               <p className="text-gray-500 font-medium">No participants found matching your criteria.</p>
             </div>
          )}
        </div>
      )}
    </div>
  )
}
