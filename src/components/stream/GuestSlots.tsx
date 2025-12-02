import { useState, useEffect } from 'react'
import { Room } from 'livekit-client'
import GuestSlot from './GuestSlot'
import EntranceChatPanel from './EntranceChatPanel'
import { toast } from 'sonner'

interface GuestSlotsProps {
  room: Room | null
  isHost: boolean
  streamId?: string
}

export default function GuestSlots({ room, isHost, streamId }: GuestSlotsProps) {
  const [participants, setParticipants] = useState<Array<{ participant: any; id: string }>>([])

  useEffect(() => {
    if (!room) return

    const updateParticipants = () => {
      // Filter out host - only get guests (remote participants)
      const guests = Array.from(room.remoteParticipants.values()).slice(0, 4) // Max 4 guest slots

      setParticipants(
        guests.map((p) => ({
          participant: p,
          id: p.identity || `guest-${Date.now()}`,
        }))
      )
    }

    updateParticipants()

    room.on('participantConnected', updateParticipants)
    room.on('participantDisconnected', updateParticipants)

    return () => {
      room.off('participantConnected', updateParticipants)
      room.off('participantDisconnected', updateParticipants)
    }
  }, [room])

  const handleInvite = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=true`
    navigator.clipboard.writeText(inviteUrl).then(() => {
      toast.success('Invite link copied to clipboard!')
    })
  }

  const handleRemove = (participantId: string) => {
    // Only host can remove guests
    if (!isHost || !room) return

    const participant = room.remoteParticipants.get(participantId)
    if (participant) {
      // Disconnect the participant (if you have permissions)
      toast.info('Guest removal would require backend permissions')
    }
  }

  // Fill empty slots (max 4 guests)
  const emptySlots = 4 - participants.length

  return (
    <>
      {/* Guest video slots */}
      {participants.map((slot, index) => (
        <GuestSlot
          key={slot.id}
          participant={slot.participant}
          index={index + 1} // Guests start at index 1 (host is 0)
          isHost={false}
          onInvite={undefined}
          onRemove={isHost ? () => handleRemove(slot.id) : undefined}
        />
      ))}

      {/* Render empty invite slots */}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <GuestSlot
          key={`empty-${i}`}
          participant={undefined}
          index={participants.length + i + 1}
          isHost={false}
          onInvite={handleInvite}
          onRemove={undefined}
        />
      ))}
    </>
  )
}

