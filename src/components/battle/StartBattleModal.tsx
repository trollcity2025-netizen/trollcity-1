import React, { useState, useEffect } from 'react'
import { X, Search, Shuffle, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { startTrollBattle } from '../../lib/battleHelpers'

interface StartBattleModalProps {
  isOpen: boolean
  onClose: () => void
  onBattleStarted: (battleId: string) => void
  currentStreamId: string
}

export default function StartBattleModal({
  isOpen,
  onClose,
  onBattleStarted,
  currentStreamId,
}: StartBattleModalProps) {
  const { profile, user } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [availableBroadcasters, setAvailableBroadcasters] = useState<any[]>([])
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (isOpen && searchQuery.length > 0) {
      searchBroadcasters()
    } else {
      setAvailableBroadcasters([])
    }
  }, [searchQuery, isOpen])

  const searchBroadcasters = async () => {
    if (!user || !profile) return
    
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, role')
        .or(`role.eq.broadcaster,role.eq.admin`)
        .neq('id', user.id)
        .ilike('username', `%${searchQuery}%`)
        .limit(10)

      if (error) throw error
      setAvailableBroadcasters(data || [])
    } catch (err: any) {
      console.error('Error searching broadcasters:', err)
      toast.error('Failed to search broadcasters')
    } finally {
      setSearching(false)
    }
  }

  const findRandomOpponent = async () => {
    if (!user || !profile) return
    
    setLoading(true)
    try {
      // Find active broadcasters
      const { data: activeStreams, error: streamsError } = await supabase
        .from('streams')
        .select('broadcaster_id, user_profiles!inner(id, username, avatar_url)')
        .eq('status', 'live')
        .neq('broadcaster_id', user.id)
        .limit(10)

      if (streamsError) throw streamsError

      if (!activeStreams || activeStreams.length === 0) {
        toast.error('No active broadcasters available for battle')
        return
      }

      // Pick random opponent
      const randomIndex = Math.floor(Math.random() * activeStreams.length)
      const opponent = activeStreams[randomIndex]
      
      await startBattle(opponent.broadcaster_id, opponent.id)
    } catch (err: any) {
      console.error('Error finding random opponent:', err)
      toast.error('Failed to find opponent')
    } finally {
      setLoading(false)
    }
  }

  const startBattle = async (opponentId: string, opponentStreamId?: string) => {
    if (!user || !profile || !currentStreamId) return

    setLoading(true)
    try {
      // Use edge function to start battle
      const battle = await startTrollBattle(opponentId, currentStreamId, opponentStreamId)

      // Notify opponent (optional - could use notifications table)
      const { data: opponent } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', opponentId)
        .single()

      toast.success(`Battle started with @${opponent?.username || 'opponent'}!`)
      onBattleStarted(battle.id)
      onClose()
    } catch (err: any) {
      console.error('Error starting battle:', err)
      toast.error(err.message || 'Failed to start battle')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectOpponent = async (opponentId: string) => {
    // Find opponent's active stream
    const { data: opponentStream } = await supabase
      .from('streams')
      .select('id')
      .eq('broadcaster_id', opponentId)
      .eq('status', 'live')
      .single()

    await startBattle(opponentId, opponentStream?.id || undefined)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-troll-dark-bg border-2 border-troll-neon-blue rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Start Troll Battle</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-gray-400 mb-6">
          Challenge another broadcaster to a 2-minute battle! Only paid coins count toward victory.
        </p>

        {/* Random Match */}
        <button
          onClick={findRandomOpponent}
          disabled={loading}
          className="w-full mb-4 px-4 py-3 bg-troll-neon-blue hover:bg-troll-neon-green text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Shuffle className="w-5 h-5" />
          {loading ? 'Finding opponent...' : 'Random Match'}
        </button>

        <div className="text-center text-gray-500 mb-4">OR</div>

        {/* Search Opponent */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for broadcaster..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-troll-neon-blue"
            />
          </div>
        </div>

        {/* Search Results */}
        {searching && (
          <div className="text-center text-gray-400 py-4">Searching...</div>
        )}

        {!searching && availableBroadcasters.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {availableBroadcasters.map((broadcaster) => (
              <button
                key={broadcaster.id}
                onClick={() => handleSelectOpponent(broadcaster.id)}
                disabled={loading}
                className="w-full px-4 py-3 bg-black/50 hover:bg-black/70 border border-gray-700 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                {broadcaster.avatar_url && (
                  <img
                    src={broadcaster.avatar_url}
                    alt={broadcaster.username}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="flex-1 text-left">
                  <div className="text-white font-semibold">@{broadcaster.username}</div>
                  <div className="text-xs text-gray-400">{broadcaster.role}</div>
                </div>
                <Users className="w-5 h-5 text-troll-neon-blue" />
              </button>
            ))}
          </div>
        )}

        {!searching && searchQuery.length > 0 && availableBroadcasters.length === 0 && (
          <div className="text-center text-gray-400 py-4">No broadcasters found</div>
        )}
      </div>
    </div>
  )
}

