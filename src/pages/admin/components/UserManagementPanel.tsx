import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { User, Coins, Award, Shield, Save, X, Search } from 'lucide-react'

interface UserProfile {
  id: string
  username: string
  email: string
  role: string
  troll_coins: number
  free_coin_balance: number
  level: number
  is_troll_officer: boolean
  is_admin: boolean
  is_troller: boolean
  created_at: string
}

export default function UserManagementPanel() {
  const { profile: adminProfile } = useAuthStore()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [editingCoins, setEditingCoins] = useState({ paid: 0, free: 0 })
  const [editingLevel, setEditingLevel] = useState(0)
  const [editingRole, setEditingRole] = useState('user')
  const [saving, setSaving] = useState(false)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, role, troll_coins, free_coin_balance, level, is_troll_officer, is_admin, is_troller, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setUsers(data || [])
    } catch (error: any) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()

    const channel = supabase
      .channel('users_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        () => loadUsers()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user)
    setEditingCoins({ paid: user.troll_coins || 0, free: user.free_coin_balance || 0 })
    setEditingLevel(user.level || 1)
    setEditingRole(user.role || 'user')
  }

  const handleSaveChanges = async () => {
    if (!selectedUser || !adminProfile) {
      toast.error('No user selected')
      return
    }

    // Verify admin
    if (adminProfile.role !== 'admin' && !adminProfile.is_admin) {
      toast.error('Admin access required')
      return
    }

    setSaving(true)
    try {
      const updates: any = {
        troll_coins: editingCoins.paid,
        free_coin_balance: editingCoins.free,
        level: editingLevel,
        role: editingRole,
        updated_at: new Date().toISOString()
      }

      // Update role-specific flags
      if (editingRole === 'admin') {
        updates.is_admin = true
        updates.is_troll_officer = false
        updates.is_troller = false
      } else if (editingRole === 'troll_officer') {
        updates.is_troll_officer = true
        updates.is_admin = false
        updates.is_troller = false
      } else if (editingRole === 'troller') {
        updates.is_troller = true
        updates.is_admin = false
        updates.is_troll_officer = false
      } else {
        updates.is_admin = false
        updates.is_troll_officer = false
        updates.is_troller = false
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', selectedUser.id)

      if (error) throw error

      // Log the admin action
      await supabase.from('coin_transactions').insert({
        user_id: selectedUser.id,
        type: 'admin_adjustment',
        amount: editingCoins.paid - (selectedUser.troll_coins || 0),
        description: `Admin adjustment: ${adminProfile.username} updated user ${selectedUser.username}`,
        metadata: {
          admin_id: adminProfile.id,
          previous_balance: selectedUser.troll_coins,
          new_balance: editingCoins.paid,
          previous_level: selectedUser.level,
          new_level: editingLevel,
          previous_role: selectedUser.role,
          new_role: editingRole
        }
      }).catch(err => console.error('Error logging admin action:', err))

      toast.success('User updated successfully')
      setSelectedUser(null)
      loadUsers()
    } catch (error: any) {
      console.error('Error updating user:', error)
      toast.error(error?.message || 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = users.filter(user => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        user.username?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        user.id.toLowerCase().includes(search)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <User className="w-6 h-6 text-purple-400" />
          User Management
        </h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by username, email, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No users found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="pb-3 text-gray-400 font-semibold">Username</th>
                <th className="pb-3 text-gray-400 font-semibold">Email</th>
                <th className="pb-3 text-gray-400 font-semibold">Role</th>
                <th className="pb-3 text-gray-400 font-semibold">Level</th>
                <th className="pb-3 text-gray-400 font-semibold">Paid Coins</th>
                <th className="pb-3 text-gray-400 font-semibold">Free Coins</th>
                <th className="pb-3 text-gray-400 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                  <td className="py-3 text-white">{user.username}</td>
                  <td className="py-3 text-gray-400 text-sm">{user.email}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.role === 'admin'
                        ? 'bg-red-900 text-red-300'
                        : user.role === 'troll_officer'
                        ? 'bg-purple-900 text-purple-300'
                        : user.role === 'troller'
                        ? 'bg-blue-900 text-blue-300'
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td className="py-3 text-white">{user.level || 1}</td>
                  <td className="py-3 text-purple-300">{user.troll_coins?.toLocaleString() || 0}</td>
                  <td className="py-3 text-green-300">{user.free_coin_balance?.toLocaleString() || 0}</td>
                  <td className="py-3">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Edit User: {selectedUser.username}</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Coins */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <Coins className="w-4 h-4 inline mr-1" />
                  Paid Coins
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingCoins.paid}
                  onChange={(e) => setEditingCoins({ ...editingCoins, paid: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <Coins className="w-4 h-4 inline mr-1" />
                  Free Coins
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingCoins.free}
                  onChange={(e) => setEditingCoins({ ...editingCoins, free: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Level */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <Award className="w-4 h-4 inline mr-1" />
                  Level
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editingLevel}
                  onChange={(e) => setEditingLevel(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <Shield className="w-4 h-4 inline mr-1" />
                  Role
                </label>
                <select
                  value={editingRole}
                  onChange={(e) => setEditingRole(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="user">User</option>
                  <option value="troll_officer">Troll Officer</option>
                  <option value="troller">Troller</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

