import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { 
  User, 
  Award, 
  CheckCircle, 
  X, 
  AlertTriangle
} from 'lucide-react'
import UserNameWithAge from '../../../components/UserNameWithAge'


export default function AdminControlPanel() {
  const { user, profile, refreshProfile } = useAuthStore()
  const [searchUsername, setSearchUsername] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    id: string
    username: string
    email: string
    troll_coins?: number
    role?: string
    rgb_username_expires_at?: string
    created_at?: string
  }>>([])
  const [selectedUser, setSelectedUser] = useState<{ 
    id: string
    username: string
    email?: string
    troll_coins?: number
    role?: string
    rgb_username_expires_at?: string
    created_at?: string
  } | null>(null)
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
        .select('id, username, email, troll_coins, role, rgb_username_expires_at, created_at')
        .ilike('username', `%${searchTerm}%`)
        .limit(20)
        .order('username', { ascending: true })

      if (error) throw error

      setSearchResults(data || [])
    } catch (error) {
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

    if (!selectedUser) {
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

          const { error: levelError } = await supabase.functions.invoke('admin-actions', {
            body: {
              action: 'update_user_profile',
              userId: selectedUser.id,
              updates: {
                tier: level
              }
            }
          })

          if (levelError) throw levelError

          result = { success: true, message: `Set ${selectedUser.username} to level ${level}` }
          setMessage(result.message || '')
          toast.success(result.message || '')
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

          const { data: approveData, error: approveError } = await supabase.functions.invoke('admin-actions', {
            body: {
              action: 'approve_application',
              applicationId: application.id,
              type: application.type,
              userId: selectedUser.id
            }
          })

          if (approveError) {
            console.error('Edge Function error (approve_application):', approveError)
            throw approveError
          }
          
          if (approveData?.error) {
             throw new Error(approveData.error)
          }

          result = { success: true, message: `Approved ${application.type} application for ${selectedUser.username}` }

          setMessage(result.message || '')
          toast.success(result.message || '')

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

          const { error: rejectError } = await supabase.functions.invoke('admin-actions', {
            body: {
              action: 'deny_application',
              applicationId: rejectApp.id,
              reason: 'Rejected via Admin Control Panel'
            }
          })

          if (rejectError) throw rejectError

          result = { success: true, message: `Rejected ${rejectApp.type} application for ${selectedUser.username}` }
          setMessage(result.message)
          toast.success(result.message)
          break
        }

        default:
          result = { success: false, error: 'Unknown action' }
      }

      if (!result.success && result.error) {
        setMessage(result.error)
        toast.error(result.error)
      }
    } catch (error: unknown) {
      console.error('Error performing admin action:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to perform action'
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
      {/* Broadcast Lockdown Control - Top Priority */}
      <BroadcastLockdownToggle />

      {/* Rest of Admin Controls */}
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
                    <UserNameWithAge 
                      user={{
                        id: selectedUser.id,
                        username: selectedUser.username,
                        created_at: selectedUser.created_at
                      }}
                    />
                    {selectedUser.role && (
                      <span className="text-xs px-2 py-0.5 bg-purple-500/30 rounded text-purple-300">
                        {selectedUser.role}
                      </span>
                    )}
                  </div>
                  {selectedUser.email && (
                    <div className="text-xs text-gray-400">{selectedUser.email}</div>
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
                  {searchResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedUser({
                          id: u.id,
                          username: u.username,
                          email: u.email,
                          troll_coins: u.troll_coins || 0,
                          role: u.role,
                          rgb_username_expires_at: u.rgb_username_expires_at,
                          created_at: u.created_at
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
                              <UserNameWithAge 
                                user={{
                                  username: u.username,
                                  created_at: u.created_at
                                }}
                                className={u.rgb_username_expires_at && new Date(u.rgb_username_expires_at) > new Date() ? 'rgb-username' : ''}
                              />
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
                            {(u.troll_coins || 0).toLocaleString()} coins
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
        </div>

        {loading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
            Processing...
          </div>
        )}

        {message && (
          <div className={`mt-4 p-4 rounded-lg ${
            message.includes('Success') || message.includes('Set') || message.includes('Approved') || message.includes('Rejected')
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
              <li>• Application actions require a pending application</li>
              <li>• Use with caution - these actions cannot be easily undone</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
