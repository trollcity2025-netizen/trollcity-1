import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { grantAdminCoins } from '../../../lib/adminCoins'
import { toast } from 'sonner'
import { Coins, User } from 'lucide-react'
import ClickableUsername from '../../../components/ClickableUsername'

interface AdminGrantCoinsProps {
  targetUserId?: string | null
  targetUsername?: string | null
}

export function AdminGrantCoins({ targetUserId, targetUsername }: AdminGrantCoinsProps) {
  const { user, profile, refreshProfile } = useAuthStore()
  const [amount, setAmount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searchUsername, setSearchUsername] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; email: string }>>([])
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string } | null>(
    targetUserId && targetUsername ? { id: targetUserId, username: targetUsername } : null
  )
  const [searching, setSearching] = useState(false)

  // Verify admin status
  const isAdmin = profile?.role === 'admin' || profile?.is_admin || (user?.email && user.email.toLowerCase() === 'trollcity2025@gmail.com')

  const searchUsers = async () => {
    if (!searchUsername.trim()) {
      toast.error('Enter a username to search')
      return
    }

    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, email')
        .ilike('username', `%${searchUsername}%`)
        .limit(10)

      if (error) throw error

      setSearchResults(data || [])
      if (data && data.length === 0) {
        toast.info('No users found')
      }
    } catch (error: any) {
      console.error('Error searching users:', error)
      toast.error('Failed to search users')
    } finally {
      setSearching(false)
    }
  }

  const grant = async () => {
    if (!isAdmin) {
      toast.error('Only admins can grant coins')
      return
    }

    if (!selectedUser) {
      toast.error('Please select a user')
      return
    }

    if (amount <= 0) {
      toast.error('Please select an amount')
      return
    }

    if (!user?.id) {
      toast.error('Please log in')
      return
    }

    setLoading(true)

    try {
      const result = await grantAdminCoins(
        selectedUser.id,
        amount,
        undefined,
        `${amount.toLocaleString()} coins (Admin Grant)`
      )

      if (result.success) {
        toast.success(`Successfully granted ${amount.toLocaleString()} coins to ${selectedUser.username}!`)
        setAmount(0)
        
        // Refresh profile if granting to self
        if (selectedUser.id === user.id && refreshProfile) {
          await refreshProfile()
        }
      } else {
        toast.error(result.error || 'Failed to grant coins')
      }
    } catch (error: any) {
      console.error('Error granting coins:', error)
      toast.error(error.message || 'Failed to grant coins')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="bg-red-500/20 border border-red-500 rounded-xl p-6">
        <p className="text-red-400">Access denied. Admin only.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Coins className="w-6 h-6 text-yellow-400" />
          Admin: Grant Coins
        </h2>

        {/* User Search */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Select User</label>
          {selectedUser ? (
            <div className="flex items-center justify-between bg-purple-500/20 border border-purple-500/30 rounded-lg p-3 mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <ClickableUsername userId={selectedUser.id} username={selectedUser.username} />
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null)
                  setSearchResults([])
                  setSearchUsername('')
                }}
                className="text-xs text-gray-400 hover:text-white"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      searchUsers()
                    }
                  }}
                  placeholder="Search by username..."
                  className="flex-1 px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                />
                <button
                  onClick={searchUsers}
                  disabled={searching}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold disabled:opacity-50"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="bg-zinc-900 border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUser({ id: u.id, username: u.username })
                        setSearchResults([])
                        setSearchUsername('')
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-purple-500/20 border-b border-gray-700 last:border-b-0 flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="font-semibold">{u.username}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coin Amount Selector */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Select Amount</label>
          <select
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-4 py-3 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="0">Select amount...</option>
            <option value="500">500 Coins (Level 1)</option>
            <option value="1500">1,500 Coins (Level 2)</option>
            <option value="3000">3,000 Coins (Level 3)</option>
            <option value="7000">7,000 Coins (Payout Minimum)</option>
            <option value="10000">10,000 Coins</option>
            <option value="50000">50,000 Coins</option>
            <option value="100000">100,000 Coins</option>
          </select>
        </div>

        {/* Grant Button */}
        <button
          disabled={loading || !selectedUser || amount <= 0}
          onClick={grant}
          className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Granting...
            </>
          ) : (
            <>
              <Coins className="w-5 h-5" />
              Grant Coins
            </>
          )}
        </button>

        {selectedUser && amount > 0 && (
          <p className="text-sm text-gray-400 text-center mt-2">
            Will grant {amount.toLocaleString()} coins to {selectedUser.username}
          </p>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4">
        <h3 className="font-semibold mb-2">ℹ️ Admin Coin Grants</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• Grants are logged in coin_transactions with type: 'admin_grant'</li>
          <li>• Coins are added to the user's paid_coin_balance</li>
          <li>• All grants are auditable in the transaction history</li>
          <li>• No payment processing is involved</li>
        </ul>
      </div>
    </div>
  )
}

