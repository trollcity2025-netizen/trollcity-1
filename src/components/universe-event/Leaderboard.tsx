import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Participant } from './types'
import { Crown, Medal, User } from 'lucide-react'
import { useAuthStore } from '../../lib/store'
import UserNameWithAge from '../UserNameWithAge'
import { Virtuoso } from 'react-virtuoso'

interface LeaderboardProps {
  tournamentId: string
}

export default function Leaderboard({ tournamentId }: LeaderboardProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          user_profiles:user_id (
            username,
            avatar_url,
            created_at,
            rgb_username_expires_at,
            glowing_username_color,
            is_gold,
            username_style,
            badge
          )
        `)
        .eq('tournament_id', tournamentId)
        .order('points', { ascending: false })
        .limit(100) // Increased limit for scalability, virtualization handles it
  
      if (error) {
        console.error('Error fetching leaderboard:', error)
      } else {
        const mappedData = data.map((p: any, index: number) => ({
          ...p,
          user_profile: p.user_profiles,
          placement: index + 1
        }))
        setParticipants(mappedData)
      }
      setLoading(false)
    }

    fetchLeaderboard()
  }, [tournamentId])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return (
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-500 blur-md opacity-40"></div>
          <Crown className="relative w-6 h-6 text-yellow-400 fill-yellow-400/20 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
        </div>
      )
      case 2: return (
        <div className="relative">
          <Medal className="w-6 h-6 text-gray-300 fill-gray-300/20 drop-shadow-[0_0_5px_rgba(209,213,219,0.5)]" />
        </div>
      )
      case 3: return (
        <div className="relative">
          <Medal className="w-6 h-6 text-amber-700 fill-amber-700/20 drop-shadow-[0_0_5px_rgba(180,83,9,0.5)]" />
        </div>
      )
      default: return <span className="text-lg font-bold text-gray-500 w-6 text-center font-mono">{rank}</span>
    }
  }

  const renderParticipant = (index: number, p: Participant) => {
    const isMe = user?.id === p.user_id
    return (
      <div className="pb-2">
        <div 
          className={`group relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
            isMe 
              ? 'bg-purple-900/20 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)] backdrop-blur-md' 
              : 'bg-black/40 border-white/5 hover:border-purple-500/30 hover:bg-purple-900/10 backdrop-blur-sm'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none" />

          <div className="flex items-center justify-center w-10 shrink-0 relative z-10">
            {getRankIcon(p.placement || 0)}
          </div>
          
          <div className="relative z-10">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center overflow-hidden shrink-0 border-2 ${isMe ? 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'border-white/10 group-hover:border-purple-500/30 transition-colors'}`}>
              {p.user_profile?.avatar_url ? (
                <img src={p.user_profile.avatar_url} alt={p.user_profile.username} className="h-full w-full object-cover" />
              ) : (
                <User className={`h-6 w-6 ${isMe ? 'text-purple-300' : 'text-gray-500'}`} />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 relative z-10">
            <div className="flex items-center gap-2">
              <UserNameWithAge 
                user={{
                   username: p.user_profile?.username || 'Unknown User',
                   id: p.user_id,
                   created_at: p.user_profile?.created_at,
                   rgb_username_expires_at: p.user_profile?.rgb_username_expires_at,
                   glowing_username_color: p.user_profile?.glowing_username_color
                }}
                className={`font-bold truncate text-lg ${isMe ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-white' : 'text-gray-200 group-hover:text-white transition-colors'}`}
              />
              {isMe && (
                <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-bold shadow-[0_0_10px_rgba(168,85,247,0.4)] tracking-wider">
                  YOU
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500/50"></span>
                {p.wins || 0} Wins
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500/50"></span>
                {p.losses || 0} Losses
              </span>
            </div>
          </div>

          <div className="text-right shrink-0 relative z-10">
            <div className="text-2xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 group-hover:from-purple-200 group-hover:to-white transition-all">
              {p.points?.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-purple-400/60 uppercase tracking-widest font-bold">Points</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 h-[600px]">
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-purple-900/10 rounded-lg animate-pulse border border-purple-500/10" />
          ))}
        </div>
      ) : (
        participants.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl bg-black/20">
            <div className="text-gray-500">No participants yet. Be the first to join!</div>
          </div>
        ) : (
          <Virtuoso
            style={{ height: '100%' }}
            data={participants}
            itemContent={renderParticipant}
          />
        )
      )}
    </div>
  )
}
