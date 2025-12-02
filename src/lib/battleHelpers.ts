// Battle helper functions for edge function integration
import { supabase } from './supabase'

const getFunctionUrl = () => {
  return import.meta.env.VITE_EDGE_FUNCTIONS_URL?.replace(/\/$/, '') 
    || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'
}

export const startTrollBattle = async (
  challengerId: string,
  hostStreamId: string,
  challengerStreamId?: string
) => {
  try {
    const { data: session } = await supabase.auth.getSession()
    const accessToken = session.session?.access_token
    
    if (!accessToken) {
      throw new Error('Not authenticated')
    }

    // Use new battles function with action format
    const response = await fetch(
      `${getFunctionUrl()}/battles`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          action: 'start_battle',
          stream_id: hostStreamId,
          opponent_id: challengerId,
          mode: 'battle'
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to start battle')
    }

    const data = await response.json()
    return data.battle
  } catch (error: any) {
    console.error('Error starting battle:', error)
    throw error
  }
}

export const applyGiftToBattle = async ({
  battleId,
  receiverRole,
  isPaid,
  amount,
}: {
  battleId: string
  receiverRole: 'host' | 'challenger'
  isPaid: boolean
  amount: number
}) => {
  try {
    const { data: session } = await supabase.auth.getSession()
    const accessToken = session.session?.access_token
    
    if (!accessToken) {
      console.warn('No access token for battle gift')
      return
    }

    const res = await fetch(
      `${getFunctionUrl()}/troll-battle?op=apply-gift`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          battle_id: battleId,
          receiver_role: receiverRole,
          is_paid: isPaid,
          amount
        })
      }
    )

    if (!res.ok) {
      console.error('Failed to apply gift to battle', await res.text())
    }
  } catch (err) {
    console.error('Error applying gift to battle', err)
  }
}

export const completeBattle = async (battleId: string) => {
  try {
    const { data: session } = await supabase.auth.getSession()
    const accessToken = session.session?.access_token
    
    if (!accessToken) {
      throw new Error('Not authenticated')
    }

    // Use new battles function with action format
    const response = await fetch(
      `${getFunctionUrl()}/battles`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          action: 'end_battle',
          battle_id: battleId
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to complete battle')
    }

    const data = await response.json()
    return data.battle
  } catch (error: any) {
    console.error('Error completing battle:', error)
    throw error
  }
}

// New helper for joining battle slot
export const joinBattleSlot = async (
  streamId: string,
  role: 'host' | 'opponent' | 'guest' = 'guest',
  livekitIdentity?: string,
  livekitParticipantId?: string
) => {
  try {
    const { data: session } = await supabase.auth.getSession()
    const accessToken = session.session?.access_token
    
    if (!accessToken) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(
      `${getFunctionUrl()}/battles`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          action: 'join_battle_slot',
          stream_id: streamId,
          role,
          livekit_identity: livekitIdentity,
          livekit_participant_id: livekitParticipantId
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to join battle slot')
    }

    const data = await response.json()
    return data.participant
  } catch (error: any) {
    console.error('Error joining battle slot:', error)
    throw error
  }
}

// New helper for leaving battle slot
export const leaveBattleSlot = async (streamId: string) => {
  try {
    const { data: session } = await supabase.auth.getSession()
    const accessToken = session.session?.access_token
    
    if (!accessToken) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(
      `${getFunctionUrl()}/battles`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          action: 'leave_battle_slot',
          stream_id: streamId
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to leave battle slot')
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error leaving battle slot:', error)
    throw error
  }
}

