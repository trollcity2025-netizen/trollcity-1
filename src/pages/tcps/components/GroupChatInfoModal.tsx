import { useState, useEffect } from 'react'
import { X, Users, LogOut, Crown, Shield } from 'lucide-react'
import { getGroupChatMembers, leaveGroupChat } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'

interface GroupChatInfoModalProps {
  isOpen: boolean
  onClose: () => void
  conversationId: string
  groupName: string
  onLeftGroup: () => void
}

export default function GroupChatInfoModal({ isOpen, onClose, conversationId, groupName, onLeftGroup }: GroupChatInfoModalProps) {
  const { user } = useAuthStore()
  const [members, setMembers] = useState<Array<{ user_id: string; username: string; avatar_url: string | null; role: string; status: string }>>([])
  const [loading, setLoading] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!isOpen || !conversationId) return

    const load = async () => {
      setLoading(true)
      try {
        const data = await getGroupChatMembers(conversationId)
        setMembers(data)
      } catch (err) {
        console.error('Error loading group members:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, conversationId])

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this group? This cannot be undone.')) return

    setLeaving(true)
    try {
      await leaveGroupChat(conversationId)
      toast.success('You left the group')
      onLeftGroup()
      onClose()
    } catch (err: any) {
      console.error('Error leaving group:', err)
      toast.error(err.message || 'Failed to leave group')
    } finally {
      setLeaving(false)
    }
  }

  if (!isOpen) return null

  const activeMembers = members.filter(m => m.status === 'active')
  const pendingMembers = members.filter(m => m.status === 'invited')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#14141F] rounded-2xl border border-purple-500/20 shadow-[0_0_30px_rgba(147,51,234,0.15)] flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-purple-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white truncate">{groupName}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Members */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active members */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Members ({activeMembers.length})
                </h3>
                <div className="space-y-1">
                  {activeMembers.map(m => (
                    <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                      <img
                        src={m.avatar_url || `https://ui-avatars.com/api/?name=${m.username}&background=random`}
                        alt={m.username}
                        className="w-10 h-10 rounded-full border border-purple-500/20"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm truncate">
                            {m.username}
                            {m.user_id === user?.id && <span className="text-gray-500 ml-1">(you)</span>}
                          </span>
                          {m.role === 'owner' && (
                            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                          {m.role === 'admin' && (
                            <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500 capitalize">{m.role}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending invites */}
              {pendingMembers.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Pending ({pendingMembers.length})
                  </h3>
                  <div className="space-y-1">
                    {pendingMembers.map(m => (
                      <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-xl opacity-60">
                        <img
                          src={m.avatar_url || `https://ui-avatars.com/api/?name=${m.username}&background=random`}
                          alt={m.username}
                          className="w-10 h-10 rounded-full border border-yellow-500/20"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-white text-sm truncate">{m.username}</span>
                          <span className="text-[10px] text-yellow-500 block">Invited</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Leave group */}
        <div className="p-4 border-t border-purple-500/20">
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {leaving ? (
              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogOut size={16} />
                Leave Group
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
