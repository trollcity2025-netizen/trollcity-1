import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Shield, X, Search, CheckCircle } from 'lucide-react'
import VerifiedBadge from '../../components/VerifiedBadge'

interface VerifiedUser {
  id: string
  username: string | null
  email: string | null
  is_verified: boolean
  verification_date: string | null
  verification_paid_amount: number | null
  verification_payment_method: string | null
  created_at: string
}

export default function AdminVerifiedUsers() {
  const { profile } = useAuthStore()
  const [users, setUsers] = useState<VerifiedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)

  const isAdmin = profile?.role === 'admin' || profile?.is_admin

  useEffect(() => {
    if (!isAdmin) return

    loadUsers()

    const channel = supabase
      .channel('verified_users_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        () => loadUsers()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAdmin])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, is_verified, verification_date, verification_paid_amount, verification_payment_method, created_at')
        .eq('is_verified', true)
        .order('verification_date', { ascending: false })

      if (error) throw error
      setUsers((data as any) || [])
    } catch (error: any) {
      console.error('Error loading users:', error)
      toast.error('Failed to load verified users')
    } finally {
      setLoading(false)
    }
  }

  const removeVerification = async (userId: string) => {
    if (!confirm('Are you sure you want to remove verification from this user?')) {
      return
    }

    setRemovingId(userId)
    try {
      const { error } = await supabase.rpc('remove_verification', {
        p_user_id: userId
      })

      if (error) throw error

      toast.success('Verification removed')
      loadUsers()
    } catch (error: any) {
      console.error('Error removing verification:', error)
      toast.error(error?.message || 'Failed to remove verification')
    } finally {
      setRemovingId(null)
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

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-white">
        Admin access only.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto text-white min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-purple-400" />
        <h1 className="text-3xl font-bold">Verified Users Management</h1>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by username, email, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-black/60 border border-purple-600 rounded-lg p-4">
          <div className="text-sm opacity-70 mb-1">Total Verified</div>
          <div className="text-2xl font-bold">{users.length}</div>
        </div>
        <div className="bg-black/60 border border-blue-600 rounded-lg p-4">
          <div className="text-sm opacity-70 mb-1">PayPal Payments</div>
          <div className="text-2xl font-bold">
            {users.filter(u => u.verification_payment_method === 'paypal').length}
          </div>
        </div>
        <div className="bg-black/60 border border-green-600 rounded-lg p-4">
          <div className="text-sm opacity-70 mb-1">Coin Payments</div>
          <div className="text-2xl font-bold">
            {users.filter(u => u.verification_payment_method === 'coins').length}
          </div>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading verified users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No verified users found</div>
      ) : (
        <div className="bg-black/60 border border-purple-600 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-3 text-left text-gray-400">User</th>
                <th className="p-3 text-left text-gray-400">Verified Date</th>
                <th className="p-3 text-left text-gray-400">Payment Method</th>
                <th className="p-3 text-left text-gray-400">Amount</th>
                <th className="p-3 text-left text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{user.username || 'Unknown'}</span>
                      <VerifiedBadge size="sm" />
                    </div>
                    <div className="text-xs opacity-70">{user.email}</div>
                  </td>
                  <td className="p-3 text-sm">
                    {user.verification_date 
                      ? new Date(user.verification_date).toLocaleDateString()
                      : 'N/A'
                    }
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.verification_payment_method === 'paypal'
                        ? 'bg-blue-900 text-blue-300'
                        : 'bg-purple-900 text-purple-300'
                    }`}>
                      {user.verification_payment_method || 'N/A'}
                    </span>
                  </td>
                  <td className="p-3">
                    {user.verification_paid_amount 
                      ? user.verification_payment_method === 'coins'
                        ? `${user.verification_paid_amount} coins`
                        : `$${user.verification_paid_amount}`
                      : 'N/A'
                    }
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => removeVerification(user.id)}
                      disabled={removingId === user.id}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm disabled:opacity-50"
                    >
                      {removingId === user.id ? 'Removing...' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

