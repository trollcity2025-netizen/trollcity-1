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
  isBroadcaster?: boolean
  isBroadofficer?: boolean
}

export default function ModerationMenu({ 
  target, 
  streamId, 
  onClose, 
  onActionComplete,
  isBroadcaster = false,
  isBroadofficer = false
}: ModerationMenuProps) {
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
    const isGlobalOfficer =
      officerProfile.is_troll_officer === true ||
      officerProfile.role === 'troll_officer'

    if (!isAdmin && !isGlobalOfficer && !isBroadcaster && !isBroadofficer) {
      throw new Error('Officer access required')
    }

    // Officers pay fees, but Admins, Broadcasters, and Broadofficers (stream mods) are exempt
    return { currentUser, officerProfile, isPrivileged: isAdmin || isBroadcaster || isBroadofficer }
  }, [isBroadcaster, isBroadofficer])

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
      const { officerProfile, isPrivileged } = await fetchOfficerContext()

      switch (actionType) {
        case 'mute': {
          const muteDurationMs = duration || 10 * 60 * 1000
          const muteMinutes = Math.round(muteDurationMs / 60000)
          const muteUntil = new Date(Date.now() + muteDurationMs)
          
          const fee = 25; // Fee for mute
          
          if (!isPrivileged) {
            if ((officerProfile?.troll_coins || 0) < fee) {
              toast.error(`Insufficient coins. Need ${fee} coins to mute.`);
              return;
            }

            // Deduct coins
            const { error: spendError } = await supabase.rpc('troll_bank_spend_coins', {
              p_user_id: officerProfile.id,
              p_amount: fee,
              p_bucket: 'paid',
              p_source: 'moderation_fee',
              p_metadata: { action: 'mute', target_id: target.userId }
            });

            if (spendError) {
              console.error('Failed to deduct mute fee:', spendError);
              toast.error('Failed to process fee. Action cancelled.');
              return;
            }
          }

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
            fee_coins: fee,
            metadata: { mute_until: muteUntil.toISOString(), duration_minutes: muteMinutes },
          })
          break
        }
        case 'unmute': {
          await supabase
            .from('user_profiles')
            .update({ mic_muted_until: null })
            .eq('id', target.userId)

          toast.success(`Unmuted ${target.username}'s microphone.`)

          await recordOfficerAction(officerProfile.id, 'unmute', {
            fee_coins: 0,
            metadata: {},
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
          
          const fee = 500;
          
          if (!isPrivileged) {
            if ((officerProfile?.troll_coins || 0) < fee) {
              toast.error(`Insufficient coins. Need ${fee} coins to block.`);
              return;
            }

            // Deduct coins
            const { error: spendError } = await supabase.rpc('troll_bank_spend_coins', {
              p_user_id: officerProfile.id,
              p_amount: fee,
              p_bucket: 'paid',
              p_source: 'moderation_fee',
              p_metadata: { action: 'block', target_id: target.userId }
            });

            if (spendError) {
              console.error('Failed to deduct block fee:', spendError);
              toast.error('Failed to process fee. Action cancelled.');
              return;
            }
          }
          
          await supabase
            .from('user_profiles')
            .update({ no_ban_until: blockUntil.toISOString() })
            .eq('id', target.userId)

          toast.success(`Blocked ${target.username} from bans for 24 hours.`)

          await recordOfficerAction(officerProfile.id, 'block', {
            fee_coins: fee,
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
      const { currentUser, officerProfile, isPrivileged } = await fetchOfficerContext()

      const fee = isPrivileged ? 0 : 500
      
      // Check coins
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', currentUser.id)
        .single()
        
      if (!isPrivileged && (profile?.troll_coins || 0) < fee) {
        toast.error(`Insufficient coins. Need ${fee} coins to kick.`)
        return
      }

      if (!isPrivileged) {
        const { error: spendError } = await supabase.rpc('troll_bank_spend_coins', {
          p_user_id: officerProfile.id,
          p_amount: fee,
          p_bucket: 'paid',
          p_source: 'moderation_fee',
          p_metadata: { action: 'kick', target_id: target.userId }
        });

        if (spendError) {
          console.error('Failed to deduct kick fee:', spendError);
          toast.error('Failed to process fee. Action cancelled.');
          return;
        }
      }

      const { data, error } = await supabase.rpc('kick_user', {
        p_target_user_id: target.userId,
        p_kicker_user_id: currentUser.id,
        p_stream_id: streamId || null,
      })

      if (error) throw error

      await recordOfficerAction(officerProfile.id, 'kick', {
        fee_coins: fee,
        metadata: { stream_id: streamId || null },
      })

      if (data?.auto_banned) {
        toast.success(`${target.username} was kicked and auto-banned.`)
      } else {
        toast.success(`${target.username} was kicked.`)
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
      const reason = window.prompt(`Reason for warrant against ${target.username}?`, 'Violation of rules')
      if (!reason || !reason.trim()) {
        // Cancelled or empty
        return
      }

      const { officerProfile } = await fetchOfficerContext()
      
      // Use issue_warrant RPC instead of ban
      const { data, error } = await supabase.rpc('issue_warrant', {
        p_user_id: target.userId,
        p_reason: reason.trim()
      })

      if (error) throw error
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to issue warrant')
      }

      await recordOfficerAction(officerProfile.id, 'ban', { // Keeping action type 'ban' for stats consistency if desired, or change to 'warrant'
        metadata: { reason: reason.trim(), type: 'warrant' },
      })

      toast.success(`Warrant issued for ${target.username}. Access restricted until court appearance.`)
      onActionComplete()
      onClose()
    } catch (err: any) {
      console.error('Warrant issuance failed:', err)
      toast.error(err?.message || 'Failed to issue warrant')
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
        Kick User
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
        <button
          onClick={() => handleAction('unmute')}
          className="w-full text-left px-3 py-2 hover:bg-green-500/20 rounded text-green-400 flex items-center gap-2 transition-colors text-xs"
        >
           Unmute Microphone
        </button>

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
          Issue Warrant (Restrict Access)
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

