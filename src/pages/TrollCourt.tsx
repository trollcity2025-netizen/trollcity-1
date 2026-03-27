import React, { useState, useEffect, useCallback } from 'react'

import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase, UserRole } from '../lib/supabase'
import { startCourtSession } from '../lib/courtSessions'
import { Scale, Gavel, Users, Clock, AlertTriangle, CheckCircle, Search, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { trollCityTheme } from '../styles/trollCityTheme'
import FileLawsuitModal from '../components/FileLawsuitModal'
import JudgeRulingModal from '../components/JudgeRulingModal'
import { toast } from 'sonner'
import UserSearchDropdown from '../components/UserSearchDropdown'
import { generateUUID } from '../lib/uuid'


const CASE_TYPE_MAP: Record<string, string> = {
  'Harassment / Threats': 'harassment_threats',
  'Hate Speech / Discrimination': 'hate_speech_discrimination',
  'Nudity / Sexual Content': 'nudity_sexual_content',
  'Doxxing / Personal Info': 'doxxing_personal_info',
  'Scamming / Fraud': 'scamming_fraud',
  'Chargeback / Payment Abuse': 'chargeback_payment_abuse',
  'Gift Manipulation / Fake gifting': 'gift_manipulation',
  'Ban Evasion': 'ban_evasion',
  'Family War Dispute': 'family_war_dispute',
  'Streamer Misconduct': 'streamer_misconduct',
  'Officer Misconduct': 'officer_misconduct',
  'Appeal Case': 'appeal_case',
  'Copyright / Content Claim': 'copyright_content_claim',
  'TrollCourt Civil Case': 'trollcourt_civil_case',
  'TrollCity Policy Violation': 'trollcity_policy_violation'
};

export default function TrollCourt() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [courtSession, setCourtSession] = useState<any>(null)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [pendingSummons, setPendingSummons] = useState<any[]>([])
  // New state for features
  const [recentCases, setRecentCases] = useState<any[]>([])
  const [myCivilCases, setMyCivilCases] = useState<any[]>([])
  const [assignedCases, setAssignedCases] = useState<any[]>([])
  const [selectedCaseForRuling, setSelectedCaseForRuling] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFileLawsuitModalOpen, setIsFileLawsuitModalOpen] = useState(false)
  const [_userList, setUserList] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [_isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [selectedCaseType, setSelectedCaseType] = useState<string>('')
  const [showDropdown, setShowDropdown] = useState(false)
  
  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null)
  const [docketCases, setDocketCases] = useState<any[]>([])
  const [allDockets, setAllDockets] = useState<any[]>([])
  const [showCaseDetailsModal, setShowCaseDetailsModal] = useState(false)
  const [selectedDateCases, setSelectedDateCases] = useState<any[]>([])

  const CASE_TYPES = [
    'Harassment / Threats',
    'Hate Speech / Discrimination',
    'Nudity / Sexual Content',
    'doxxing / Personal Info',
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

  // Permissions for court operations
  const canSummonUser =
    profile?.is_admin === true ||
    profile?.is_lead_officer === true ||
    profile?.is_secretary === true ||
    profile?.is_troll_officer === true ||
    ['admin', 'lead_troll_officer', 'secretary', 'troll_officer'].includes(String(profile?.role || '')) ||
    ['admin', 'lead_troll_officer', 'secretary', 'troll_officer'].includes(String(profile?.troll_role || ''));

  const canAddCase =
    profile?.is_admin === true ||
    profile?.is_lead_officer === true ||
    profile?.is_secretary === true ||
    ['admin', 'lead_troll_officer', 'secretary'].includes(String(profile?.role || '')) ||
    ['admin', 'lead_troll_officer', 'secretary'].includes(String(profile?.troll_role || ''));

  const canStartCourt =
    profile?.is_admin === true ||
    profile?.is_lead_officer === true ||
    profile?.is_troll_officer === true ||
    ['admin', 'lead_troll_officer', 'troll_officer'].includes(String(profile?.role || '')) ||
    ['admin', 'lead_troll_officer', 'troll_officer'].includes(String(profile?.troll_role || ''));

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

  // Fetch my civil cases
  useEffect(() => {
    if (!user) return
    const fetchMyCivilCases = async () => {
      const { data } = await supabase
        .from('troll_court_cases')
        .select('*, defendant:defendant_id(username), plaintiff:plaintiff_id(username)')
        .or(`plaintiff_id.eq.${user.id},defendant_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
      if (data) setMyCivilCases(data)

      // Fetch assigned cases (if judge)
      if (profile?.role === 'admin' || profile?.role === 'lead_troll_officer') {
        const { data: assigned } = await supabase
            .from('troll_court_cases')
            .select('*, defendant:defendant_id(username), plaintiff:plaintiff_id(username)')
            .eq('assigned_judge_id', user.id)
            .neq('status', 'ruled')
            .neq('status', 'dismissed')
            .order('created_at', { ascending: true })
        if (assigned) setAssignedCases(assigned)
      }
    }
    fetchMyCivilCases()
  }, [user, isFileLawsuitModalOpen, selectedCaseForRuling, profile?.role]) // Reload when modal closes (potentially filed new case)

  // Fetch dockets for calendar
  useEffect(() => {
    const fetchDockets = async () => {
      // Use local year/month to create proper date strings
      // Format as YYYY-MM-DD to avoid timezone conversion issues
      const year = calendarYear
      const month = calendarMonth
      
      // Create date strings in local timezone
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
      // Last day of month - get from Date object
      const lastDay = new Date(year, month + 1, 0).getDate()
      const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      
      const { data } = await supabase
        .from('court_dockets')
        .select('*, court_cases(*, defendant:defendant_id(username), plaintiff:plaintiff_id(username))')
        .gte('court_date', startStr)
        .lte('court_date', endStr)
        .order('court_date', { ascending: true })
      
      if (data) setAllDockets(data)
    }
    fetchDockets()
  }, [calendarMonth, calendarYear])

  // Fetch cases for selected date
  useEffect(() => {
    const fetchSelectedDateCases = async () => {
      if (!selectedCalendarDate) return
      
      // Query dockets for the selected date, then get their cases
      const { data: docketData } = await supabase
        .from('court_dockets')
        .select('*, court_cases(*, defendant:defendant_id(username), plaintiff:plaintiff_id(username))')
        .eq('court_date', selectedCalendarDate)
      
      if (docketData) {
        const cases = docketData.flatMap(d => d.court_cases || []);
        setSelectedDateCases(cases);
      }
    }
    fetchSelectedDateCases()
  }, [selectedCalendarDate])

  useEffect(() => { 
   // ✅ Do NOT search if query too short 
   if (!searchQuery || searchQuery.trim().length < 3) { 
     setUserList([]) 
     return 
   } 
 
   let cancelled = false 
 
   const searchUsers = async () => { 
     setIsSearchingUsers(true) 
 
     try { 
       const { data } = await supabase 
         .from('user_profiles') 
         .select('id, username, avatar_url') 
         .ilike('username', `%${searchQuery.trim()}%`) 
         .limit(20) 
 
       if (!cancelled && data) { 
         setUserList(data) 
       } 
     } catch (err) { 
       console.error('User search error:', err) 
     } finally { 
       if (!cancelled) setIsSearchingUsers(false) 
     } 
   } 
 
   const timer = setTimeout(searchUsers, 400) 
 
   return () => { 
     cancelled = true 
     clearTimeout(timer) 
   } 
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
        // Fetch pending summons from court_summons with court date
        const { data: summons } = await supabase
          .from('court_summons')
          .select(`
            *,
            court_cases!inner(
              docket_id,
              court_dockets!inner(court_date)
            )
          `)
          .eq('summoned_user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        // Also fetch pending cases where user is defendant
        const { data: cases } = await supabase
          .from('court_cases')
          .select(`
            *,
            court_dockets!inner(court_date)
          `)
          .eq('defendant_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        // Transform court_summons data to extract court_date
        const transformedSummons = (summons || []).map((s: any) => ({
          ...s,
          reason: s.reason,
          court_date: s.court_cases?.court_dockets?.court_date || s.scheduled_for || null,
          source: 'summons'
        }))

        // Transform court_cases data
        const transformedCases = (cases || []).map((c: any) => ({
          id: c.id,
          reason: c.reason,
          court_date: c.court_dockets?.court_date || null,
          source: 'case'
        }))

        // Combine both sources
        const allPending = [...transformedSummons, ...transformedCases]
        setPendingSummons(allPending)
      } else {
        setPendingSummons([])
      }
    }
  }, [user?.id, setCourtSession, setPendingSummons])

  // Load current court session (global) on mount and subscribe to realtime updates
  useEffect(() => {
    loadCourtState()

    const channel = supabase
      .channel('court-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'court_sessions' },
        () => loadCourtState()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'court_summons' },
        () => loadCourtState()
      )
      .subscribe()

    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      channel.send({
        type: 'broadcast',
        event: 'ping',
        payload: { timestamp: Date.now(), page: 'troll-court' }
      }).catch(() => {});
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const openCreateModal = () => {
    if (!canSummonUser) return
    setIsCreateModalOpen(true)
    setSearchQuery('')
    setSelectedUser(null)
  }

  const handleSummonOrStart = async () => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return;
    }

    setIsStartingSession(true)
    try {
      let activeSessionId = courtSession?.id
      const dbCaseType = CASE_TYPE_MAP[selectedCaseType] || 'trollcity_policy_violation';

      // 1. If no active session, start one
      if (!activeSessionId) {
        const newSessionId = generateUUID()
        const { data, error: startError } = await startCourtSession({
          sessionId: newSessionId,
          maxBoxes: 2,
          roomName: newSessionId,
          userId: user.id,
          defendantId: selectedUser?.id
        })

        if (startError) throw startError
        const resolvedSessionId = data?.id || newSessionId
        activeSessionId = resolvedSessionId
        setCourtSession(data || {
          id: activeSessionId,
          created_at: new Date().toISOString()
        });
      }

      // 2. If a case type and defendant are selected, create the official case
      if (selectedUser && activeSessionId && dbCaseType) {
        try {
          console.log("Creating case:", {
            uiType: selectedCaseType,
            dbType: dbCaseType
          });

          const { error: caseError } = await supabase.rpc('create_court_case', {
            p_case_type: dbCaseType,
            p_plaintiff_id: user.id,
            p_defendant_id: selectedUser.id,
            p_court_session_id: activeSessionId
          })
          
          if (caseError) {
            console.error('Error creating case record:', caseError)
            toast.error(`Failed to create case: ${caseError.message}`)
          } else {
            // After creating the case, fetch it to get the ID and update the session
            const { data: newCase } = await supabase
              .from('court_cases')
              .select('id')
              .eq('court_session_id', activeSessionId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (newCase?.id) {
              await supabase
                .from('court_sessions')
                .update({ case_id: newCase.id })
                .eq('id', activeSessionId);
            }

            toast.success(courtSession ? 'User Summoned to Current Session' : 'Court Session Started & Case Docketed')
          }
        } catch (e) {
          console.error('Exception creating case:', e)
        }
      }

      setIsCreateModalOpen(false)
      if (activeSessionId) {
         navigate(`/court/${activeSessionId}`)
      }
    } catch (startError) {
      console.error('Error starting/summoning:', startError)
      const message =
        (startError as any)?.message ||
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

  const handleDeleteCase = async (id: string) => {
    if (!confirm('Are you sure you want to delete this case docket?')) return;
    const { error } = await supabase.from('court_cases').delete().eq('id', id);
    if (error) toast.error('Failed to delete case');
    else {
      toast.success('Case docket deleted');
      setRecentCases(prev => prev.filter(c => c.id !== id));
    }
  }

  const handleExtendCase = async (id: string) => {
      const daysStr = prompt('Enter number of days to extend:', '7');
      if (!daysStr) return;
      const days = parseInt(daysStr);
      if (isNaN(days)) return toast.error('Invalid number');

      const date = new Date();
      date.setDate(date.getDate() + days);
      
      const { error } = await supabase
          .from('court_cases')
          .update({ scheduled_for: date.toISOString() })
          .eq('id', id);

      if (error) toast.error('Failed to extend case (Field scheduled_for may not exist)');
      else toast.success('Case extended');
  }

  const handleEditCase = async (c: any) => {
      const newTitle = prompt('Edit Case Title:', c.title || '');
      const newDesc = prompt('Edit Description:', c.description || '');
      
      if (newTitle === null && newDesc === null) return;

      const updates: any = {};
      if (newTitle !== null) updates.title = newTitle;
      if (newDesc !== null) updates.description = newDesc;

      const { error } = await supabase.from('court_cases').update(updates).eq('id', c.id);
      
      if (error) toast.error('Failed to update case');
      else {
          toast.success('Case updated');
          setRecentCases(prev => prev.map(item => item.id === c.id ? { ...item, ...updates } : item));
      }
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6`}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Scale className="w-12 h-12 text-purple-400" />
            <div>
              <h1 className="text-4xl font-bold">Troll Court</h1>
              <p className={trollCityTheme.text.muted}>Justice, drama, and official rulings for Troll City</p>
            </div>
          </div>
        </div>

        {/* Court Status */}
        <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl p-6`}>
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
                <span className="px-3 py-1 bg-gray-600 text-white rounded-full text-sm flex items-center gap-2">
                  <Scale className="w-4 h-4 text-purple-400" />
                  OPEN FOR FILING
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
                <p className={`text-sm ${trollCityTheme.text.muted}`}>
                  Session started by authorized personnel. Official rulings and judgments may be issued.
                </p>
                <div className={`mt-3 text-xs ${trollCityTheme.text.muted}`}>
                  Started: {new Date(courtSession.created_at || courtSession.startedAt).toLocaleString()}
                </div>
              </div>

              <button
                onClick={() => setIsFileLawsuitModalOpen(true)}
                className="w-full bg-red-900/20 hover:bg-red-900/40 border border-red-500/50 text-red-200 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Gavel className="w-5 h-5" />
                Take User To Court (File Lawsuit)
              </button>

              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/court/${courtSession.id}`)}
                  className={`w-full py-3 ${trollCityTheme.gradients.button} text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2`}
                >
                  <Users className="w-4 h-4" />
                  Enter Court Room
                </button>
                {canSummonUser && (
                  <>
                    <button
                      onClick={openCreateModal}
                      className="w-full py-3 bg-cyan-600/40 hover:bg-cyan-600/60 border border-cyan-500/50 text-cyan-100 rounded-lg font-semibold transition-all hover:shadow-[0_0_20px_rgba(8,145,178,0.4)] flex items-center justify-center gap-2"
                    >
                      <Gavel className="w-4 h-4" />
                      Summon User
                    </button>
                    <button
                      onClick={handleEndCourtSession}
                      className="w-full py-3 bg-red-600/40 hover:bg-red-600/60 border border-red-500/50 text-red-100 rounded-lg font-semibold transition-all hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]"
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
                  <div className={`text-sm ${trollCityTheme.text.muted}`}>
                    {pendingSummons[0]?.reason ? pendingSummons[0].reason : 'You have been summoned to Troll Court.'}
                  </div>
                  {pendingSummons[0]?.court_date && (
                    <div className="mt-2 text-sm font-semibold text-yellow-400 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Court Date: {new Date(pendingSummons[0].court_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
              <div className="bg-gray-900/50 border border-gray-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="font-semibold text-gray-400">Court is Adjourned</span>
                </div>
                <p className={`text-sm ${trollCityTheme.text.muted}`}>
                  No active court session. Troll Court is available for viewing official rulings and case history.
                </p>
                
                <button
                  onClick={() => setIsFileLawsuitModalOpen(true)}
                  className="mt-4 w-full bg-red-900/20 hover:bg-red-900/40 border border-red-500/50 text-red-200 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Gavel className="w-5 h-5" />
                  Take User To Court (File Lawsuit)
                </button>
              </div>

              <div className="space-y-3">
                <button
                  disabled
                  className="w-full py-3 bg-gray-600 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Users className="w-4 h-4" />
                  No Active Session
                </button>
                {canSummonUser ? (
                  <button
                    onClick={openCreateModal}
                    disabled={isStartingSession}
                    className={`w-full py-3 ${trollCityTheme.gradients.button} text-white disabled:opacity-50 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2`}
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
                    <p className={`text-sm ${trollCityTheme.text.muted}`}>
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
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl p-6`}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-purple-400" />
              Court Rules
            </h3>
            <div className={`space-y-3 text-sm ${trollCityTheme.text.muted}`}>
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

          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl p-6`}>
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

        {/* Assigned Cases (Judge View) */}
        {assignedCases.length > 0 && (
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl p-6 shadow-lg shadow-purple-900/10`}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Gavel className="w-5 h-5 text-purple-400" />
              Court Docket (Assigned to You)
            </h3>
            <div className="space-y-3">
              {assignedCases.map((c) => (
                <div key={c.id} className="bg-purple-900/20 rounded-lg p-4 border border-purple-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-purple-200">
                      Case #{c.case_number}: {c.category}
                    </span>
                    <span className="text-xs px-2 py-1 bg-purple-600 rounded-full text-white">
                      ACTION REQUIRED
                    </span>
                  </div>
                  <div className={`flex justify-between text-sm ${trollCityTheme.text.muted} mb-2`}>
                    <span>Plaintiff: {c.plaintiff?.username}</span>
                    <span>Defendant: {c.defendant?.username}</span>
                  </div>
                  <div className={`text-sm ${trollCityTheme.text.muted} italic`}>&quot;{c.description}&quot;</div>
                  
                  <div className="mt-3 flex gap-2">
                      <button 
                        onClick={() => setSelectedCaseForRuling(c)}
                        className="text-xs bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-white font-semibold"
                      >
                          Open Case File
                      </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Civil Cases */}
        {myCivilCases.length > 0 && (
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl p-6`}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-red-400" />
              My Civil Lawsuits
            </h3>

            <div className="space-y-3">
              {myCivilCases.map((c) => (
                <div key={c.id} className={`${trollCityTheme.backgrounds.card} rounded-lg p-4 border ${trollCityTheme.borders.glass}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-red-200">
                      {c.category} 
                      <span className="text-gray-500 text-xs ml-2">#{c.case_number}</span>
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      c.status === 'ruled' ? 'bg-green-600' : 
                      c.status === 'dismissed' ? 'bg-gray-600' : 'bg-yellow-600'
                    }`}>
                      {c.status.toUpperCase()}
                    </span>
                  </div>
                  <div className={`flex justify-between text-sm ${trollCityTheme.text.muted}`}>
                    <span>vs {c.defendant_id === user?.id ? c.plaintiff?.username : c.defendant?.username}</span>
                    <span>Claim: {c.claim_amount} coins</span>
                  </div>
                  {c.ruling_verdict && (
                    <div className="mt-2 text-xs bg-black/20 p-2 rounded text-gray-300">
                        Verdict: <span className="font-bold text-white">{c.ruling_verdict}</span>
                        {c.judgment_amount > 0 && ` - Award: ${c.judgment_amount}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Court Calendar */}
        <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-400" />
            Court Docket Calendar
          </h3>
          
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => {
                if (calendarMonth === 0) {
                  setCalendarMonth(11)
                  setCalendarYear(calendarYear - 1)
                } else {
                  setCalendarMonth(calendarMonth - 1)
                }
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-lg">
              {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button 
              onClick={() => {
                if (calendarMonth === 11) {
                  setCalendarMonth(0)
                  setCalendarYear(calendarYear + 1)
                } else {
                  setCalendarMonth(calendarMonth + 1)
                }
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day names */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-gray-400 py-2">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {(() => {
              const firstDay = new Date(calendarYear, calendarMonth, 1).getDay()
              const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
              const days = []
              
              // Get dates with cases
              const datesWithCases = allDockets
                .filter(d => d.court_cases && d.court_cases.length > 0)
                .map(d => {
                  // Extract the date string from the docket - should be in YYYY-MM-DD format
                  const dateStr = d.court_date
                  if (typeof dateStr === 'string' && dateStr.includes('-')) {
                    return dateStr // Already in YYYY-MM-DD format
                  }
                  // Fallback: convert from Date object
                  return new Date(d.court_date).toISOString().split('T')[0]
                })
              
              // Empty cells before first day
              for (let i = 0; i < firstDay; i++) {
                days.push(<div key={`empty-${i}`} className="p-2"></div>)
              }
              
              // Days of month
              for (let day = 1; day <= daysInMonth; day++) {
                // Create date string in YYYY-MM-DD format for comparison
                const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const hasCases = datesWithCases.includes(dateStr)
                const isToday = new Date().getDate() === day && 
                  new Date().getMonth() === calendarMonth && 
                  new Date().getFullYear() === calendarYear
                const isSelected = selectedCalendarDate === dateStr
                
                days.push(
                  <button
                    key={day}
                    onClick={() => {
                      // Create date in local timezone to avoid offset issues
                      const year = calendarYear
                      const month = String(calendarMonth + 1).padStart(2, '0')
                      const dayStr = String(day).padStart(2, '0')
                      const dateStr = `${year}-${month}-${dayStr}`
                      setSelectedCalendarDate(dateStr)
                      setShowCaseDetailsModal(true)
                    }}
                    className={`p-2 text-sm rounded-lg transition-all relative ${
                      hasCases 
                        ? 'bg-orange-900/40 hover:bg-orange-800/60 border border-orange-500/30 text-orange-200' 
                        : 'hover:bg-white/10 text-gray-300'
                    } ${isToday ? 'ring-2 ring-yellow-400' : ''} ${isSelected ? 'ring-2 ring-white' : ''}`}
                  >
                    {day}
                    {hasCases && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
                    )}
                  </button>
                )
              }
              return days
            })()}
          </div>
          
          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 bg-orange-500 rounded"></span>
              <span>Dates with cases</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 ring-2 ring-yellow-400 rounded"></span>
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* Recent Cases */}
        <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-purple-400" />
            Recent Court Cases
          </h3>

          <div className="space-y-3">
            {recentCases.length > 0 ? (
              recentCases.map((c) => (
                <div key={c.id} className={`${trollCityTheme.backgrounds.card} rounded-lg p-4 relative group`}>
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
                  <p className={`text-sm ${trollCityTheme.text.muted}`}>{c.description || 'No description provided'}</p>
                  <div className="text-xs text-gray-500 mt-1 flex justify-between items-center">
                    <span>
                      {c.defendant?.username ? `Defendant: ${c.defendant.username}` : ''}
                    </span>
                    <div className="flex items-center gap-2">
                        {c.scheduled_for && (
                            <span className="text-yellow-500">
                                Scheduled: {new Date(c.scheduled_for).toLocaleDateString()}
                            </span>
                        )}
                        <span>
                        {new Date(c.created_at).toLocaleDateString()}
                        </span>
                    </div>
                  </div>

                  {/* Admin Controls */}
                  {canAddCase && (
                      <div className="mt-3 pt-3 border-t border-gray-700 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditCase(c)}
                            className="text-xs bg-blue-900/40 hover:bg-blue-800 border border-blue-500/30 px-2 py-1 rounded text-blue-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleExtendCase(c.id)}
                            className="text-xs bg-yellow-900/40 hover:bg-yellow-800 border border-yellow-500/30 px-2 py-1 rounded text-yellow-200"
                          >
                            Extend Date
                          </button>
                          <button
                            onClick={() => handleDeleteCase(c.id)}
                            className="text-xs bg-red-900/40 hover:bg-red-800 border border-red-500/30 px-2 py-1 rounded text-red-200"
                          >
                            Delete
                          </button>
                      </div>
                  )}
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
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl p-6 max-w-md w-full shadow-2xl`}>
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
                <label className={`block text-sm font-medium ${trollCityTheme.text.muted} mb-2`}>
                  Case Type (Required for Summoning)
                </label>
                <select
                  value={selectedCaseType}
                  onChange={(e) => setSelectedCaseType(e.target.value)}
                  className={`w-full ${trollCityTheme.backgrounds.input} border ${trollCityTheme.borders.glass} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 appearance-none cursor-pointer`}
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
                <label className={`block text-sm font-medium ${trollCityTheme.text.muted} mb-2`}>
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
                    className={`w-full ${trollCityTheme.backgrounds.input} border ${trollCityTheme.borders.glass} rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-purple-500`}
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
                  className={`flex-1 py-2.5 ${trollCityTheme.gradients.button} text-white disabled:opacity-50 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2`}
                >
                  {isStartingSession ? 'Processing...' : (courtSession ? 'Summon User' : 'Start Session')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FileLawsuitModal
        isOpen={isFileLawsuitModalOpen}
        onClose={() => setIsFileLawsuitModalOpen(false)}
        onSuccess={() => {
            // Refresh cases if needed
         }}
       />

       <JudgeRulingModal
         isOpen={!!selectedCaseForRuling}
         caseData={selectedCaseForRuling}
         onClose={() => setSelectedCaseForRuling(null)}
         onSuccess={() => {
            setSelectedCaseForRuling(null)
            // Ideally trigger refresh here, but for now user can refresh page or wait for next interval if any
            // We should add a refresh trigger to dependency array of useEffect if we want auto-refresh
         }}
       />

       {/* Case Details Modal */}
       {showCaseDetailsModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <div className="bg-zinc-900 border border-orange-500/50 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
             {/* Header */}
             <div className="bg-gradient-to-r from-orange-950 to-zinc-900 p-4 border-b border-orange-900/30 flex items-center justify-between">
               <div className="flex items-center gap-2 text-orange-400 font-bold text-lg">
                 <Calendar className="w-5 h-5" />
                 Cases for {selectedCalendarDate ? (() => {
                  const [y, m, d] = selectedCalendarDate.split('-').map(Number);
                  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                })() : 'Selected Date'}
               </div>
               <button 
                 onClick={() => setShowCaseDetailsModal(false)} 
                 className="text-gray-400 hover:text-white transition p-1"
               >
                 <X className="w-5 h-5" />
               </button>
             </div>
             
             {/* Content */}
             <div className="p-4 overflow-y-auto max-h-[60vh]">
               {selectedDateCases.length > 0 ? (
                 <div className="space-y-4">
                   {selectedDateCases.map((c) => (
                     <div key={c.id} className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
                       <div className="flex items-center justify-between mb-2">
                         <span className="font-semibold text-orange-200">
                           Case #{c.id.slice(0, 8)}
                         </span>
                         <span className={`text-xs px-2 py-1 rounded-full ${
                           c.status === 'resolved' ? 'bg-green-600' : 
                           c.status === 'in_session' ? 'bg-purple-600' : 'bg-yellow-600'
                         }`}>
                           {c.status === 'in_session' ? 'In Session' : 
                            c.status === 'resolved' ? 'Resolved' : 'Pending'}
                         </span>
                       </div>
                       
                       <div className="space-y-2 text-sm">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Plaintiff:</span>
                           <span className="text-white">{c.plaintiff?.username || 'Unknown'}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Defendant:</span>
                           <span className="text-white">{c.defendant?.username || 'Unknown'}</span>
                         </div>
                         {c.reason && (
                           <div className="mt-2 pt-2 border-t border-gray-700">
                             <span className="text-gray-400">Case Details:</span>
                             <p className="text-white mt-1">{c.reason}</p>
                           </div>
                         )}
                         {c.category && (
                           <div className="flex justify-between">
                             <span className="text-gray-400">Category:</span>
                             <span className="text-orange-200">{c.category}</span>
                           </div>
                         )}
                       </div>
                       
                       {canStartCourt && (
                         <div className="mt-3 pt-3 border-t border-gray-700">
                           <button 
                             onClick={() => {
                               setSelectedCaseForRuling(c)
                               setShowCaseDetailsModal(false)
                             }}
                             className="text-xs bg-orange-900/40 hover:bg-orange-800 border border-orange-500/30 px-3 py-1 rounded text-orange-200"
                           >
                             View Full Case Details
                           </button>
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center py-8 text-gray-400">
                   <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                   <p>No cases found for this date.</p>
                   <p className="text-sm mt-1">Try clicking on a date marked with orange dots.</p>
                 </div>
               )}
             </div>
           </div>
         </div>
       )}
     </div>
   )
 }
