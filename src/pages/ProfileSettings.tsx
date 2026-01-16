import React from 'react'
import { useAuthStore } from '../lib/store'
import { useNavigate } from 'react-router-dom'
import { Settings, Boxes, Sparkles } from 'lucide-react'
import UserInventory from './UserInventory'

export default function ProfileSettings() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  if (!user) {
    navigate('/auth')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Profile Settings</h1>
            <p className="text-sm text-gray-400">Manage your items and account preferences.</p>
          </div>
        </div>

        <div className="bg-black/40 border border-purple-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Boxes className="w-5 h-5 text-purple-300" />
            <h2 className="text-xl font-semibold">My Items</h2>
          </div>
          <UserInventory embedded />
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-pink-400" />
            <div>
              <h2 className="text-lg font-semibold">Avatar Customizer</h2>
              <p className="text-xs text-gray-400">Equip clothing and update your look.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/avatar-customizer')}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm font-semibold"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  )
}
