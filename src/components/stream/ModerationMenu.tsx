import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
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

  const fetchOfficerContext = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getUser()
    const currentUser = sessionData.user
    if (!currentUser) {
      throw new Error('You must be signed in to take this action')
    }

    const { data: officerProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, is_troll_officer, is_admin')
      .eq('id', currentUser.id)
      .single()

    if (profileError || !officerProfile) {
      throw new Error(profileError?.message || 'Unable to load your officer profile')
    }

    const isAdmin =
      officerProfile.role === 'admin' || officerProfile.is_admin === true
    const isOfficer =
      officerProfile.is_troll_officer === true ||
      officerProfile.role === 'troll_officer'

    if (!isAdmin && !isOfficer) {
      throw new Error('Officer access required')
    }

    return { currentUser, officerProfile }
  }, [])

  const recordOfficerAction = useCallback(
    async (
      officerId: string,
      actionType: string,
      opts: {
        fee_coins?: number
        metadata?: Record<string, any>
        action_subtype?: string | null
      } = {}
    ) => {
      try {
        await supabase.from('officer_actions').insert({
          officer_id: officerId,
          target_user_id: target.userId,
          action_type: actionType,
          related_stream_id: streamId || null,
          fee_coins: opts.fee_coins || 0,
          metadata: {
            username: target.username,
            ...opts.metadata,
          },
          action_subtype: opts.action_subtype || null,
        })
        await updateOfficerActivity(officerId)
      } catch (err) {
        console.error('Failed to log officer action:', err)
      }
    },
    [streamId, target.userId, target.username]
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleAction = async (
    actionType: 'mute' | 'block' | 'report' | 'restrict_live',
    duration?: number
  ) => {
    try {
      const { officerProfile } = await fetchOfficerContext()

      switch (actionType) {
        case 'mute': {
          const muteDurationMs = duration || 10 * 60 * 1000
          const muteMinutes = Math.round(muteDurationMs / 60000)
          const muteUntil = new Date(Date.now() + muteDurationMs)
          await supabase
            .from('user_profiles')
            .update({ mic_muted_until: muteUntil.toISOString() })
            .eq('id', target.userId)

          toast.success(
            `Muted ${target.username}'s microphone for ${muteMinutes} minute${
              muteMinutes === 1 ? '' : 's'
            }.`
          )

          await recordOfficerAction(officerProfile.id, 'mute', {
            fee_coins: 25,
            metadata: { mute_until: muteUntil.toISOString(), duration_minutes: muteMinutes },
          })
          break
        }
        case 'restrict_live': {
          const restrictDurationMs = duration || 60 * 60 * 1000
          const restrictMinutes = Math.round(restrictDurationMs / 60000)
          const restrictedUntil = new Date(Date.now() + restrictDurationMs)
          await supabase
            .from('user_profiles')
            .update({ live_restricted_until: restrictedUntil.toISOString() })
            .eq('id', target.userId)

          toast.success(
            `Restricted ${target.username} from going live for ${restrictMinutes} minute${
              restrictMinutes === 1 ? '' : 's'
            }.`
          )

          await recordOfficerAction(officerProfile.id, 'restrict_live', {
            metadata: {
              restricted_until: restrictedUntil.toISOString(),
              duration_minutes: restrictMinutes,
            },
          })
          break
        }
        case 'block': {
          const blockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000)
          await supabase
            .from('user_profiles')
            .update({ no_ban_until: blockUntil.toISOString() })
            .eq('id', target.userId)

          toast.success(`Blocked ${target.username} from bans for 24 hours.`)

          await recordOfficerAction(officerProfile.id, 'block', {
            fee_coins: 100,
            metadata: { block_until: blockUntil.toISOString() },
          })
          break
        }
        case 'report': {
          const ticket = await supabase.from('support_tickets').insert({
            user_id: target.userId,
            type: 'troll_attack',
            description: `Officer report for ${target.username} in stream ${streamId}`,
            metadata: {
              stream_id: streamId,
              reported_by: officerProfile.id,
            },
          })

          if (ticket.error) {
            throw ticket.error
          }

          toast.success(`Report filed for ${target.username}`)

          await recordOfficerAction(officerProfile.id, 'report', {
            metadata: { stream_id: streamId },
          })
          break
        }
        default:
          break
      }

      onActionComplete()
      onClose()
    } catch (err: any) {
      console.error('Error performing moderation action:', err)
      toast.error(err?.message || 'Failed to perform action')
    }
  }

  const handleKick = async () => {
    try {
      const { currentUser, officerProfile } = await fetchOfficerContext()

      const { data: kickerProfile, error: kickerError } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', currentUser.id)
        .single()

      if (kickerError) throw kickerError
      const coins = kickerProfile?.troll_coins || 0
      if (coins < 500) {
        toast.error('You need 500 troll_coins to kick a user')
        return
      }

      const { data, error } = await supabase.rpc('kick_user', {
        p_target_user_id: target.userId,
        p_kicker_user_id: currentUser.id,
        p_stream_id: streamId || null,
      })

      if (error) throw error

      await recordOfficerAction(officerProfile.id, 'kick', {
        fee_coins: 500,
        metadata: { stream_id: streamId || null },
      })

      if (data?.auto_banned) {
        toast.success(`${target.username} was kicked and auto-banned. They must pay 2000 troll_coins to restore.`)
      } else {
        toast.success(`${target.username} was kicked. They can pay 250 coins to re-enter.`)
      }

      onActionComplete()
      onClose()
    } catch (err: any) {
      console.error('Error kicking user:', err)
      toast.error(err?.message || 'Failed to kick user')
    }
  }

  const banUser = async () => {
    try {
      const reason = window.prompt(`Why are you banning ${target.username}?`, 'Policy violation')
      if (!reason || !reason.trim()) {
        toast.error('Ban requires a reason')
        return
      }

      const { officerProfile } = await fetchOfficerContext()
      const { data, error } = await supabase.functions.invoke('moderation', {
        body: {
          action: 'take_action',
          action_type: 'ban_user',
          target_user_id: target.userId,
          reason: reason.trim(),
          honesty_message_shown: true,
        },
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error(data?.error || 'Ban request failed')
      }

      await recordOfficerAction(officerProfile.id, 'ban', {
        metadata: { reason: reason.trim() },
      })

      toast.success(`${target.username} has been banned. They must pay 2000 troll_coins to restore.`)
      onActionComplete()
      onClose()
    } catch (err: any) {
      console.error('Ban action failed:', err)
      toast.error(err?.message || 'Failed to ban user')
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
        onClick={handleKick}
        className="w-full text-left px-3 py-2 hover:bg-red-500/20 rounded text-red-400 flex items-center gap-2 transition-colors"
      >
        Kick User (500 coins)
      </button>
      
      <div className="space-y-2 mt-3 border-t border-white/10 pt-2">
        <div className="text-[11px] uppercase tracking-wider text-gray-400 px-2">
          Microphone mute (global)
        </div>
        <div className="flex gap-1 px-1">
          <button
            onClick={() => handleAction('mute', 10 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-yellow-600/40 text-yellow-300 hover:border-yellow-400 transition"
          >
            10m
          </button>
          <button
            onClick={() => handleAction('mute', 30 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-yellow-600/40 text-yellow-300 hover:border-yellow-400 transition"
          >
            30m
          </button>
          <button
            onClick={() => handleAction('mute', 60 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-yellow-600/40 text-yellow-300 hover:border-yellow-400 transition"
          >
            60m
          </button>
        </div>

        <div className="text-[11px] uppercase tracking-wider text-gray-400 px-2 pt-2">
          Restrict from going live
        </div>
        <div className="flex gap-1 px-1">
          <button
            onClick={() => handleAction('restrict_live', 60 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-gray-600 text-gray-200 hover:border-gray-400 transition"
          >
            1h
          </button>
          <button
            onClick={() => handleAction('restrict_live', 6 * 60 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-gray-600 text-gray-200 hover:border-gray-400 transition"
          >
            6h
          </button>
          <button
            onClick={() => handleAction('restrict_live', 24 * 60 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-gray-600 text-gray-200 hover:border-gray-400 transition"
          >
            24h
          </button>
        </div>

        <button
          onClick={banUser}
          className="w-full text-left px-3 py-2 hover:bg-red-600/20 rounded text-red-300 flex items-center gap-2 transition-colors font-semibold"
        >
          Ban User (2000 coins restoration)
        </button>

        <button
          onClick={() => handleAction('block')}
          className="w-full text-left px-3 py-2 hover:bg-orange-500/20 rounded text-orange-400 flex items-center gap-2 transition-colors"
        >
          Block for 24h
        </button>

        <button
          onClick={() => handleAction('report')}
          className="w-full text-left px-3 py-2 hover:bg-purple-500/20 rounded text-purple-400 flex items-center gap-2 transition-colors"
        >
          Report Troll Attack
        </button>

        <button
          onClick={() => {
            window.open(`/admin/user-history/${target.userId}`, '_blank')
            onClose()
          }}
          className="w-full text-left px-3 py-2 hover:bg-blue-500/20 rounded text-blue-400 flex items-center gap-2 transition-colors"
        >
          View offense history
        </button>
      </div>

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

