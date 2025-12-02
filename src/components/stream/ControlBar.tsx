import { useState } from 'react'
import { Camera, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { endStream } from '../../lib/endStream'
import { toast } from 'sonner'

type LayoutMode = 'spotlight' | 'grid' | 'talkshow' | 'stacked'

interface ControlBarProps {
  room: any // Room from livekit-client
  isCameraEnabled: boolean
  isMicrophoneEnabled: boolean
  onToggleCamera: () => void
  onToggleMicrophone: () => void
  streamId?: string
  isHost?: boolean
  layoutMode?: LayoutMode
  onLayoutChange?: (mode: LayoutMode) => void
}

export default function ControlBar({
  room,
  isCameraEnabled,
  isMicrophoneEnabled,
  onToggleCamera,
  onToggleMicrophone,
  streamId,
  isHost,
  layoutMode = 'grid',
  onLayoutChange,
}: ControlBarProps) {
  const navigate = useNavigate()
  const [isEnding, setIsEnding] = useState(false)

  const handleEndLive = async () => {
    if (!streamId || !isHost) return

    // No confirmation - proceed directly

    setIsEnding(true)
    try {
      const success = await endStream(streamId, room)
      if (success) {
        navigate('/stream-ended')
      } else {
        toast.error('Failed to end stream. Please try again.')
        setIsEnding(false)
      }
    } catch (error) {
      console.error('Error ending stream:', error)
      toast.error('Failed to end stream. Please try again.')
      setIsEnding(false)
    }
  }

  if (!room) return null

  return (
    <div className="flex items-center gap-3 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 border border-purple-500/30">
      <button
        onClick={onToggleCamera}
        className={`p-2 rounded-full transition-colors ${
          isCameraEnabled
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
        }`}
        title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
      </button>

      <button
        onClick={onToggleMicrophone}
        className={`p-2 rounded-full transition-colors ${
          isMicrophoneEnabled
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
        }`}
        title={isMicrophoneEnabled ? 'Turn off microphone' : 'Turn on microphone'}
      >
        {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      {/* End Live Button - Only for Host */}
      {isHost && streamId && (
        <button
          onClick={handleEndLive}
          disabled={isEnding}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full border border-red-400 shadow-lg transition-colors flex items-center gap-2"
        >
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          {isEnding ? 'Ending...' : 'End Live'}
        </button>
      )}
    </div>
  )
}

// Layout Switcher Component (separate for better organization)
export function LayoutSwitcher({ 
  layoutMode, 
  onLayoutChange 
}: { 
  layoutMode: LayoutMode
  onLayoutChange: (mode: LayoutMode) => void 
}) {
  const layouts: LayoutMode[] = ['spotlight', 'grid', 'talkshow', 'stacked']

  return (
    <div className="flex space-x-2 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 border border-purple-500/30">
      {layouts.map((mode) => (
        <button
          key={mode}
          onClick={() => onLayoutChange(mode)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            layoutMode === mode
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
          }`}
          title={mode.charAt(0).toUpperCase() + mode.slice(1) + ' Layout'}
        >
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  )
}

