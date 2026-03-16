import React, { useEffect, useState } from 'react'
import { X, Gavel, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { normalizeTextArray } from '../lib/courtUtils'

// Stream type for the stream-based interface
interface StreamRow {
  id: string
  broadcaster_id: string
  user_id?: string
  title?: string
  broadcaster?: {
    username: string
    avatar_url: string
  }
}

interface StreamParticipant {
  user_id: string
  guest_id?: string | null
  username: string
  avatar_url?: string
  is_active: boolean
  summonable?: boolean
}

// Props for user-based interface (from ClickableUsername)
interface SummonModalUserProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  username: string
}

// Props for stream-based interface (from GovernmentStreams)
interface SummonModalStreamProps {
  stream: StreamRow
  onClose: () => void
}

// Union type - component accepts either interface
type SummonModalProps = SummonModalUserProps | SummonModalStreamProps

// Helper to check which interface is being used
function isUserProps(props: SummonModalProps): props is SummonModalUserProps {
  return 'userId' in props && 'username' in props
}

export default function SummonModal(props: SummonModalProps) {
  const { profile } = useAuthStore()
  const [participants, setParticipants] = useState<StreamParticipant[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [reason, setReason] = useState('Disorderly Conduct')
  const [submitting, setSubmitting] = useState(false)

  // For user-based interface
  const isUserMode = isUserProps(props)
  
  // Don't render if not open (for user mode)
  if (isUserMode && !props.isOpen) return null

  // Get stream for stream-based mode
  const stream = isUserMode ? null : (props as SummonModalStreamProps).stream
  
  // For user mode, we directly have the user
  const targetUserId = isUserMode ? props.userId : ''
  const targetUsername = isUserMode ? props.username : ''

  const handleSummon = async () => {
    const canSummon =
      profile?.is_admin === true ||
      profile?.is_troll_officer === true ||
      profile?.is_lead_officer === true ||
      ['admin', 'troll_officer', 'lead_troll_officer'].includes(String(profile?.role || ''))

    if (!canSummon) {
      toast.error('Only Admin, Troll Officer, or Lead Troll Officer can issue summons.')
      return
    }

    let userIdToSummon: string
    let reasonText: string

    if (isUserMode) {
      // Direct user summon
      userIdToSummon = props.userId
      reasonText = reason
    } else {
      // Stream-based summon - need to select a user
      if (!selectedUserId) {
        toast.error('Please select a user')
        return
      }
      const selected = participants.find((p) => p.user_id === selectedUserId)
      if (!selected?.summonable) {
        toast.error('Guest users cannot be summoned. Select a registered user.')
        return
      }
      userIdToSummon = selectedUserId
      reasonText = reason
    }

    setSubmitting(true)
    try {
      let docketDescription: string
      if (isUserMode) {
        docketDescription = `Direct summon for @${props.username}`
      } else {
        docketDescription = `Government control stream ${stream?.id}`
      }

      const { data, error } = await supabase.rpc('summon_user_to_court', {
        p_defendant_id: userIdToSummon,
        p_reason: reasonText,
        p_users_involved: normalizeTextArray([docketDescription]),
        p_docket_id: null
      })

      if (error) {
        console.error('Summon error:', error)
        throw error
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to issue summon')
      }

      toast.success('Summon issued and docketed successfully')
      props.onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(`Failed to summon user: ${err.message || 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  // For user mode, show simpler UI
  if (isUserMode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-[#1a1a1a] w-full max-w-md p-6 rounded-2xl border border-orange-500/30 shadow-[0_0_50px_rgba(249,115,22,0.1)]">
          <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-900/20 p-2 rounded-lg border border-orange-500/20">
                <Gavel className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Summon to Court</h3>
                <p className="text-xs text-gray-400">Issue a court summons</p>
              </div>
            </div>
            <button onClick={props.onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* User Info */}
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="w-10 h-10 rounded-full bg-orange-900/30 flex items-center justify-center border border-orange-500/30">
                <User className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Summoning</p>
                <p className="font-bold text-white">@{targetUsername}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Reason</label>
              <select 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-orange-500 outline-none"
              >
                <option value="Disorderly Conduct">Disorderly Conduct</option>
                <option value="Hate Speech">Hate Speech</option>
                <option value="Harassment">Harassment</option>
                <option value="Trolling without License">Trolling without License</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button
              onClick={handleSummon}
              disabled={submitting}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-900/20 mt-4 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Issuing Summons...
                </>
              ) : (
                <>
                  <Gavel className="w-4 h-4" />
                  Issue Summons
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Stream-based mode (original GovernmentStreams implementation)
  // Note: This is kept for backward compatibility but the component is now inlined in GovernmentStreams
  // This branch would only be hit if stream prop is passed but isUserMode is true somehow
  return null
}

// Also export the stream-based version for compatibility
export { SummonModal as SummonModalStream }
