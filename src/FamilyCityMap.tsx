import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { Users, ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function FamilyCityMap() {
  const [families, setFamilies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadFamilies()
  }, [])

  const loadFamilies = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_weekly_family_task_counts')
    if (error) console.error(error)
    setFamilies(data || [])
    setLoading(false)
  }

  const getBuildingClass = (tasks: number) => {
    if (tasks >= 30) return 'royal-family'
    if (tasks >= 20) return 'diamond-family'
    if (tasks >= 15) return 'platinum-family'
    if (tasks >= 10) return 'gold-family'
    if (tasks >= 5) return 'silver-family'
    return 'bronze-family'
  }

  return (
    <div className="min-h-screen text-white cosmic-bg p-6">
      <h1 className="text-3xl font-extrabold gradient-text-green-pink mb-6">
        🗺️ Troll Family City Map
      </h1>

      {loading ? (
        <div className="text-center mt-10 animate-pulse">Loading City...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {families.map((fam, index) => (
            <div
              key={fam.family_id}
              onClick={() => navigate(`/family/profile?familyId=${fam.family_id}`)}
              className={`
                family-building ${getBuildingClass(fam.task_count)}
                cursor-pointer p-4 rounded-xl shadow-lg transition transform hover:scale-105
              `}
            >
              <div className="text-lg font-bold mb-2">{fam.family_name}</div>
              <div className="text-sm text-gray-300">Tasks {fam.task_count}</div>

              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Users size={14} /> {fam.member_count || 3} Members
              </div>

              {index === 0 && (
                <div className="champion-badge">👑 Current Champions</div>
              )}

              <div className="mt-3 flex justify-end text-yellow-400 text-xs items-center">
                Visit <ArrowUpRight size={14} className="ml-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend Section */}
      <div className="mt-10 p-4 bg-black/50 rounded-lg">
        <h2 className="text-xl font-bold mb-2">🏠 Family Rank Legend</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <div className="legend-pill bronze">🥉 Bronze Family (0–4 tasks)</div>
          <div className="legend-pill silver">🥈 Silver House (5–9)</div>
          <div className="legend-pill gold">🥇 Gold Tribe (10–14)</div>
          <div className="legend-pill platinum">💎 Platinum Squad (15–19)</div>
          <div className="legend-pill diamond">💠 Diamond Clan (20–29)</div>
          <div className="legend-pill royal">👑 Royal Family (30+)</div>
        </div>
      </div>
    </div>
  )
}
