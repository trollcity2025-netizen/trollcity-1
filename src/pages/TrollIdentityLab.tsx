import React from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import DnaProfileCard from '../components/DnaProfileCard'
import '../styles/dnaEffects.css'

export default function TrollIdentityLab() {
  const { profile } = useAuthStore()
  const [events, setEvents] = React.useState<any[]>([])
  const [traits, setTraits] = React.useState<any[]>([])
  const [dna, setDna] = React.useState<any>(null)
  const [level, setLevel] = React.useState<any>(null)

  const load = React.useCallback(async () => {
    if (!profile) return
    const { data: ev } = await supabase.from('troll_dna_events').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50)
    setEvents(ev || [])
    const { data: t } = await supabase.from('troll_dna_traits').select('*')
    setTraits(t || [])
    const { data: d } = await supabase.from('troll_dna_profiles').select('*').eq('user_id', profile.id).maybeSingle()
    setDna(d || { primary_dna: null, traits: [] })
    const { data: l } = await supabase.from('user_levels').select('*').eq('user_id', profile.id).maybeSingle()
    setLevel(l || { level: 1, xp: 0, next_level_xp: 100 })
  }, [profile?.id])

  React.useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-6xl mx-auto p-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">Troll Identity Lab</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="md:col-span-2">
            <DnaProfileCard />
            <div className="mt-6 bg-[#1A1A1A] rounded-lg border border-[#2C2C2C] p-4">
              <div className="font-semibold mb-2">DNA Mutation Timeline</div>
              <div className="space-y-2">
                {events.map(e => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <div>@{profile?.username} {e.event_type}</div>
                    <div className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {events.length === 0 && <div className="text-xs text-gray-400">No events</div>}
              </div>
            </div>
          </div>
          <div>
            <div className="bg-[#1A1A1A] rounded-lg border border-[#2C2C2C] p-4">
              <div className="font-semibold mb-2">Traits</div>
              <div className="flex flex-wrap gap-2">
                {traits.map(t => (
                  <div key={t.id} className="px-2 py-1 rounded bg-[#121212] border border-[#2C2C2C] text-xs">
                    {t.name}
                  </div>
                ))}
                {traits.length === 0 && <div className="text-xs text-gray-400">No traits</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
