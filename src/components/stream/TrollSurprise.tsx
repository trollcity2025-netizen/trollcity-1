import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

interface TrollSurpriseProps {
  streamId: string | undefined
}

export default function TrollSurprise({ streamId }: TrollSurpriseProps) {
  const [visible, setVisible] = useState(false)
  const [canClick, setCanClick] = useState(false)
  const { user, profile } = useAuthStore()

  // Track when user joined this stream
  useEffect(() => {
    if (!streamId) return

    const joinKey = `joined-${streamId}`
    const joinTime = sessionStorage.getItem(joinKey)

    if (!joinTime) {
      // First time joining this stream, record the time
      sessionStorage.setItem(joinKey, Date.now().toString())
    }
  }, [streamId])

  // Troll appears randomly
  useEffect(() => {
    if (!streamId) return

    const timeout = Math.random() * 45000 + 15000 // between 15–60 sec
    const timer = setTimeout(() => {
      // Check if user was already active (not just joined)
      const joinKey = `joined-${streamId}`
      const joinTime = sessionStorage.getItem(joinKey)

      if (joinTime && Date.now() - parseInt(joinTime) > 15000) {
        setCanClick(true) // must be watching 15s+
        setVisible(true)
        setTimeout(() => setVisible(false), 60000) // stays 60 sec max
      } else {
        // User hasn't been watching long enough, try again later
        const retryTimeout = Math.random() * 30000 + 10000
        setTimeout(() => {
          setCanClick(true)
          setVisible(true)
          setTimeout(() => setVisible(false), 60000)
        }, retryTimeout)
      }
    }, timeout)

    return () => clearTimeout(timer)
  }, [streamId])

  const catchTroll = async () => {
    if (!canClick || !user || !profile || !streamId) {
      alert('Must be watching before the Troll appeared!')
      return
    }

    setVisible(false)

    try {
      // Award coins via RPC
      const { error: rpcError } = await supabase.rpc('add_free_coins', {
        p_user_id: user.id,
        p_amount: 10,
      })

      if (rpcError) {
        console.error('Error awarding troll coins:', rpcError)
        // Fallback: Direct coin update if RPC doesn't work
        const { data: currentProfile } = await supabase
          .from('user_profiles')
          .select('free_coin_balance')
          .eq('id', user.id)
          .single()

        if (currentProfile) {
          await supabase
            .from('user_profiles')
            .update({
              free_coin_balance: (currentProfile.free_coin_balance || 0) + 10,
            })
            .eq('id', user.id)
        }
      }

      // Send a message to chat
      await supabase.from('messages').insert({
        stream_id: streamId,
        user_id: user.id,
        content: `${profile.username || 'Someone'} caught the Troll and earned 10 coins! 🎉`,
        message_type: 'chat',
      })
    } catch (error) {
      console.error('Error catching troll:', error)
    }
  }

  if (!visible || !streamId) return null

  return (
    <div
      onClick={catchTroll}
      className="absolute bottom-24 w-24 cursor-pointer animate-trollWalk z-30 hover:scale-110 transition-transform"
      style={{ left: '-80px' }} // Starts offscreen
      title="Click to catch the Troll and earn 10 coins!"
    >
      {/* Fallback emoji if image doesn't exist */}
      <div className="w-full h-full flex items-center justify-center text-6xl drop-shadow-[0_0_10px_#00ff66]">
        😈
      </div>
      {/* Uncomment when you have the troll image:
      <img 
        src="/assets/troll-run.gif" 
        alt="Troll" 
        className="w-full drop-shadow-[0_0_10px_#00ff66]" 
      />
      */}
    </div>
  )
}

