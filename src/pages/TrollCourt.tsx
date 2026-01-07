import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase, UserRole } from '../lib/supabase'
import { startCourtSession } from '../lib/courtSessions'
import { Scale, Gavel, Users, Clock, AlertTriangle, CheckCircle, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import UserSearchDropdown from '../components/UserSearchDropdown'

export default function TrollCourt() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [courtSession, setCourtSession] = useState<any>(null)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [pendingSummons, setPendingSummons] = useState<any[]>([])
  
  // New state for features
  const [recentCases, setRecentCases] = useState<any[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userList, setUserList] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)

  const [selectedCaseType, setSelectedCaseType] = useState<string>('')
  
  const CASE_TYPES = [
    'Harassment / Threats',
    'Hate Speech / Discrimination',
    'Nudity / Sexual Content',
    'Doxxing / Personal Info',
    'Scamming / Fraud',
    'Chargeback / Payment Abuse',
    'Gift Manipulation / Fake gifting',
    'Ban Evasion',
    'Family War Dispute',
    'Streamer Misconduct',
    'Officer Misconduct',
    'Appeal Case',
    'Copyright / Content Claim',
    'TrollCourt Civil Case',
    'TrollCity Policy Violation'
  ]

  const canStartCourt =
    profile?.role === UserRole.ADMIN ||
    profile?.role === UserRole.LEAD_TROLL_OFFICER ||
    profile?.role === UserRole.SECRETARY ||
    (profile as any)?.is_admin === true ||
    (profile as any)?.is_lead_officer === true

  // Fetch recent cases
  useEffect(() => {
    const fetchCases = async () => {
      const { data } = await supabase
        .from('court_cases')
        .select('*, defendant:defendant_id(username), plaintiff:plaintiff_id(username)')
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (data) setRecentCases(data)
    }
    fetchCases()
  }, [])

  // Search users
  useEffect(() => {
    const searchUsers = async () => {
      setIsSearchingUsers(true)
      try {
        let query = supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .limit(50)

        if (searchQuery.length >= 3) {
          query = query.ilike('username', `%${searchQuery}%`)
        }

        const { data } = await query
        if (data) setUserList(data)
      } catch (err) {
        console.error('Error searching users:', err)
      } finally {
        setIsSearchingUsers(false)
      }
    }
    
    const timer = setTimeout(searchUsers, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadCourtState = useCallback(async () => {
    try {
      const { data: currentSession, error: sessionError } = await supabase.rpc('get_current_court_session')
      if (sessionError) {
        console.warn('Court session RPC error; falling back to direct query', sessionError)
        throw new Error('RPC not available')
      }

      let session = Array.isArray(currentSession) ? currentSession[0] : currentSession

      // If RPC returned nothing, check via direct query just in case (for 'active' status support)
      if (!session || !session.id) {
        const { data: fallbackSession } = await supabase
          .from('court_sessions')
          .select('*')
          .in('status', ['live', 'active', 'waiting'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (fallbackSession) {
          session = fallbackSession
        }
      }

      // Ensure session has a valid ID before setting it
      if (session && session.id) {
        setCourtSession(session)
      } else {
        setCourtSession(null)
      }
    } catch {
      try {
        const { data: session } = await supabase
          .from('court_sessions')
          .select('*')
          .in('status', ['live', 'active', 'waiting'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        setCourtSession(session || null)
      } catch {
        setCourtSession(null)
      }
    } finally {
      if (user?.id) {
        const { data: summons } = await supabase
          .from('court_summons')
          .select('*')
          .eq('summoned_user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        setPendingSummons(summons || [])
      } else {
        setPendingSummons([])
      }
    }
  }, [user?.id])

  // Load current court session (global) on mount
  useEffect(() => {
    loadCourtState()
    const id = window.setInterval(loadCourtState, 5000)
    return () => window.clearInterval(id)
  }, [user?.id, loadCourtState])

  const openCreateModal = () => {
    if (!canStartCourt) return
    setIsCreateModalOpen(true)
    setSearchQuery('')
    setSelectedUser(null)
  }

  const handleSummonOrStart = async () => {
    if (!canStartCourt) return

    setIsStartingSession(true)
    try {
      let activeSessionId = courtSession?.id

      // 1. If no active session, start one
      if (!activeSessionId) {
        const newSessionId = crypto.randomUUID()
        const { data, error: startError } = await startCourtSession({
          sessionId: newSessionId,
          maxBoxes: 2,
          roomName: newSessionId,
          userId: user.id,
          defendantId: selectedUser?.id
        })

        if (startError) throw startError
        activeSessionId = newSessionId
        setCourtSession(data)
      }

      // 2. If a case type and defendant are selected, create the official case
      if (selectedCaseType && selectedUser && activeSessionId) {
        try {
          const { error: caseError } = await supabase.rpc('create_court_case', {
            p_case_type: selectedCaseType,
            p_plaintiff_id: user.id,
            p_defendant_id: selectedUser.id,
            p_court_session_id: activeSessionId
          })
          
          if (caseError) {
            console.error('Error creating case record:', caseError)
            toast.error('Session active, but failed to create case record')
          } else {
            toast.success(courtSession ? 'User Summoned to Current Session' : 'Court Session Started & Case Docketed')
          }
        } catch (e) {
          console.error('Exception creating case:', e)
        }
      }

      setIsCreateModalOpen(false)
      if (!courtSession) {
         navigate(`/court/${activeSessionId}`)
      }
    } catch (startError) {
      console.error('Error starting/summoning:', startError)
      const message =
        startError?.message ||
        (typeof startError === 'string' ? startError : 'Failed to action')
      toast.error(`Error: ${message}`)
    } finally {
      setIsStartingSession(false)
    }
  }

  const handleEndCourtSession = async () => {
    if (!courtSession?.id) {
      toast.error('No active court session ID found')
      return
    }
    
    if (!confirm('Are you sure you want to end this court session?')) return

    try {
      console.log('Ending court session RPC, sessionId=', String(courtSession.id))
      const { error } = await supabase.rpc('end_court_session', { p_session_id: String(courtSession.id) })
      
      if (error) {
        console.error('end_court_session RPC error:', error)
        throw error
      }
      
      setCourtSession(null)
      toast.success('Court session ended')
      loadCourtState() // Force refresh to confirm
    } catch (err: any) {
      console.error('Failed to end court session:', err)
      toast.error(`Failed to end court session: ${err?.message || err}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Scale className="w-12 h-12 text-purple-400" />
            <div>
              <h1 className="text-4xl font-bold">Troll Court</h1>
              <p className="text-gray-400">Justice, drama, and official rulings for Troll City</p>
            </div>
          </div>
        </div>

        {/* Court Status */}
        <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Gavel className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold">Court Status</h2>
            </div>
            <div className="flex items-center gap-2">
              {courtSession ? (
                <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  In Session
                </span>
              ) : (
                <span className="px-3 py-1 bg-gray-600 text-white rounded-full text-sm">
                  Court Adjourned
                </span>
              )}
            </div>
          </div>

          {courtSession ? (
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-green-400">Court is in Session</span>
                </div>
                <p className="text-sm text-gray-300">
                  Session started by authorized personnel. Official rulings and judgments may be issued.
                </p>
                <div className="mt-3 text-xs text-gray-400">
                  Started: {new Date(courtSession.created_at || courtSession.startedAt).toLocaleString()}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/court/${courtSession.id}`)}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Enter Court Room
                </button>
                {canStartCourt && (
                  <>
                    <button
                      onClick={openCreateModal}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Gavel className="w-4 h-4" />
                      Summon User
                    </button>
                    <button
                      onClick={handleEndCourtSession}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
                    >
                      End Court Session
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingSummons.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    <span className="font-semibold text-yellow-300">You have a court summon</span>
                  </div>
                  <div className="text-sm text-gray-300">
                    {pendingSummons[0]?.reason ? pendingSummons[0].reason : 'You have been summoned to Troll Court.'}
                  </div>
                </div>
              )}
              <div className="bg-gray-900/50 border border-gray-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="font-semibold text-gray-400">Court is Adjourned</span>
                </div>
                <p className="text-sm text-gray-300">
                  No active court session. Troll Court is available for viewing official rulings and case history.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  disabled
                  className="w-full py-3 bg-gray-600 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Users className="w-4 h-4" />
                  No Active Session
                </button>
                {canStartCourt ? (
                  <button
                    onClick={openCreateModal}
                    disabled={isStartingSession}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {isStartingSession ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-b-transparent"></div>
                        Starting Session...
                      </>
                    ) : (
                      <>
                        <Gavel className="w-4 h-4" />
                        Start Court Session
                      </>
                    )}
                  </button>
                ) : (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <span className="font-semibold text-red-400">Access Restricted</span>
                    </div>
                    <p className="text-sm text-gray-300">
                      You are not authorized to start a court session. Only Troll Officers and administrators may initiate official court proceedings.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Court Rules */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-purple-400" />
              Court Rules
            </h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>All rulings must be issued by authorized Troll Court officials</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Evidence must be presented before any judgment is made</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>Appeals may be filed within 24 hours of ruling</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <p>All court sessions are recorded for transparency</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Court Officials
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Chief Justice</span>
                <span className="text-xs px-2 py-1 bg-purple-600 rounded-full">Admin</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Senior Judges</span>
                <span className="text-xs px-2 py-1 bg-blue-600 rounded-full">Lead Officers</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Court Officers</span>
                <span className="text-xs px-2 py-1 bg-green-600 rounded-full">Troll Officers</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Court Clerk</span>
                <span className="text-xs px-2 py-1 bg-gray-600 rounded-full">System</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Cases */}
        <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-purple-400" />
            Recent Court Cases
          </h3>

          <div className="space-y-3">
            {recentCases.length > 0 ? (
              recentCases.map((c) => (
                <div key={c.id} className="bg-gray-900/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{c.title || `Case #${c.id.slice(0, 8)}`}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      c.status === 'resolved' ? 'bg-green-600' : 
                      c.status === 'in_session' ? 'bg-purple-600' : 'bg-yellow-600'
                    }`}>
                      {c.status === 'in_session' ? 'In Session' : 
                       c.status === 'resolved' ? 'Resolved' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">{c.description || 'No description provided'}</p>
                  <div className="text-xs text-gray-500 mt-1 flex justify-between">
                    <span>
                      {c.defendant?.username ? `Defendant: ${c.defendant.username}` : ''}
                    </span>
                    <span>
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-4">No recent cases found</div>
            )}
          </div>
        </div>
      </div>

      {/* Create Session Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#171427] border border-purple-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Gavel className="w-5 h-5 text-purple-400" />
                Start Court Session
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Case Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Case Type (Required for Summoning)
                </label>
                <select
                  value={selectedCaseType}
                  onChange={(e) => setSelectedCaseType(e.target.value)}
                  className="w-full bg-[#0E0A1A] border border-purple-500/30 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
                >
                  <option value="">-- Select Case Reason --</option>
                  {CASE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Defendant (Optional)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowDropdown(true)
                      if (selectedUser) setSelectedUser(null)
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder="Search username (min 3 chars)..."
                    className="w-full bg-[#0E0A1A] border border-purple-500/30 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                  {showDropdown && (
                    <UserSearchDropdown
                      query={searchQuery}
                      onSelect={(userId, username) => {
                        setSelectedUser({ id: userId, username })
                        setSearchQuery(username)
                        setShowDropdown(false)
                      }}
                      onClose={() => setShowDropdown(false)}
                      disableNavigation
                    />
                  )}
                </div>
              </div>

              {selectedUser && (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 flex items-center gap-3">
                  <div className="text-sm text-purple-300">Selected Defendant:</div>
                  <div className="font-semibold text-white">{selectedUser.username}</div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSummonOrStart}
                  disabled={isStartingSession}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {isStartingSession ? 'Processing...' : (courtSession ? 'Summon User' : 'Start Session')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
