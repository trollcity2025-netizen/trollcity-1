import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { User, Coins, Award, Shield, Save, X, Search } from 'lucide-react'
import ClickableUsername from '../../../components/ClickableUsername'
import UserDetailsModal from '../../../components/admin/UserDetailsModal'

interface UserProfile {
  id: string
  username: string
  email?: string
  role: string
  troll_coins: number
  free_coin_balance: number
  level: number
  is_troll_officer: boolean
  is_lead_officer?: boolean
  is_admin: boolean
  is_troller: boolean
  created_at: string
  updated_at?: string
  full_name?: string | null
  phone?: string | null
  onboarding_completed?: boolean | null
  terms_accepted?: boolean | null
  id_verification_status?: string | null
}

interface UserManagementPanelProps {
  title?: string
  description?: string
}

export default function UserManagementPanel({
  title = 'User Management',
  description
}: UserManagementPanelProps) {
  const { profile: adminProfile, user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [editingCoins, setEditingCoins] = useState({ paid: 0, free: 0 })
  const [editingLevel, setEditingLevel] = useState(1)
  const [editingRole, setEditingRole] = useState('user')
  const [saving, setSaving] = useState(false)
  const [viewingUser, setViewingUser] = useState<{ id: string; username: string } | null>(null)
  const [notifying, setNotifying] = useState(false)

  const canViewEmails = adminProfile?.role === 'admin' || adminProfile?.is_admin === true
  const canViewDetails = adminProfile?.role === 'admin' || adminProfile?.is_admin === true || adminProfile?.role === 'secretary'

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const selectFields = canViewEmails
        ? 'id, username, email, role, troll_coins, free_coin_balance, level, is_troll_officer, is_lead_officer, is_admin, is_troller, created_at, full_name, phone, onboarding_completed, terms_accepted, id_verification_status'
        : 'id, username, role, troll_coins, free_coin_balance, level, is_troll_officer, is_lead_officer, is_admin, is_troller, created_at, full_name, phone, onboarding_completed, terms_accepted, id_verification_status'

      const { data, error } = await (supabase as any)
        .from('user_profiles')
        // supabase-js types can't infer dynamic select strings; using explicit return type cast below
        .select(selectFields)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setUsers((data as unknown as UserProfile[]) || [])
    } catch (error: unknown) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [canViewEmails])

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
  }, [loadUsers])

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

    // PROTECT OWNER ADMIN ACCOUNT
    const OWNER_EMAIL = 'trollcity2025@gmail.com'
    const isTargetOwner = selectedUser.email?.toLowerCase() === OWNER_EMAIL
    const isCurrentOwner = currentUser?.email?.toLowerCase() === OWNER_EMAIL

    if (isTargetOwner && !isCurrentOwner) {
      // Prevent removing admin role from owner
      if (editingRole !== 'admin') {
        toast.error('CRITICAL: You cannot remove Admin privileges from the Owner account.')
        return
      }
    }

    setSaving(true)
    try {
      // 1. Prepare updates for non-Troll Bank fields
      const updates: Partial<UserProfile> = {
        free_coin_balance: editingCoins.free,
        level: editingLevel,
        // role: editingRole, // Handled via RPC
        updated_at: new Date().toISOString()
      }

      // 2. Execute direct update for basic fields
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', selectedUser.id)

      if (error) throw error

      // 3. Handle Role Update via Secure RPC if changed
      if (editingRole !== selectedUser.role) {
        const { error: roleError } = await supabase.rpc('set_user_role', {
          target_user: selectedUser.id,
          new_role: editingRole,
          reason: `Admin panel update by ${adminProfile.username}`
        })
        
        if (roleError) {
          console.error('Error setting role:', roleError)
          toast.error('Failed to update role: ' + roleError.message)
        }
      }

      // 4. Handle Troll Coins via Troll Bank RPC
      const currentTrollCoins = selectedUser.troll_coins || 0
      const newTrollCoins = editingCoins.paid
      const delta = newTrollCoins - currentTrollCoins

      if (delta !== 0) {
        if (delta > 0) {
           // Credit
           const { error: creditError } = await supabase.rpc('troll_bank_credit_coins', {
             p_user_id: selectedUser.id,
             p_coins: delta,
             p_bucket: 'paid', // Admin adjustment treated as paid/generic
             p_source: 'admin_grant',
             p_ref_id: null,
             p_metadata: { admin_id: adminProfile.id, reason: 'Manual Adjustment' }
           })
           if (creditError) {
             console.error('Error crediting coins:', creditError)
             toast.error('Failed to update coin balance')
           }
        } else {
           // Debit
           const { error: spendError } = await supabase.rpc('troll_bank_spend_coins_secure', {
             p_user_id: selectedUser.id,
             p_amount: Math.abs(delta),
             p_bucket: 'paid',
             p_source: 'admin_deduct',
             p_ref_id: null,
             p_metadata: { admin_id: adminProfile.id, reason: 'Manual Adjustment' }
           })
           if (spendError) {
             console.error('Error deducting coins:', spendError)
             toast.error('Failed to update coin balance')
           }
        }
      }

      // Log the admin action
      const { error: logError } = await supabase.from('coin_transactions').insert({
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
      })
      if (logError) {
        console.error('Error logging admin action:', logError)
      }

      toast.success('User updated successfully')
      setSelectedUser(null)
      loadUsers()
    } catch (error: unknown) {
      console.error('Error updating user:', error)
      toast.error((error as Error)?.message || 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = users.filter(user => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        user.username?.toLowerCase().includes(search) ||
        (canViewEmails && user.email?.toLowerCase().includes(search)) ||
        user.id.toLowerCase().includes(search)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
  <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <User className="w-6 h-6 text-purple-400" />
          {title}
        </h2>
        {description && (
          <p className="text-sm text-gray-400">{description}</p>
        )}
      </div>

      {canViewDetails && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={async () => {
              if (!adminProfile) {
                toast.error('Profile required')
                return
              }
              if (!(adminProfile.role === 'admin' || adminProfile.is_admin || adminProfile.role === 'secretary')) {
                toast.error('Admin or secretary access required')
                return
              }

              setNotifying(true)
              try {
                const buildMissing = (u: UserProfile) => {
                  const items: string[] = []
                  if (!u.full_name) items.push('Full name')
                  if (!u.phone) items.push('Phone number')
                  if (!u.onboarding_completed) items.push('Onboarding')
                  if (!u.terms_accepted) items.push('Terms acceptance')
                  if (u.id_verification_status !== 'approved') items.push('ID verification')
                  return items
                }

                const targets = users
                  .map(u => ({ user: u, missing: buildMissing(u) }))
                  .filter(({ missing }) => missing.length > 0)

                if (targets.length === 0) {
                  toast.info('All users are complete—no notifications sent')
                  return
                }

                let sent = 0
                for (const { user: u, missing } of targets) {
                  const { error } = await supabase.rpc('notify_user_rpc', {
                    p_target_user_id: u.id,
                    p_type: 'system_alert',
                    p_title: 'Complete your account',
                    p_message: `Please complete the following: ${missing.join(', ')}.`
                  })
                  if (!error) {
                    sent += 1
                  } else {
                    console.warn('Notify user failed', { userId: u.id, error })
                  }
                }

                toast.success(`Notified ${sent} user(s) with missing items`)
              } catch (err) {
                console.error('Notify incomplete users failed', err)
                toast.error('Failed to send notifications')
              } finally {
                setNotifying(false)
              }
            }}
            disabled={notifying}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {notifying ? 'Sending...' : 'Notify users with missing items'}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={canViewEmails ? "Search by username, email, or ID..." : "Search by username or ID..."}
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
                {canViewEmails && (
                  <th className="pb-3 text-gray-400 font-semibold">Email</th>
                )}
                <th className="pb-3 text-gray-400 font-semibold">Role</th>
                <th className="pb-3 text-gray-400 font-semibold">Level</th>
                <th className="pb-3 text-gray-400 font-semibold">Paid Coins</th>
                <th className="pb-3 text-gray-400 font-semibold">Free Coins</th>
                <th className="pb-3 text-gray-400 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-gray-800 last:border-0"
                >
                  <td className="py-3">
                    {canViewDetails ? (
                      <button
                        onClick={() => setViewingUser({ id: user.id, username: user.username })}
                        className="text-white hover:text-purple-400 font-medium underline transition-colors"
                      >
                        {user.username}
                      </button>
                    ) : (
                      <ClickableUsername
                        username={user.username}
                        userId={user.id}
                        profile={user}
                        className="text-white hover:text-purple-400"
                      />
                    )}
                  </td>
                  {canViewEmails && (
                    <td className="py-3 text-gray-400 text-sm">{user.email}</td>
                  )}
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      (user.is_lead_officer || user.role === 'lead_troll_officer')
                        ? 'bg-amber-900 text-amber-300'
                        : user.role === 'admin'
                        ? 'bg-red-900 text-red-300'
                        : user.role === 'troll_officer'
                        ? 'bg-purple-900 text-purple-300'
                        : user.role === 'troller'
                        ? 'bg-blue-900 text-blue-300'
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      {(user.is_lead_officer || user.role === 'lead_troll_officer') ? 'lead_troll_officer' : (user.role || 'user')}
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
                  <option value="secretary">Secretary</option>
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

      {/* User Details Modal */}
      {viewingUser && (
        <UserDetailsModal
          userId={viewingUser.id}
          username={viewingUser.username}
          onClose={() => setViewingUser(null)}
        />
      )}
    </div>
  )
}

