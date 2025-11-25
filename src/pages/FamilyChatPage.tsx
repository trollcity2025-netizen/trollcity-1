import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { Swords, Shield, Trophy } from 'lucide-react'

interface Family {
  id: string
  name: string
}

interface War {
  id: string
  challenger_family_id: string
  defender_family_id: string
  status: 'pending' | 'active' | 'completed'
  challenger_score: number
  defender_score: number
  start_time: string | null
  end_time: string | null
  challenger_family?: { name: string }
  defender_family?: { name: string }
}

export default function FamilyWarsPage() {
  const { user } = useAuthStore()
  const [myFamily, setMyFamily] = useState<Family | null>(null)
  const [families, setFamilies] = useState<Family[]>([])
  const [wars, setWars] = useState<War[]>([])
  const [challengingId, setChallengingId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    init()
  }, [user])

  const init = async () => {
    setLoading(true)
    await Promise.all([loadMyFamily(), loadFamilies(), loadWars()])
    setLoading(false)
  }

  const loadMyFamily = async () => {
    const { data: member } = await supabase
      .from('troll_family_members')
      .select('family_id, family:troll_families(id, name)')
      .eq('user_id', user!.id)
      .single()

    if (member?.family) {
      setMyFamily(member.family as unknown as Family)
    }
  }

  const loadFamilies = async () => {
    const { data } = await supabase.from('troll_families').select('id, name')
    setFamilies((data || []) as Family[])
  }

  const loadWars = async () => {
    const { data } = await supabase
      .from('troll_family_wars')
      .select(
        `
        *,
        challenger_family:challenger_family_id ( name ),
        defender_family:defender_family_id ( name )
      `
      )
      .order('created_at', { ascending: false })
      .limit(20)

    setWars((data || []) as War[])
  }

  const startChallenge = async () => {
    if (!myFamily) {
      toast.error('You must be in a family to start a war')
      return
    }
    if (!challengingId) {
      toast.error('Select a family to challenge')
      return
    }
    if (challengingId === myFamily.id) {
      toast.error('You cannot challenge your own family')
      return
    }

    const { error } = await supabase.from('troll_family_wars').insert({
      challenger_family_id: myFamily.id,
      defender_family_id: challengingId,
      status: 'pending',
      challenger_score: 0,
      defender_score: 0,
    })

    if (error) {
      console.error(error)
      toast.error('Failed to start war')
      return
    }

    toast.success('Challenge sent!')
    setChallengingId('')
    loadWars()
  }

  if (loading) {
    return (
      <div className="min-h-screen tc-cosmic-bg text-white flex items-center justify-center">
        Loading Troll Family Wars...
      </div>
    )
  }

  return (
    <div className="min-h-screen tc-cosmic-bg text-white p-6">
      <div className="flex items-center gap-2 mb-4">
        <Swords size={24} />
        <h1 className="text-2xl font-extrabold">Troll Family Wars</h1>
      </div>

      {!myFamily ? (
        <div className="troll-card p-4 text-sm text-gray-300">
          Join a Troll Family first to participate in wars and city events.
        </div>
      ) : (
        <>
          <div className="troll-card p-4 mb-4 text-sm">
            <div className="mb-2">
              You are in:{' '}
              <span className="font-semibold text-purple-200">{myFamily.name}</span>
            </div>
            <div className="text-xs text-gray-300">
              Wars are friendly competitions where families race for weekly task
              completions, gift battles, and viewer challenges. Winning wars can help
              your family climb to Royal status faster.
            </div>
          </div>

          {/* Challenge Selector */}
          <div className="troll-card p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={18} />
              <span className="font-semibold text-sm">Challenge Another Family</span>
            </div>

            <div className="flex gap-2">
              <select
                value={challengingId}
                onChange={(e) => setChallengingId(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm flex-1"
              >
                <option value="">Select family...</option>
                {families
                  .filter((f) => f.id !== myFamily.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={startChallenge}
                className="gaming-button-pink px-3 py-1 rounded text-sm flex items-center gap-1"
              >
                <Swords size={14} /> Challenge
              </button>
            </div>
          </div>
        </>
      )}

      {/* War List */}
      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Trophy size={18} className="text-yellow-300" />
        Recent Family Wars
      </h2>

      {wars.length === 0 ? (
        <div className="troll-card p-4 text-sm text-gray-300">
          No wars have been declared yet.
        </div>
      ) : (
        <div className="space-y-3">
          {wars.map((w) => (
            <div
              key={w.id}
              className="troll-card p-3 flex items-center justify-between text-sm"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-purple-200">
                    {w.challenger_family?.name || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-400">vs</span>
                  <span className="font-semibold text-green-200">
                    {w.defender_family?.name || 'Unknown'}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  Status:{' '}
                  <span className="text-yellow-300 uppercase">{w.status}</span> • Score:{' '}
                  {w.challenger_score} - {w.defender_score}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
