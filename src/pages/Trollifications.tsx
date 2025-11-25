import React from 'react'
import { useAuthStore } from '../lib/store'

const EFFECTS = [
  { id: 'badge_royal', name: 'Royal Badge', icon: '👑' },
  { id: 'entrance_neon', name: 'Neon Entrance', icon: '✨' },
  { id: 'username_glow', name: 'Glowing Username', icon: '🔆' },
  { id: 'troll_avatar', name: 'Troll Avatar Style', icon: '🧌' },
]

export default function Trollifications() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 bg-clip-text text-transparent mb-6">
          Trollifications
        </h1>

        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
          <p className="text-sm text-gray-300 mb-4">
            Visual effects and identity styles for profiles and entrances.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {EFFECTS.map((e) => (
              <div key={e.id} className="bg-[#0D0D0D] rounded-lg p-4 border border-[#2C2C2C] hover:border-purple-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="text-2xl">{e.icon}</div>
                  <div className="text-xs px-2 py-1 rounded-full bg-purple-900/60 border border-purple-500/50">
                    Style
                  </div>
                </div>
                <div className="mt-2 font-semibold">{e.name}</div>
                <div className="text-xs text-gray-400">Apply via profile and entrance settings</div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="mt-6 text-xs text-gray-400">
              Admins preview all effects without purchase requirements.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
