import React from 'react'
import { useAuthStore } from '../lib/store'
import { useNavigate } from 'react-router-dom'
import { Settings, Boxes, Sparkles, KeyRound } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { setResetPin } from '@/services/passwordManager'
import UserInventory from './UserInventory'
import { supabase } from '../lib/supabase'

export default function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  
  // Profile Edit State
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '')
      setFullName((profile as any).full_name || '')
      setBio(profile.bio || '')
    }
  }, [profile])

  const handleSaveProfile = async () => {
    if (!user) return
    
    const newUsername = username.trim()
    if (!newUsername) {
      toast.error('Username cannot be empty')
      return
    }
    
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(newUsername)) {
      toast.error('Username must be 2-20 characters (letters, numbers, underscores)')
      return
    }

    setSavingProfile(true)
    try {
      // Check availability if changed
      if (profile?.username !== newUsername) {
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', newUsername)
          .neq('id', user.id)
          .maybeSingle()
          
        if (existing) {
          toast.error('Username is already taken')
          setSavingProfile(false)
          return
        }
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          username: newUsername,
          full_name: fullName.trim(),
          bio: bio.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      toast.success('Profile updated successfully')
    } catch (err) {
      console.error('Error updating profile:', err)
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

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

        {/* Profile Details Edit */}
        <div className="bg-black/40 border border-purple-500/20 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Profile Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="Your Name"
              />
              <p className="text-xs text-gray-500">Used for password recovery.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="Username"
              />
              <p className="text-xs text-gray-500">Letters, numbers, and underscores only.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Bio</label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="Tell us about yourself"
                maxLength={160}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold disabled:opacity-50 transition-colors"
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="bg-black/40 border border-purple-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Boxes className="w-5 h-5 text-purple-300" />
            <h2 className="text-xl font-semibold">My Items</h2>
          </div>
          <UserInventory embedded />
        </div>

        {/* Password Reset PIN */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-semibold">Password Reset PIN</h2>
              <p className="text-xs text-gray-400">Set a 6-digit PIN used to reset your password.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              inputMode="numeric"
              pattern="\\d*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                setPin(v)
              }}
              placeholder="Enter 6-digit PIN"
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white w-48 tracking-widest"
            />
            <button
              disabled={savingPin || pin.length !== 6}
              onClick={async () => {
                if (pin.length !== 6) {
                  toast.error('PIN must be exactly 6 digits')
                  return
                }
                setSavingPin(true)
                const { error } = await setResetPin(pin)
                setSavingPin(false)
                if (error) {
                  toast.error('Failed to save PIN')
                } else {
                  toast.success('Password reset PIN saved')
                  setPin('')
                }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold disabled:opacity-50"
            >
              {savingPin ? 'Saving...' : 'Save PIN'}
            </button>
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-pink-400" />
            <div>
              <h2 className="text-lg font-semibold">Profile Picture Customizer</h2>
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
