import React from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { simulateAvatarParticipation } from '../lib/maiEngine'
import MaiDialogBubble from '../components/MaiDialogBubble'

const MaiLab: React.FC = () => {
  const { profile } = useAuthStore()
  const [avatars, setAvatars] = React.useState<any[]>([])
  const [preview, setPreview] = React.useState<any>(null)

  React.useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('troll_ai_avatars').select('*').eq('is_active', true)
      setAvatars(data || [])
    }
    load()
  }, [])

  const triggerPreview = async (avatarId: string) => {
    if (!profile) return
    const resp = await simulateAvatarParticipation(profile.id, avatarId, { page: 'MaiLab' })
    setPreview({ avatarId, text: resp?.text || resp?.message || '...' })
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <h1 className="text-2xl font-bold mb-4">MAI Lab</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {avatars.map(a => (
            <div key={a.id} className="bg-[#121212] border border-[#2C2C2C] rounded p-3">
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-gray-400">DNA: {a.dna_key} • Personality: {a.personality_type}</div>
              <button onClick={() => triggerPreview(a.id)} className="mt-2 px-3 py-1 bg-[#7C3AED] text-white rounded text-xs">Simulate Reaction</button>
            </div>
          ))}
        </div>
        <div>
          <div className="font-semibold mb-2">Live AI Preview</div>
          {preview && <MaiDialogBubble text={preview.text} avatarName={avatars.find(x=>x.id===preview.avatarId)?.name} />}
        </div>
      </div>
    </div>
  )
}

export default MaiLab

