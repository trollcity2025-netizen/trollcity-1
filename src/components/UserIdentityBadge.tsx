import React from 'react'
import { dnaClassFor, getLevelProfile, getDnaProfile } from '../lib/progressionEngine'

type Props = { userId: string; username?: string }

const UserIdentityBadge: React.FC<Props> = ({ userId, username }) => {
  const [level, setLevel] = React.useState<any>(null)
  const [dna, setDna] = React.useState<any>(null)

  React.useEffect(() => {
    const run = async () => {
      setLevel(await getLevelProfile(userId))
      setDna(await getDnaProfile(userId))
    }
    run()
  }, [userId])

  const cls = dnaClassFor(dna?.primary_dna)

  return (
    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded border border-[#2C2C2C] ${cls}`}>
      <span className="text-xs font-semibold">{username || 'User'}</span>
      <span className="text-[10px] bg-[#7C3AED] text-white px-1 rounded">Lv {level?.level || 1}</span>
      <span className="text-[10px] text-gray-400">{dna?.primary_dna || ''}</span>
    </div>
  )
}

export default UserIdentityBadge

