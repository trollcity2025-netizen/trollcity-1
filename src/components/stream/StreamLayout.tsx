// StreamLayout component for solo/battle/multi-beam modes
import React from 'react'
import VideoBox, { StreamParticipant } from './VideoBox'

interface StreamLayoutProps {
  mode: 'solo' | 'battle' | 'multi'
  participants: StreamParticipant[]
  onGiftSend?: (targetId: string) => void
}

export default function StreamLayout({
  mode,
  participants,
  onGiftSend,
}: StreamLayoutProps) {
  // Find host and opponent
  const host = participants.find(p => p.role === 'host') || participants[0] || null
  const opponent = participants.find(p => p.role === 'opponent') || null
  const guests = participants.filter(p => p.role === 'guest').slice(0, 4)

  if (mode === 'solo') {
    // Solo mode: only host box full, others hidden
    return (
      <div className="grid grid-cols-1 gap-2">
        <div className="col-span-1 h-[500px] bg-black rounded-xl overflow-hidden">
          <VideoBox
            participant={host}
            size="full"
            label={host?.userProfile?.username || 'Host'}
            isHost={true}
            onGiftSend={onGiftSend}
          />
        </div>
      </div>
    )
  }

  if (mode === 'battle') {
    // Battle mode: host + opponent as two big boxes, with optional guests as small boxes
    return (
      <div className="grid grid-cols-4 gap-2">
        {/* Host box: spans 2 cols */}
        <div className="col-span-2 row-span-2 h-[420px] bg-black rounded-xl overflow-hidden">
          <VideoBox
            participant={host}
            size="full"
            label={host?.userProfile?.username || 'Host'}
            isHost={true}
            onGiftSend={onGiftSend}
          />
        </div>

        {/* Opponent box: spans 2 cols */}
        {opponent && (
          <div className="col-span-2 row-span-2 h-[420px] bg-black rounded-xl overflow-hidden">
            <VideoBox
              participant={opponent}
              size="full"
              label={opponent?.userProfile?.username || 'Opponent'}
              onGiftSend={onGiftSend}
            />
          </div>
        )}

        {/* Guest boxes: small boxes below */}
        {guests.map((guest, i) => (
          <div
            key={guest.userId || i}
            className="col-span-1 h-[280px] bg-black rounded-xl overflow-hidden"
          >
            <VideoBox
              participant={guest}
              size="small"
              label={guest?.userProfile?.username || `Guest ${i + 1}`}
              onGiftSend={onGiftSend}
            />
          </div>
        ))}
      </div>
    )
  }

  // Multi-beam mode: up to 4 visible boxes arranged in grid
  const visibleParticipants = participants.slice(0, 4)
  const gridCols = visibleParticipants.length <= 2 ? 2 : 4

  return (
    <div className={`grid grid-cols-${gridCols} gap-2`}>
      {visibleParticipants.map((participant, i) => {
        const isHostParticipant = participant.role === 'host'
        const colSpan = isHostParticipant && visibleParticipants.length > 2 ? 2 : 1
        const rowSpan = isHostParticipant && visibleParticipants.length > 2 ? 2 : 1
        const height = isHostParticipant && visibleParticipants.length > 2 ? 420 : 280

        return (
          <div
            key={participant.userId || i}
            className={`col-span-${colSpan} row-span-${rowSpan} h-[${height}px] bg-black rounded-xl overflow-hidden`}
          >
            <VideoBox
              participant={participant}
              size={isHostParticipant ? 'full' : 'medium'}
              label={participant?.userProfile?.username || `Participant ${i + 1}`}
              isHost={isHostParticipant}
              onGiftSend={onGiftSend}
            />
          </div>
        )
      })}
    </div>
  )
}

