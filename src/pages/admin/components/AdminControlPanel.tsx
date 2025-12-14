import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { grantAdminCoins } from '../../../lib/adminCoins'
import { toast } from 'sonner'
import { 
  Coins, 
  User, 
  XCircle, 
  Award, 
  CheckCircle, 
  X, 
  Gift,
  AlertTriangle,
  Search
} from 'lucide-react'
import ClickableUsername from '../../../components/ClickableUsername'

export default function AdminControlPanel() {
  const { user, profile, refreshProfile } = useAuthStore()
  const [targetUser, setTargetUser] = useState('')
  const [searchUsername, setSearchUsername] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ 
    id: string
    username: string
    email: string
    paid_coin_balance?: number
    free_coin_balance?: number
    role?: string
  }>>([])
  const [selectedUser, setSelectedUser] = useState<{ 
    id: string
    username: string
    email?: string
    coin_balance?: number
    role?: string
  } | null>(null)
  const [amount, setAmount] = useState(0)
  const [level, setLevel] = useState(1)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  // Verify admin status
  const isAdmin = profile?.role === 'admin' || profile?.is_admin || (user?.email && user.email.toLowerCase() === 'trollcity2025@gmail.com')

  const searchUsers = async (term?: string) => {
    const searchTerm = term !== undefined ? term : searchUsername
    
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, paid_coin_balance, free_coin_balance, role')
        .ilike('username', `%${searchTerm}%`)
        .limit(20)
        .order('username', { ascending: true })

      if (error) throw error

      setSearchResults(data || [])
    } catch (error: any) {
      console.error('Error searching users:', error)
      toast.error('Failed to search users')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  // Debounced search on input change
  const handleSearchChange = (value: string) => {
    setSearchUsername(value)
    if (value.trim()) {
      // Debounce search
      const timeoutId = setTimeout(() => {
        searchUsers(value)
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setSearchResults([])
    }
  }

  const runAction = async (action: string) => {
    if (!isAdmin) {
      toast.error('Only admins can perform this action')
      return
    }

    if (!selectedUser && action !== 'gift_all') {
      toast.error('Please select a user')
      return
    }

    if (!user?.id) {
      toast.error('Please log in')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      let result: { success: boolean; error?: string; message?: string } = { success: false }

      switch (action) {
        case 'grant_coins':
          if (amount <= 0) {
            toast.error('Please enter an amount')
            setLoading(false)
            return
          }
          result = await grantAdminCoins(
            selectedUser!.id,
            amount,
            undefined,
            `${amount.toLocaleString()} coins (Admin Grant)`
          )
          if (result.success) {
            setMessage(`Successfully granted ${amount.toLocaleString()} coins to ${selectedUser!.username}`)
            toast.success(`Granted ${amount.toLocaleString()} coins to ${selectedUser!.username}`)
            setAmount(0)
          }
          break

        case 'zero_coins': {
          if (!selectedUser) {
            toast.error('Please select a user')
            setLoading(false)
            return
          }
          // Get current balance
          const { data: currentProfile } = await supabase
            .from('user_profiles')
            .select('paid_coin_balance, free_coin_balance')
            .eq('id', selectedUser.id)
            .single()

          if (currentProfile) {
            const totalCoins = (currentProfile.paid_coin_balance || 0) + (currentProfile.free_coin_balance || 0)

            // Set both balances to 0
            const { error: updateError } = await supabase
              .from('user_profiles')
              .update({
                paid_coin_balance: 0,
                free_coin_balance: 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', selectedUser.id)

            if (updateError) throw updateError

            // Log transaction
            await supabase
              .from('coin_transactions')
              .insert({
                user_id: selectedUser.id,
                type: 'admin_grant',
                amount: -totalCoins,
                coin_type: 'paid',
                description: `Admin zeroed coins: ${totalCoins.toLocaleString()} coins removed`,
                metadata: {
                  action: 'zero_coins',
                  previous_balance: totalCoins,
                  admin_id: user.id
                },
                balance_after: 0,
                status: 'completed',
                created_at: new Date().toISOString()
              })

            result = { success: true, message: `Zeroed ${totalCoins.toLocaleString()} coins for ${selectedUser.username}` }
            setMessage(result.message)
            toast.success(result.message)
          }
          break
        }

        case 'set_user_level': {
          if (!selectedUser) {
            toast.error('Please select a user')
            setLoading(false)
            return
          }
          if (level < 1 || level > 100) {
            toast.error('Level must be between 1 and 100')
            setLoading(false)
            return
          }

          const { error: levelError } = await supabase
            .from('user_profiles')
            .update({
              tier: level,
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedUser.id)

          if (levelError) throw levelError

          result = { success: true, message: `Set ${selectedUser.username} to level ${level}` }
          setMessage(result.message)
          toast.success(result.message)
          break
        }

        case 'approve_application': {
          if (!selectedUser) {
            toast.error('Please select a user')
            setLoading(false)
            return
          }
          // Find pending application for this user
          const { data: application } = await supabase
            .from('applications')
            .select('id, type')
            .eq('user_id', selectedUser.id)
            .eq('status', 'pending')
            .maybeSingle()

          if (!application) {
            toast.error('No pending application found for this user')
            setLoading(false)
            return
          }

          // Use correct RPC based on application type
          if (application.type === 'troll_officer') {
            // Use approve_officer_application with p_user_id (must match: { p_user_id: application.user_id })
            const { data: approveData, error: approveError } = await supabase.rpc('approve_officer_application', {
              p_user_id: selectedUser.id  // selectedUser.id === application.user_id
            })

            if (approveError) {
              console.error('RPC error (approve_officer_application):', approveError)
              throw approveError
            }

            if (approveData?.success) {
              result = { success: true, message: `Approved officer application for ${selectedUser.username}` }
            } else {
              throw new Error(approveData?.error || 'Failed to approve officer application')
            }
          } else {
            // Use general approve_application for other types
            const { data: approveData, error: approveError } = await supabase.rpc('approve_application', {
              p_app_id: application.id,
              p_reviewer_id: user.id
            })

            if (approveError) throw approveError

            result = { success: true, message: `Approved ${application.type} application for ${selectedUser.username}` }
          }

          setMessage(result.message)
          toast.success(result.message)

          // Refresh profile if granting to self
          if (selectedUser.id === user.id && refreshProfile) {
            await refreshProfile()
          }
          break
        }

        case 'reject_application': {
          if (!selectedUser) {
            toast.error('Please select a user')
            setLoading(false)
            return
          }
          // Find pending application for this user
          const { data: rejectApp } = await supabase
            .from('applications')
            .select('id, type')
            .eq('user_id', selectedUser.id)
            .eq('status', 'pending')
            .maybeSingle()

          if (!rejectApp) {
            toast.error('No pending application found for this user')
            setLoading(false)
            return
          }

          // Use existing reject RPC
          const { data: rejectData, error: rejectError } = await supabase.rpc('deny_application', {
            p_app_id: rejectApp.id,
            p_reviewer_id: user.id
          })

          if (rejectError) throw rejectError

          result = { success: true, message: `Rejected ${rejectApp.type} application for ${selectedUser.username}` }
          setMessage(result.message)
          toast.success(result.message)
          break
        }

        case 'gift_all': {
          if (amount <= 0) {
            toast.error('Please enter an amount')
            setLoading(false)
            return
          }

          // Confirm before gifting to all users
          const confirmed = window.confirm(
            `Are you sure you want to gift ${amount.toLocaleString()} coins to ALL users? This action cannot be undone.`
          )

          if (!confirmed) {
            setLoading(false)
            return
          }

          // Get all user IDs
          const { data: allUsers, error: usersError } = await supabase
            .from('user_profiles')
            .select('id, username')

          if (usersError) throw usersError

          if (!allUsers || allUsers.length === 0) {
            toast.error('No users found')
            setLoading(false)
            return
          }

          let successCount = 0
          let errorCount = 0

          // Grant coins to each user
          for (const targetUser of allUsers) {
            try {
              const grantResult = await grantAdminCoins(
                targetUser.id,
                amount,
                undefined,
                `${amount.toLocaleString()} coins (Admin Gift to All)`
              )
              if (grantResult.success) {
                successCount++
              } else {
                errorCount++
              }
            } catch (err) {
              console.error(`Error granting coins to ${targetUser.username}:`, err)
              errorCount++
            }
          }

          result = {
            success: successCount > 0,
            message: `Gifted ${amount.toLocaleString()} coins to ${successCount} users${errorCount > 0 ? ` (${errorCount} errors)` : ''}`
          }
          setMessage(result.message)
          toast.success(result.message)
          setAmount(0)
          break
        }

        default:
          result = { success: false, error: 'Unknown action' }
      }

      if (!result.success && result.error) {
        setMessage(result.error)
        toast.error(result.error)
      }
    } catch (error: any) {
      console.error('Error performing admin action:', error)
      const errorMsg = error.message || 'Failed to perform action'
      setMessage(errorMsg)
      toast.error(errorMsg)
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
          <Award className="w-6 h-6 text-purple-400" />
          Admin Control Panel
        </h2>

        {/* User Search Panel */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Search Users → Select → Admin Actions</label>
          
          {selectedUser ? (
            <div className="flex items-center justify-between bg-purple-500/20 border border-purple-500/30 rounded-lg p-3 mb-2">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <ClickableUsername userId={selectedUser.id} username={selectedUser.username} />
                    {selectedUser.role && (
                      <span className="text-xs px-2 py-0.5 bg-purple-500/30 rounded text-purple-300">
                        {selectedUser.role}
                      </span>
                    )}
                  </div>
                  {selectedUser.email && (
                    <div className="text-xs text-gray-400">{selectedUser.email}</div>
                  )}
                  {selectedUser.coin_balance !== undefined && (
                    <div className="text-xs text-yellow-400">
                      Coins: {selectedUser.coin_balance.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null)
                  setSearchResults([])
                  setSearchUsername('')
                }}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-red-500/20"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={searchUsername}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search users by username..."
                className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              
              {searching && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                  Searching...
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="bg-zinc-900/90 border border-gray-700 rounded-lg max-h-64 overflow-y-auto">
                  {searchResults.map((u) => {
                    const totalCoins = (u.paid_coin_balance || 0) + (u.free_coin_balance || 0)
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedUser({
                            id: u.id,
                            username: u.username,
                            email: u.email,
                            coin_balance: totalCoins,
                            role: u.role
                          })
                          setSearchResults([])
                          setSearchUsername('')
                        }}
                        className="p-3 bg-black/30 hover:bg-purple-500/20 border-b border-gray-700 last:border-b-0 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="font-semibold flex items-center gap-2">
                                {u.username}
                                {u.role && (
                                  <span className="text-xs px-1.5 py-0.5 bg-purple-500/30 rounded text-purple-300">
                                    {u.role}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400">{u.email}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-yellow-400">
                              {totalCoins.toLocaleString()} coins
                            </div>
                            <div className="text-xs text-gray-500">
                              Paid: {(u.paid_coin_balance || 0).toLocaleString()} | Free: {(u.free_coin_balance || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {searchUsername.trim() && !searching && searchResults.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-2">
                  No users found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Amount (Coins)</label>
          <input
            type="number"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Enter coin amount..."
            className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
          />
        </div>

        {/* Level Input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Level (1-100)</label>
          <input
            type="number"
            min="1"
            max="100"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white"
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => runAction('grant_coins')}
            disabled={loading || !selectedUser || amount <= 0}
            className="px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Coins className="w-5 h-5" />
            Grant Coins
          </button>

          <button
            onClick={() => runAction('zero_coins')}
            disabled={loading || !selectedUser}
            className="px-4 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <XCircle className="w-5 h-5" />
            Zero Coins
          </button>

          <button
            onClick={() => runAction('set_user_level')}
            disabled={loading || !selectedUser}
            className="px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Award className="w-5 h-5" />
            Set User Level
          </button>

          <button
            type="button"
            onClick={() => runAction('approve_application')}
            disabled={loading || !selectedUser}
            className="px-4 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Approve Officer
          </button>

          <button
            onClick={() => runAction('reject_application')}
            disabled={loading || !selectedUser}
            className="px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Reject Officer
          </button>

          <button
            onClick={() => runAction('gift_all')}
            disabled={loading || amount <= 0}
            className="px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 col-span-2"
          >
            <Gift className="w-5 h-5" />
            Gift Coins to ALL Users
          </button>
        </div>

        {loading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
            Processing...
          </div>
        )}

        {message && (
          <div className={`mt-4 p-4 rounded-lg ${
            message.includes('Success') || message.includes('granted') || message.includes('Set') || message.includes('Approved') || message.includes('Rejected') || message.includes('Gifted')
              ? 'bg-green-600/50 border border-green-500/30 text-green-200'
              : 'bg-red-600/50 border border-red-500/30 text-red-200'
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* Warning Card */}
      <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-2">⚠️ Admin Actions Warning</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• All actions are logged and auditable</li>
              <li>• "Zero Coins" sets both paid and free balances to 0</li>
              <li>• "Gift to All" affects every user in the system</li>
              <li>• Application actions require a pending application</li>
              <li>• Use with caution - these actions cannot be easily undone</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

