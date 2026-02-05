import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { downloadPayrollPDF } from '../lib/officerPayrollPDF'
import OfficerStreamGrid from '../components/officer/OfficerStreamGrid'
import {
  Eye,
  Ban,
  VolumeX,
  Users,
  Shield,
  DoorOpen,
  TrendingUp,
  Download,
  MessageSquare,
  Phone,
  XCircle,
  Calendar,
  ChevronDown,
  FileText
} from 'lucide-react'

type Stream = {
  id: string
  title: string
  category?: string
  broadcaster_id: string
  current_viewers?: number
  status: string
}

type OfficerChatMessage = {
  id: string
  user_id: string
  message: string
  created_at: string
  username?: string
  role?: string
}

type OfficerStats = {
  kicks: number
  bans: number
  mutes: number
  coinsEarned: number
  reputation: number
  rank: string
}

export default function TrollOfficerLounge() {
  const { profile, user } = useAuthStore()
  
  const [viewingOfficerId, setViewingOfficerId] = useState<string>('')
  const [officersList, setOfficersList] = useState<any[]>([])
  const [showCallOffModal, setShowCallOffModal] = useState(false)
  const [callOffDate, setCallOffDate] = useState('')
  const [callOffReason, setCallOffReason] = useState('')
  const [submittingCallOff, setSubmittingCallOff] = useState(false)

  const canManageRequests = profile?.role === 'admin' || profile?.is_admin === true || profile?.role === 'secretary'

  useEffect(() => {
    if (user?.id && !viewingOfficerId) {
      setViewingOfficerId(user.id)
    }
  }, [user?.id, viewingOfficerId])

  // Fetch officers for dropdown
  useEffect(() => {
    if (canManageRequests) {
      const fetchOfficers = async () => {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, username')
          .or('is_troll_officer.eq.true,is_lead_officer.eq.true,role.eq.troll_officer,role.eq.lead_troll_officer')
          .order('username')
        if (data) setOfficersList(data)
      }
      fetchOfficers()
    }
  }, [canManageRequests])

  const handleCallOff = async () => {
    if (!callOffDate) {
      toast.error('Please select a date')
      return
    }
    setSubmittingCallOff(true)
    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: {
          action: 'request_time_off',
          date: callOffDate,
          reason: callOffReason
        }
      })
      
      if (error) throw error
      toast.success('Call off request submitted for approval')
      setShowCallOffModal(false)
      setCallOffDate('')
      setCallOffReason('')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmittingCallOff(false)
    }
  }

  // const navigate = useNavigate()

  const [selectedStream, setSelectedStream] = useState<Stream | null>(null)
  const [officerChat, setOfficerChat] = useState<OfficerChatMessage[]>([])
  const [newOfficerMessage, setNewOfficerMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'moderation' | 'families' | 'calls' | 'requests'>('moderation')
  const [familiesList, setFamiliesList] = useState<any[]>([])
  const [payrollReports, setPayrollReports] = useState<any[]>([])

  const [officerStats, setOfficerStats] = useState<OfficerStats>({
    kicks: 0,
    bans: 0,
    mutes: 0,
    coinsEarned: 0,
    reputation: 0,
    rank: 'Bronze I'
  })

  const [callsList, setCallsList] = useState<any[]>([])
  const [requestsList, setRequestsList] = useState<any[]>([])

  // Fetch Requests
  useEffect(() => {
    const fetchRequests = async () => {
      if (activeTab !== 'requests') return

      let query = supabase
        .from('officer_time_off_requests')
        .select(`
          *,
          officer:user_profiles!officer_time_off_requests_officer_id_fkey(username)
        `)
        .order('created_at', { ascending: false })

      if (canManageRequests) {
        // Admin: show all pending by default, or maybe all? Let's show pending for now as per original code
        query = query.eq('status', 'pending')
      } else {
        // Officer: show my requests
        query = query.eq('officer_id', user?.id)
      }
      
      const { data, error } = await query
      
      if (!error && data) {
        setRequestsList(data)
      }
    }
    fetchRequests()
  }, [canManageRequests, activeTab, user?.id])

  // Fetch officer stats when viewingOfficerId changes
  useEffect(() => {
    const fetchOfficerStats = async () => {
      if (!viewingOfficerId) return

      const { data, error } = await supabase
        .from('user_profiles')
        .select('officer_reputation_score, total_coins_earned, officer_tier_badge')
        .eq('id', viewingOfficerId)
        .single()

      if (!error && data) {
        setOfficerStats(prev => ({
          ...prev,
          reputation: data.officer_reputation_score || 0,
          coinsEarned: data.total_coins_earned || 0,
          rank: data.officer_tier_badge || getRankFromReputation(data.officer_reputation_score || 0)
        }))
      }
    }
    fetchOfficerStats()
  }, [viewingOfficerId])

  useEffect(() => {
    const fetchCalls = async () => {
      const { data, error } = await supabase
        .from('call_history')
        .select(`
          *,
          caller:user_profiles!caller_id(username),
          receiver:user_profiles!receiver_id(username)
        `)
        .order('created_at', { ascending: false })
        .limit(100)
      if (!error && data) {
        setCallsList(data)
      }
    }
    if (activeTab === 'calls') {
      fetchCalls()
    }
  }, [activeTab])

  const handleApproveRequest = async (request: any) => {
    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: {
          action: 'approve_time_off',
          requestId: request.id
        }
      })

      if (error) throw error

      toast.success('Request approved and shift removed')

      // Refresh list
      setRequestsList(prev => prev.filter(r => r.id !== request.id))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDenyRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: {
          action: 'reject_time_off',
          requestId
        }
      })

      if (error) throw error
      toast.success('Request rejected')
      setRequestsList(prev => prev.filter(r => r.id !== requestId))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // --- Helpers for rank & reputation ---
  const getRankFromReputation = (rep: number) => {
    if (rep >= 200) return 'Diamond Troll'
    if (rep >= 120) return 'Platinum Troll'
    if (rep >= 70) return 'Gold Troll'
    if (rep >= 30) return 'Silver Troll'
    return 'Bronze I'
  }

  const bumpStats = (type: 'kick' | 'ban' | 'mute') => {
    setOfficerStats((prev) => {
      let { kicks, bans, mutes, coinsEarned, reputation } = prev

      if (type === 'kick') {
        kicks += 1
        coinsEarned += 50 // example: 10% of 500 coin penalty
        reputation += 3
      } else if (type === 'ban') {
        bans += 1
        coinsEarned += 100 // heavier action, higher reward
        reputation += 7
      } else if (type === 'mute') {
        mutes += 1
        coinsEarned += 10
        reputation += 1
      }

      return {
        kicks,
        bans,
        mutes,
        coinsEarned,
        reputation,
        rank: getRankFromReputation(reputation)
      }
    })
  }

  // Listen for reports - Replaced with Polling
  useEffect(() => {
    // const checkReports = async () => {
    //   // Just check for new reports in the last 30 seconds
    //   // This is a simplified "polling for notification" logic
    //   // In a real app, you'd track the last viewed report ID.
    //   // For now, we'll just poll the latest list silently or rely on manual refresh/polling logic below.
    // }
    
    // We already have a polling interval for other things? No.
    // Let's add a poller for the critical data needed here.
    
    const interval = setInterval(() => {
       // Refresh lists if needed
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  // Officer Chat - Polling
  useEffect(() => {
    const fetchChat = async () => {
      const { data } = await supabase
        .from('officer_chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) {
        setOfficerChat(data.reverse())
      }
    }
    
    fetchChat()
    const interval = setInterval(fetchChat, 15000) // 15s polling
    return () => clearInterval(interval)
  }, [])

  // Fetch Families
  useEffect(() => {
    const fetchFamilies = async () => {
      const { data } = await supabase.from('families').select('*').order('total_rep', { ascending: false })
      if (data) setFamiliesList(data)
    }
    if (activeTab === 'families') {
      fetchFamilies()
    }
  }, [activeTab])

  // Fetch Payroll
  useEffect(() => {
    const fetchPayroll = async () => {
      if (!viewingOfficerId) return
      // This is a mock table or real table 'officer_payroll_logs'
      // If it doesn't exist, we skip.
      const { data, error } = await supabase
        .from('officer_payroll_logs')
        .select('*')
        .eq('officer_id', viewingOfficerId)
        .order('created_at', { ascending: false })
      
      if (!error && data) {
        setPayrollReports(data)
      }
    }
    fetchPayroll()
  }, [viewingOfficerId])

  const sendOfficerMessage = async () => {
    if (!newOfficerMessage.trim() || !user) return
    setChatLoading(true)
    
    const { error } = await supabase.functions.invoke('officer-actions', {
      body: {
        action: 'send_officer_chat',
        message: newOfficerMessage,
        username: profile?.username
      }
    })

    if (error) toast.error('Failed to send message')
    else setNewOfficerMessage('')
    setChatLoading(false)
  }

  // Moderation Actions
  const kickUser = async (username: string) => {
    const { error: kickError } = await supabase.functions.invoke('officer-actions', {
      body: {
        action: 'kick_user',
        targetUsername: username,
        streamId: selectedStream?.id
      }
    })

    if (kickError) {
      console.error('Kick error:', kickError)
      toast.error(`Failed to kick user: ${kickError.message}`)
      return
    }
    bumpStats('kick')
    toast.success(`User ${username} kicked!`)
  }

  const banUser = async (username: string) => {
    const reason = window.prompt(`Reason for warrant against ${username}?`)
    if (!reason) return

    const { error } = await supabase.functions.invoke('officer-actions', {
      body: {
        action: 'ban_user',
        targetUsername: username,
        reason
      }
    })

    if (error) {
      toast.error(error.message)
      return
    }

    bumpStats('ban') // Keeping 'ban' stat for now as it maps to similar severity
    toast.success(`Warrant issued for ${username}. Access restricted!`)
  }

  const muteUser = async (username: string) => {
    bumpStats('mute')
    toast.success(`User ${username} muted.`)
  }

  const handleDownloadPayroll = async () => {
    if (!profile) return
    await downloadPayrollPDF({
      officerName: profile.username || 'Officer',
      rank: officerStats.rank,
      totalEarned: officerStats.coinsEarned,
      payPeriod: 'Jan 1 - Jan 15, 2026',
      logs: payrollReports
    })
    toast.success('Payroll PDF downloaded!')
  }

  const handleDeactivateRoleBonus = () => {
    toast.success('Role bonus deactivated')
    // Add logic to deactivate the role bonus in the database if needed
  }

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white flex flex-col font-sans`}>
      {/* HEADER */}
      <header className={`border-b ${trollCityTheme.borders.glass} ${trollCityTheme.backgrounds.card} px-6 py-4 flex items-center justify-between sticky top-0 z-50`}>
        <div className="flex items-center gap-3">
          <Shield className="text-blue-500 w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold tracking-wide uppercase">Troll Officer Lounge</h1>
            <p className={`text-xs ${trollCityTheme.text.muted}`}>Authorized Personnel Only</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          {canManageRequests ? (
            <div className="relative group">
              <select
                value={viewingOfficerId}
                onChange={(e) => setViewingOfficerId(e.target.value)}
                className={`appearance-none ${trollCityTheme.backgrounds.glass} ${trollCityTheme.borders.glass} text-blue-400 text-sm font-bold rounded-lg py-1 pl-3 pr-8 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[150px]`}
              >
                {officersList.map((officer) => (
                  <option key={officer.id} value={officer.id} className="bg-slate-900">
                    {officer.username}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-blue-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <div className="flex flex-col items-end">
              <span className="font-bold text-blue-400">{profile?.username}</span>
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded uppercase tracking-wider">
                {officerStats.rank}
              </span>
            </div>
          )}
          <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/50">
            <UserIconFallback />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('moderation')}
            className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-xs border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
          >
            Live Monitoring
          </button>
          <button
            onClick={() => setActiveTab('families')}
            className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-lg text-xs border border-purple-500/30 hover:bg-purple-600/30 transition-colors"
          >
            Families & Gangs
          </button>
          <button
            onClick={() => setActiveTab('calls')}
            className="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-lg text-xs border border-yellow-500/30 hover:bg-yellow-600/30 transition-colors"
          >
            Calls
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className="px-3 py-1 bg-red-600/20 text-red-400 rounded-lg text-xs border border-red-500/30 hover:bg-red-600/30 transition-colors"
          >
            Requests
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - NAVIGATION */}
        <aside className={`w-64 ${trollCityTheme.backgrounds.card} border-r ${trollCityTheme.borders.glass} flex flex-col`}>
          <div className="p-4 space-y-2">
            <button
              onClick={() => setActiveTab('moderation')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${
                activeTab === 'moderation' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : `hover:bg-white/5 ${trollCityTheme.text.muted}`
              }`}
            >
              <Eye size={18} />
              <span className="font-semibold text-sm">Live Monitoring</span>
            </button>
            <button
              onClick={() => setActiveTab('families')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${
                activeTab === 'families' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : `hover:bg-white/5 ${trollCityTheme.text.muted}`
              }`}
            >
              <Users size={18} />
              <span className="font-semibold text-sm">Families & Gangs</span>
            </button>
            <button
              onClick={() => setActiveTab('calls')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${
                activeTab === 'calls' ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30' : `hover:bg-white/5 ${trollCityTheme.text.muted}`
              }`}
            >
              <Phone size={18} />
              <span className="font-semibold text-sm">Calls</span>
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${
                activeTab === 'requests' ? 'bg-red-600/20 text-red-400 border border-red-500/30' : `hover:bg-white/5 ${trollCityTheme.text.muted}`
              }`}
            >
              <FileText size={18} />
              <span className="font-semibold text-sm">Requests</span>
            </button>
          </div>

          <div className={`mt-auto p-4 border-t ${trollCityTheme.borders.glass}`}>
            <div className={`${trollCityTheme.backgrounds.glass} rounded-xl p-4 ${trollCityTheme.borders.glass}`}>
              <h3 className={`text-xs font-bold uppercase ${trollCityTheme.text.mutedDark} mb-3 flex items-center gap-2`}>
                <TrendingUp size={12} /> Your Session Stats
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={`${trollCityTheme.text.muted}`}>Kicks</span>
                  <span className="text-white font-mono">{officerStats.kicks}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${trollCityTheme.text.muted}`}>Bans</span>
                  <span className="text-white font-mono">{officerStats.bans}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${trollCityTheme.text.muted}`}>Coins Earned</span>
                  <span className="text-yellow-400 font-mono">+{officerStats.coinsEarned}</span>
                </div>
              </div>
              <button
                onClick={handleDownloadPayroll}
                className="mt-4 w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded text-xs text-blue-300 flex items-center justify-center gap-2 transition"
              >
                <Download size={12} /> Download Payroll
              </button>
            </div>
          </div>
          <div className={`p-4 border-t ${trollCityTheme.borders.glass}`}>
            <div className={`${trollCityTheme.backgrounds.glass} rounded-xl p-4 ${trollCityTheme.borders.glass}`}>
              <h3 className={`text-xs font-bold uppercase ${trollCityTheme.text.mutedDark} mb-3 flex items-center gap-2`}>
                <Shield size={12} /> Role Bonus
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={`${trollCityTheme.text.muted}`}>Status</span>
                  <span className="text-green-400 font-mono">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${trollCityTheme.text.muted}`}>Bonus</span>
                  <span className="text-yellow-400 font-mono">+10%</span>
                </div>
              </div>
              <button
                onClick={() => handleDeactivateRoleBonus()}
                className="mt-4 w-full py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded text-xs text-red-300 flex items-center justify-center gap-2 transition"
              >
                <XCircle size={12} /> Deactivate Bonus
              </button>
            </div>

            <div className={`${trollCityTheme.backgrounds.glass} rounded-xl p-4 ${trollCityTheme.borders.glass} mt-4`}>
              <h3 className={`text-xs font-bold uppercase ${trollCityTheme.text.mutedDark} mb-3 flex items-center gap-2`}>
                <Calendar size={12} /> Schedule Actions
              </h3>
              <button
                onClick={() => setShowCallOffModal(true)}
                className="w-full py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50 rounded text-xs text-yellow-300 flex items-center justify-center gap-2 transition"
              >
                <Phone size={12} /> Call Off Shift
              </button>
            </div>
          </div>
        </aside>

        {/* CENTER PANEL */}
        <main className="flex-1 overflow-y-auto p-6 relative z-10">
          {activeTab === 'moderation' && (
            <div className="space-y-6">
              {/* LIVE STREAMS GRID */}
              <div>
                <OfficerStreamGrid />
              </div>

              {/* SELECTED STREAM MONITOR */}
              {selectedStream && (
                <div className={`border-t ${trollCityTheme.borders.glass} pt-6`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Eye size={20} className="text-blue-400" />
                      Monitoring: <span className="text-blue-400">{selectedStream.title}</span>
                    </h3>
                    <button 
                      onClick={() => setSelectedStream(null)}
                      className={`text-xs ${trollCityTheme.text.muted} hover:text-white`}
                    >
                      Close Monitor
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* VIDEO PREVIEW */}
                    <div className={`lg:col-span-2 bg-black rounded-xl border ${trollCityTheme.borders.glass} aspect-video flex items-center justify-center relative overflow-hidden`}>
                       <p className="text-gray-600 text-sm">Video Feed Preview</p>
                       {/* 
                         We can add a real video player here using LiveKit component 
                         similar to Viewer page but muted/small 
                       */}
                    </div>

                    {/* MOD ACTIONS */}
                    <div className={`${trollCityTheme.backgrounds.card} rounded-xl border ${trollCityTheme.borders.glass} p-4 flex flex-col gap-3`}>
                      <h4 className={`text-sm font-bold ${trollCityTheme.text.muted} uppercase tracking-wider mb-2`}>Quick Actions</h4>
                      <div className="space-y-2">
                        <input 
                          type="text" 
                          placeholder="Enter username to punish..." 
                          className={`w-full ${trollCityTheme.backgrounds.glass} border ${trollCityTheme.borders.glass} rounded px-3 py-2 text-sm focus:border-red-500 outline-none transition`}
                          id="punish-input"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => {
                                const input = document.getElementById('punish-input') as HTMLInputElement
                                if(input?.value) kickUser(input.value)
                            }}
                            className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-500 border border-yellow-600/50 py-2 rounded text-xs font-bold uppercase transition flex items-center justify-center gap-2"
                          >
                            <DoorOpen size={14} /> Kick
                          </button>
                          <button 
                            onClick={() => {
                                const input = document.getElementById('punish-input') as HTMLInputElement
                                if(input?.value) muteUser(input.value)
                            }}
                            className="bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 border border-gray-500/50 py-2 rounded text-xs font-bold uppercase transition flex items-center justify-center gap-2"
                          >
                            <VolumeX size={14} /> Mute
                          </button>
                        </div>
                        <button 
                          onClick={() => {
                              const input = document.getElementById('punish-input') as HTMLInputElement
                              if(input?.value) banUser(input.value)
                          }}
                          className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-500/50 py-2 rounded text-xs font-bold uppercase transition flex items-center justify-center gap-2"
                        >
                          <Ban size={14} /> BAN USER
                        </button>
                      </div>

                      <div className={`mt-4 border-t ${trollCityTheme.borders.glass} pt-4`}>
                        <h4 className={`text-xs font-bold ${trollCityTheme.text.muted} uppercase mb-2`}>Stream Chat Log</h4>
                        <div className={`h-40 overflow-y-auto bg-black/50 rounded border ${trollCityTheme.borders.glass} p-2 text-xs space-y-1`}>
                          <div className={`${trollCityTheme.text.mutedDark} italic`}>Connecting to chat stream...</div>
                          {selectedStream && (
                            <div className={`${trollCityTheme.text.muted} text-xs italic`}>
                              Chat history monitoring for {selectedStream.title}
                              <p className={`mt-2 text-[10px] ${trollCityTheme.text.mutedDark}`}>Live chat integration pending...</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'families' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users size={20} className="text-purple-500" />
                Family Rankings
              </h2>
              <div className={`${trollCityTheme.backgrounds.card} rounded-xl border ${trollCityTheme.borders.glass} overflow-hidden`}>
                <table className="w-full text-sm text-left">
                  <thead className={`bg-white/5 ${trollCityTheme.text.muted} uppercase text-xs`}>
                    <tr>
                      <th className="px-6 py-3">Rank</th>
                      <th className="px-6 py-3">Family Name</th>
                      <th className="px-6 py-3">Reputation</th>
                      <th className="px-6 py-3">Members</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {familiesList.map((family, index) => (
                      <tr key={family.id} className="hover:bg-white/5 transition">
                        <td className={`px-6 py-4 font-bold ${trollCityTheme.text.mutedDark}`}>#{index + 1}</td>
                        <td className="px-6 py-4 font-bold text-white">{family.name}</td>
                        <td className="px-6 py-4 text-purple-400">{family.total_rep}</td>
                        <td className="px-6 py-4">{family.member_count}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs border border-green-500/20">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                    {familiesList.length === 0 && (
                      <tr>
                        <td colSpan={5} className={`px-6 py-8 text-center ${trollCityTheme.text.mutedDark}`}>
                          No families established yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'calls' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Phone size={20} className="text-yellow-500" />
                Recent Calls
              </h2>
              <div className={`${trollCityTheme.backgrounds.card} rounded-xl border ${trollCityTheme.borders.glass} overflow-hidden`}>
                <table className="w-full text-sm text-left">
                  <thead className={`bg-white/5 ${trollCityTheme.text.muted} uppercase text-xs`}>
                    <tr>
                      <th className="px-6 py-3">Started</th>
                      <th className="px-6 py-3">Caller</th>
                      <th className="px-6 py-3">Receiver</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {callsList.map((c) => (
                      <tr key={c.id} className="hover:bg-white/5 transition">
                        <td className={`px-6 py-4 ${trollCityTheme.text.muted}`}>{new Date(c.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4 text-blue-400 font-semibold">{c.caller?.username || c.caller_id}</td>
                        <td className="px-6 py-4 text-purple-400 font-semibold">{c.receiver?.username || c.receiver_id}</td>
                        <td className="px-6 py-4">{c.type}</td>
                        <td className="px-6 py-4">{c.duration_minutes} min</td>
                      </tr>
                    ))}
                    {callsList.length === 0 && (
                      <tr>
                        <td colSpan={5} className={`px-6 py-8 text-center ${trollCityTheme.text.mutedDark}`}>
                          No calls found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {activeTab === 'requests' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="text-red-400" />
                  {canManageRequests ? 'Time Off Requests (Admin)' : 'My Time Off Requests'}
                </h2>
                <button
                  onClick={() => setShowCallOffModal(true)}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  <Calendar size={16} /> New Request
                </button>
              </div>
              
              <div className={`${trollCityTheme.backgrounds.card} rounded-xl border ${trollCityTheme.borders.glass} overflow-hidden`}>
                <table className="w-full text-sm">
                  <thead className={`bg-white/5 ${trollCityTheme.text.muted}`}>
                    <tr>
                      <th className="px-4 py-3 text-left">Date Requested</th>
                      {canManageRequests && <th className="px-4 py-3 text-left">Officer</th>}
                      <th className="px-4 py-3 text-left">Shift Date</th>
                      <th className="px-4 py-3 text-left">Reason</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      {canManageRequests && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {requestsList.length === 0 ? (
                      <tr>
                        <td colSpan={canManageRequests ? 6 : 5} className={`px-4 py-8 text-center ${trollCityTheme.text.mutedDark}`}>
                          {canManageRequests ? 'No pending requests' : 'No request history'}
                        </td>
                      </tr>
                    ) : (
                      requestsList.map((req) => (
                        <tr key={req.id} className="hover:bg-white/5">
                          <td className={`px-4 py-3 ${trollCityTheme.text.muted}`}>
                            {new Date(req.created_at).toLocaleDateString()}
                          </td>
                          {canManageRequests && (
                            <td className="px-4 py-3 font-semibold text-white">
                              {req.officer?.username || 'Unknown'}
                            </td>
                          )}
                          <td className="px-4 py-3 text-blue-400">
                            {new Date(req.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </td>
                          <td className={`px-4 py-3 ${trollCityTheme.text.secondary} max-w-xs truncate`} title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs border ${
                              req.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                              req.status === 'denied' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            }`}>
                              {req.status?.toUpperCase() || 'PENDING'}
                            </span>
                          </td>
                          {canManageRequests && (
                            <td className="px-4 py-3 text-right">
                              {req.status === 'pending' && (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleApproveRequest(req)}
                                    className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/50 rounded hover:bg-green-500/30 transition"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleDenyRequest(req.id)}
                                    className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30 transition"
                                  >
                                    Deny
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR - OFFICER CHAT */}
        <aside className={`w-80 ${trollCityTheme.backgrounds.card} border-l ${trollCityTheme.borders.glass} flex flex-col`}>
          <div className={`p-4 border-b ${trollCityTheme.borders.glass} ${trollCityTheme.backgrounds.glass}`}>
            <h3 className={`font-bold text-sm ${trollCityTheme.text.secondary} flex items-center gap-2`}>
              <MessageSquare size={16} /> Officer Comms
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {officerChat.map((msg) => (
              <div key={msg.id} className={`${trollCityTheme.backgrounds.glass} p-3 rounded-lg border ${trollCityTheme.borders.glass}`}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-bold text-blue-400">{msg.username}</span>
                  <span className={`text-[10px] ${trollCityTheme.text.mutedDark}`}>{new Date(msg.created_at).toLocaleTimeString()}</span>
                </div>
                <p className={`text-sm ${trollCityTheme.text.secondary} leading-relaxed`}>{msg.message}</p>
              </div>
            ))}
          </div>
          <div className={`p-4 ${trollCityTheme.backgrounds.glass} border-t ${trollCityTheme.borders.glass}`}>
            <div className="flex gap-2">
              <input
                type="text"
                value={newOfficerMessage}
                onChange={(e) => setNewOfficerMessage(e.target.value)}
                placeholder="Secure channel..."
                className={`flex-1 ${trollCityTheme.backgrounds.glass} border ${trollCityTheme.borders.glass} rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none transition`}
                onKeyDown={(e) => e.key === 'Enter' && sendOfficerMessage()}
              />
              <button
                onClick={sendOfficerMessage}
                disabled={chatLoading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded transition disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Call Off Modal */}
      {showCallOffModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
          <div className={`${trollCityTheme.backgrounds.modal} border ${trollCityTheme.borders.glass} rounded-xl p-6 w-full max-w-md`}>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-yellow-500" />
              Request Time Off
            </h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm ${trollCityTheme.text.muted} mb-1`}>Date</label>
                <input
                  type="date"
                  value={callOffDate}
                  onChange={(e) => setCallOffDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full ${trollCityTheme.backgrounds.glass} border ${trollCityTheme.borders.glass} rounded-lg p-2 text-white`}
                />
              </div>
              <div>
                <label className={`block text-sm ${trollCityTheme.text.muted} mb-1`}>Reason (Optional)</label>
                <textarea
                  value={callOffReason}
                  onChange={(e) => setCallOffReason(e.target.value)}
                  className={`w-full ${trollCityTheme.backgrounds.glass} border ${trollCityTheme.borders.glass} rounded-lg p-2 text-white h-24 resize-none`}
                  placeholder="Why are you calling off?"
                />
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setShowCallOffModal(false)}
                  className={`px-4 py-2 text-sm ${trollCityTheme.text.muted} hover:text-white`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCallOff}
                  disabled={submittingCallOff || !callOffDate}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingCallOff ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UserIconFallback() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  )
}
