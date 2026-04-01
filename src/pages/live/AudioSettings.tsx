import AudioSettingsPanel from '../../components/live/AudioSettingsPanel'
import { useAuthStore } from '../../lib/store'

export default function AudioSettings() {
  const { user, profile } = useAuthStore()

  if (!user?.id) return null

  return (
    <div className="min-h-screen bg-zinc-950">
      <AudioSettingsPanel
        userId={user.id}
        currentLevel={profile?.level || 1}
      />
    </div>
  )
}
