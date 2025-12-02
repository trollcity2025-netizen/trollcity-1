import { Room } from 'livekit-client'
import VideoBox from './VideoBox'
import { toast } from 'sonner'

type LayoutMode = 'spotlight' | 'grid' | 'talkshow' | 'stacked'

interface GuestGridProps {
  room: Room | null
  layoutMode: LayoutMode
  onGiftSend?: (targetId: string) => void
}

// Spotlight Layout (Host full screen, guests bottom thumbnails)
function SpotlightLayout({ participants, onGiftSend }: { participants: any[]; onGiftSend?: (targetId: string) => void }) {
  if (participants.length === 0) return null

  return (
    <>
      <div className="absolute inset-0">
        <VideoBox participant={participants[0]} size="full" label="🎥 Host" isHost={true} onGiftSend={onGiftSend} />
      </div>
      {participants.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-3 z-20">
          {participants.slice(1).map((p, i) => (
            <VideoBox key={p.identity || i} participant={p} size="small" label={`👤 Guest ${i + 1}`} onGiftSend={onGiftSend} />
          ))}
        </div>
      )}
    </>
  )
}

// Grid Layout (2, 3, or 4 equal blocks — automatic)
function GridLayout({ participants, onGiftSend }: { participants: any[]; onGiftSend?: (targetId: string) => void }) {
  if (participants.length === 0) return null

  const gridClass =
    participants.length === 1
      ? 'absolute inset-0'
      : participants.length === 2
      ? 'grid grid-cols-2 gap-2 h-full'
      : participants.length === 3
      ? 'grid grid-cols-3 gap-2 h-full'
      : 'grid grid-cols-2 grid-rows-2 gap-2 h-full'

  return (
    <div className={gridClass}>
      {participants.map((p, i) => (
        <VideoBox
          key={p.identity || i}
          participant={p}
          size="full"
          label={i === 0 ? '🎥 Host' : `👤 Guest ${i}`}
          isHost={i === 0}
          onGiftSend={onGiftSend}
        />
      ))}
    </div>
  )
}

// Talkshow Layout (Host large left, guests stacked right)
function TalkshowLayout({ participants, onGiftSend }: { participants: any[]; onGiftSend?: (targetId: string) => void }) {
  if (participants.length === 0) return null

  return (
    <>
      <div className="absolute left-0 top-0 bottom-0 w-[65%]">
        <VideoBox participant={participants[0]} size="full" label="🎥 Host" isHost={true} onGiftSend={onGiftSend} />
      </div>
      {participants.length > 1 && (
        <div className="absolute right-0 top-0 bottom-0 w-[35%] flex flex-col space-y-3 p-3">
          {participants.slice(1).map((p, i) => (
            <VideoBox key={p.identity || i} participant={p} size="medium" label={`👤 Guest ${i + 1}`} onGiftSend={onGiftSend} />
          ))}
        </div>
      )}
    </>
  )
}

// Stacked Layout (Vertical interview or podcast style)
function StackedLayout({ participants, onGiftSend }: { participants: any[]; onGiftSend?: (targetId: string) => void }) {
  if (participants.length === 0) return null

  return (
    <div className="absolute inset-0 flex flex-col space-y-3 p-3">
      {participants.map((p, i) => (
        <VideoBox
          key={p.identity || i}
          participant={p}
          size="medium"
          label={i === 0 ? '🎥 Host' : `👤 Guest ${i}`}
          isHost={i === 0}
          onGiftSend={onGiftSend}
        />
      ))}
    </div>
  )
}

// Invite Slots Component
function InviteSlots({ count }: { count: number }) {
  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=true`
    navigator.clipboard
      .writeText(inviteUrl)
      .then(() => {
        toast.success('Invite link copied to clipboard!')
      })
      .catch(() => {
        toast.error('Failed to copy invite link')
      })
  }

  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`empty-${idx}`}
          className="h-[160px] flex items-center justify-center bg-black/30 border border-purple-500/40 rounded-xl backdrop-blur-md cursor-pointer hover:bg-black/50 transition-colors shadow-[0_0_10px_rgba(177,48,255,0.2)]"
          onClick={copyInviteLink}
        >
          <span className="text-white text-sm opacity-70">+ Invite Guest</span>
        </div>
      ))}
    </>
  )
}

export default function GuestGrid({ room, layoutMode, onGiftSend }: GuestGridProps) {
  if (!room) return null

  const participants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())].slice(0, 4) // max 4 guests

  const emptySlots = 4 - participants.length

  return (
    <div className="absolute inset-0">
      {layoutMode === 'spotlight' && <SpotlightLayout participants={participants} onGiftSend={onGiftSend} />}
      {layoutMode === 'grid' && <GridLayout participants={participants} onGiftSend={onGiftSend} />}
      {layoutMode === 'talkshow' && <TalkshowLayout participants={participants} onGiftSend={onGiftSend} />}
      {layoutMode === 'stacked' && <StackedLayout participants={participants} onGiftSend={onGiftSend} />}

      {emptySlots > 0 && layoutMode === 'grid' && (
        <div className="absolute left-4 top-24 flex flex-col space-y-4 w-[280px]">
          <InviteSlots count={emptySlots} />
        </div>
      )}
    </div>
  )
}
