import React, { useState, useEffect } from 'react'
import { X, Shield, UserPlus, UserMinus, Search, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

interface BroadcastOfficerModalProps {
  streamId: string
  broadcasterId: string
  isOpen: boolean
  onClose: () => void
}

interface BroadcastOfficer {
  id: string
  username: string
  avatar_url: string | null
  assigned_at: string
}

export default function BroadcastOfficerModal({ streamId, broadcasterId, isOpen, onClose }: BroadcastOfficerModalProps) {
  const [officers, setOfficers] = useState<BroadcastOfficer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; avatar_url: string | null }[]>([])
  const [searching, setSearching] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fetchOfficers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('broadcast_officers')
        .select('*')
        .eq('broadcaster_id', broadcasterId)
        .eq('stream_id', streamId)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data && data.length > 0) {
        const userIds = data.map(d => d.officer_id)
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', userIds)

        if (profileError) throw profileError

        const enrichedOfficers = data.map(d => {
          const profile = profiles?.find(p => p.id === d.officer_id)
          return {
            id: d.officer_id,
            username: profile?.username || 'Unknown',
            avatar_url: profile?.avatar_url || null,
            assigned_at: d.created_at
          }
        })
        setOfficers(enrichedOfficers)
      } else {
        setOfficers([])
      }
    } catch (err) {
      console.error('Error fetching officers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && streamId && broadcasterId) {
      fetchOfficers()
    }
  }, [isOpen, streamId, broadcasterId])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .limit(10)

      if (error) throw error
      setSearchResults(data || [])
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleAssignOfficer = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('broadcast_officers')
        .insert({
          broadcaster_id: broadcasterId,
          stream_id: streamId,
          officer_id: userId
        })

      if (error) throw error
      toast.success('Officer assigned to this broadcast')
      setSearchQuery('')
      setSearchResults([])
      fetchOfficers()
    } catch (err: any) {
      console.error('Error assigning officer:', err)
      toast.error(err.message || 'Failed to assign officer')
    }
  }

  const handleRemoveOfficer = async (officerId: string) => {
    if (!confirm('Remove this officer from your broadcast?')) return
    setRemovingId(officerId)
    try {
      const { error } = await supabase
        .from('broadcast_officers')
        .delete()
        .eq('broadcaster_id', broadcasterId)
        .eq('stream_id', streamId)
        .eq('officer_id', officerId)

      if (error) throw error
      toast.success('Officer removed from this broadcast')
      fetchOfficers()
    } catch (err: any) {
      console.error('Error removing officer:', err)
      toast.error(err.message || 'Failed to remove officer')
    } finally {
      setRemovingId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div 
        className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">Broadcast Officers</h3>
              <p className="text-xs text-zinc-400">Manage officers for this stream</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-xs text-blue-300">
              Officers have moderation powers <span className="text-white font-bold">only in this broadcast</span>. 
              They lose access when the stream ends or you remove them.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase">Add Officer</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search users..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden z-10">
                    {searchResults.map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleAssignOfficer(user.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 text-left"
                      >
                        <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center text-xs text-white overflow-hidden">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                          ) : (
                            user.username?.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-white text-sm">{user.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg transition-colors"
              >
                <Search size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-400 uppercase">Current Officers</label>
              <button
                onClick={fetchOfficers}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {loading ? (
              <div className="text-center py-4 text-zinc-500 text-sm">Loading...</div>
            ) : officers.length === 0 ? (
              <div className="text-center py-4 text-zinc-500 text-sm">
                No officers assigned yet
              </div>
            ) : (
              <div className="space-y-2">
                {officers.map(officer => (
                  <div
                    key={officer.id}
                    className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                        {officer.avatar_url ? (
                          <img src={officer.avatar_url} alt={officer.username} className="w-full h-full object-cover" />
                        ) : (
                          officer.username?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">{officer.username}</div>
                        <div className="text-[10px] text-zinc-500">
                          Added {new Date(officer.assigned_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveOfficer(officer.id)}
                      disabled={removingId === officer.id}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <UserMinus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}