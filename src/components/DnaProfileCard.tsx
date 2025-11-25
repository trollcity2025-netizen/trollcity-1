import React from 'react'
import { useAuthStore } from '../lib/store'
import { dnaClassFor, getUserFullIdentity } from '../lib/progressionEngine'
import '../styles/dnaEffects.css'

type Props = { userId?: string }

const DnaProfileCard: React.FC<Props> = ({ userId }) => {
  const { profile } = useAuthStore()
  const uid = userId || profile?.id
  const [identity, setIdentity] = React.useState<any>(null)

  React.useEffect(() => {
    const run = async () => { if (uid) setIdentity(await getUserFullIdentity(uid)) }
    run()
  }, [uid])

  const cls = dnaClassFor(identity?.dna?.primary_dna)

  if (!uid) return null
  return (
    <div className={`rounded-lg p-4 border border-[#2C2C2C] bg-[#121212] ${cls}`}>
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">{profile?.username || 'User'}</div>
        <div className="text-sm">Level {identity?.level?.level || 1}</div>
      </div>
      <div className="mt-2">
        <div className="w-full h-2 bg-gray-700 rounded">
          <div className="h-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] rounded" style={{ width: `${Math.min(100, Math.round(((identity?.level?.xp || 0)/(identity?.level?.next_level_xp || 100))*100))}%` }} />
        </div>
        <div className="text-xs text-gray-400 mt-1">XP {identity?.level?.xp || 0} / {identity?.level?.next_level_xp || 100}</div>
      </div>
      <div className="mt-3">
        <div className="text-sm font-semibold">DNA: {identity?.dna?.primary_dna || 'Unassigned'}</div>
        <div className="text-xs text-gray-400">Traits: {(identity?.dna?.traits || []).map((t: any) => t.name || t).join(', ')}</div>
      </div>
      <div className="mt-3 text-xs text-gray-500">Recent events: {(identity?.events || []).map((e: any) => e.event_type).slice(0,5).join(' • ')}</div>
    </div>
  )
}

export default DnaProfileCard

