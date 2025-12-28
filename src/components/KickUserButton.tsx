import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { UserX } from 'lucide-react'

interface KickUserButtonProps {
  targetUserId: string
  targetUsername: string
  streamId?: string
  onKickComplete?: () => void
}

export default function KickUserButton({ 
  targetUserId, 
  targetUsername, 
  streamId,
  onKickComplete 
}: KickUserButtonProps) {
  const { user, profile } = useAuthStore()
  const [kicking, setKicking] = useState(false)

  const handleKick = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in')
      return
    }

    if (targetUserId === user.id) {
      toast.error('You cannot kick yourself')
      return
    }

    if (profile.troll_coins < 500) {
      toast.error('You need 500 paid coins to kick a user')
      return
    }

    // No confirmation - proceed directly

    setKicking(true)
    try {
      const { data, error } = await supabase.rpc('kick_user', {
        p_target_user_id: targetUserId,
        p_kicker_user_id: user.id,
        p_stream_id: streamId || null
      })

      if (error) throw error

      if (data?.success) {
        if (data.auto_banned) {
          toast.success(`${targetUsername} kicked and auto-banned. They must pay $20 to restore their account.`)
        } else {
          toast.success(`${targetUsername} kicked! They can pay 250 paid coins to re-enter.`)
        }
        onKickComplete?.()
      } else {
        toast.error(data?.error || 'Failed to kick user')
      }
    } catch (error: any) {
      console.error('Error kicking user:', error)
      toast.error(error?.message || 'Failed to kick user')
    } finally {
      setKicking(false)
    }
  }

  if (!user || !profile) return null

  return (
    <button
      onClick={handleKick}
      disabled={kicking || profile.troll_coins < 500}
      className="px-3 py-1 bg-red-600/80 hover:bg-red-600 rounded-lg text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title={profile.troll_coins < 500 ? 'Need 500 paid coins to kick' : `Kick ${targetUsername} (costs 500 paid coins)`}
    >
      <UserX size={14} />
      {kicking ? 'Kicking...' : 'Kick User'}
    </button>
  )
}

