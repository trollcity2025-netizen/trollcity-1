import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase, isAdminEmail } from '../../lib/supabase'
import IPBanModal from '../officer/IPBanModal'
import { updateOfficerActivity } from '../../lib/officerActivity'

interface ModerationMenuProps {
  target: { userId: string; username: string; x: number; y: number }
  streamId: string
  onClose: () => void
  onActionComplete: () => void
}

export default function ModerationMenu({ target, streamId, onClose, onActionComplete }: ModerationMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [showIPBanModal, setShowIPBanModal] = useState(false)
  const [targetIP, setTargetIP] = useState<string | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleAction = async (actionType: 'kick' | 'mute' | 'block' | 'report', duration?: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be logged in to perform moderation actions')
        return
      }

      // Get officer profile
      const { data: officerProfile } = await supabase
        .from('user_profiles')
        .select('id, role')
        .eq('id', user.id)
        .single()

      const isAdmin = officerProfile?.role === 'admin' || officerProfile?.is_admin || (user?.email && isAdminEmail(user.email))
      const isOfficer = officerProfile?.role === 'troll_officer' || officerProfile?.is_troll_officer
      
      if (!officerProfile || (!isOfficer && !isAdmin)) {
        toast.error('You do not have permission to perform this action')
        return
      }

      // Record officer action
      const { data: actionData, error: actionError } = await supabase
        .from('officer_actions')
        .insert({
          officer_id: officerProfile.id,
          target_user_id: target.userId,
          action_type: actionType,
          related_stream_id: streamId,
          fee_coins: actionType === 'kick' ? 50 : actionType === 'mute' ? 25 : actionType === 'block' ? 100 : 0,
          metadata: {
            duration,
            username: target.username
          }
        })
        .select()
        .single()

      if (actionError) {
        console.error('Error recording officer action:', actionError)
        toast.error('Failed to record action')
        return
      }

      // Update officer activity (for shift tracking)
      await updateOfficerActivity(officerProfile.id)

      // Perform the actual action
      if (actionType === 'kick') {
        // Kick user from stream (remove from LiveKit room)
        toast.success(`Kicked ${target.username} from the stream`)
      } else if (actionType === 'mute') {
        // Mute user chat for specified duration
        const muteUntil = new Date(Date.now() + (duration || 5 * 60 * 1000))
        await supabase
          .from('user_profiles')
          .update({ 
            no_kick_until: muteUntil.toISOString(),
            // Add mute flag to metadata
          })
          .eq('id', target.userId)
        
        toast.success(`Muted ${target.username} for ${duration ? duration / 60000 : 5} minutes`)
      } else if (actionType === 'block') {
        // Block user for 24 hours
        const blockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await supabase
          .from('user_profiles')
          .update({ no_ban_until: blockUntil.toISOString() })
          .eq('id', target.userId)
        
        toast.success(`Blocked ${target.username} for 24 hours`)
      } else if (actionType === 'report') {
        // File a report
        await supabase
          .from('support_tickets')
          .insert({
            user_id: target.userId,
            type: 'troll_attack',
            description: `Officer report for ${target.username} in stream ${streamId}`,
            metadata: {
              stream_id: streamId,
              reported_by: officerProfile.id,
              action_id: actionData.id
            }
          })
        
        toast.success(`Report filed for ${target.username}`)
      }

      onActionComplete()
      onClose()
    } catch (err) {
      console.error('Error performing moderation action:', err)
      toast.error('Failed to perform action')
    }
  }

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: `${target.y}px`,
    left: `${target.x}px`,
    zIndex: 10000
  }

  return (
    <>
    <div
      ref={menuRef}
      style={menuStyle}
      className="bg-black/95 backdrop-blur-md border-2 border-purple-500 rounded-lg shadow-2xl p-2 min-w-[200px]"
    >
      <div className="text-xs text-purple-300 mb-2 px-2 py-1 border-b border-purple-500/30">
        Moderation: {target.username}
      </div>
      
      <button
        onClick={async () => {
          // Use the new kick system (all users can kick, costs 500 coins)
          try {
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            if (!currentUser) {
              toast.error('You must be logged in')
              return
            }

            // Get current user's profile to check balance
            const { data: kickerProfile } = await supabase
              .from('user_profiles')
              .select('troll_coins')
              .eq('id', currentUser.id)
              .single()

            if (!kickerProfile || kickerProfile.troll_coins < 500) {
              toast.error('You need 500 paid coins to kick a user')
              return
            }

            const { data, error } = await supabase.rpc('kick_user', {
              p_target_user_id: target.userId,
              p_kicker_user_id: currentUser.id,
              p_stream_id: streamId
            })

            if (error) throw error

            if (data?.success) {
              if (data.auto_banned) {
                toast.success(`${target.username} kicked and auto-banned. They must pay $20 to restore.`)
              } else {
                toast.success(`${target.username} kicked! They can pay 250 coins to re-enter.`)
              }
              onActionComplete()
              onClose()
            } else {
              toast.error(data?.error || 'Failed to kick user')
            }
          } catch (err: any) {
            console.error('Error kicking user:', err)
            toast.error(err?.message || 'Failed to kick user')
          }
        }}
        className="w-full text-left px-3 py-2 hover:bg-red-500/20 rounded text-red-400 flex items-center gap-2 transition-colors"
      >
        ❌ Kick User (500 coins)
      </button>
      
      <button
        onClick={() => handleAction('mute', 5 * 60 * 1000)}
        className="w-full text-left px-3 py-2 hover:bg-yellow-500/20 rounded text-yellow-400 flex items-center gap-2 transition-colors"
      >
        🔇 Mute Chat for 5 min
      </button>
      
      <button
        onClick={() => handleAction('block')}
        className="w-full text-left px-3 py-2 hover:bg-orange-500/20 rounded text-orange-400 flex items-center gap-2 transition-colors"
      >
        🚫 Block for 24h
      </button>
      
      <button
        onClick={() => handleAction('report')}
        className="w-full text-left px-3 py-2 hover:bg-purple-500/20 rounded text-purple-400 flex items-center gap-2 transition-colors"
      >
        🐉 Report Troll Attack
      </button>
      
      <button
        onClick={() => {
          // View offense history
          window.open(`/admin/user-history/${target.userId}`, '_blank')
          onClose()
        }}
        className="w-full text-left px-3 py-2 hover:bg-blue-500/20 rounded text-blue-400 flex items-center gap-2 transition-colors"
      >
        🎟 View offense history
      </button>

      <div className="border-t border-purple-500/30 my-2"></div>

      <button
        onClick={async () => {
          // Fetch user's IP address (officers can't see it, but can still ban)
          const { data } = await supabase
            .from('user_profiles')
            .select('last_known_ip')
            .eq('id', target.userId)
            .single()
          
          if (data?.last_known_ip) {
            setTargetIP(data.last_known_ip)
          }
          setShowIPBanModal(true)
        }}
        className="w-full text-left px-3 py-2 hover:bg-red-600/30 rounded text-red-400 flex items-center gap-2 transition-colors font-semibold"
      >
        🚫 Ban IP Address
      </button>
    </div>
    {showIPBanModal && (
      <IPBanModal
        isOpen={showIPBanModal}
        onClose={() => {
          setShowIPBanModal(false)
          setTargetIP(null)
        }}
        onSuccess={() => {
          onActionComplete()
          onClose()
        }}
        targetUserId={target.userId}
        targetUsername={target.username}
        targetIP={targetIP || undefined}
      />
    )}
    </>
  )
}

