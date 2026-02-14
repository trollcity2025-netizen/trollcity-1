
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { 
  Shield, 
  Clock, 
  Radio, 
  Gavel, 
  FileText, 
  Gift, 
  Megaphone,
  BarChart,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { trollCityTheme } from '../../styles/trollCityTheme'
import { formatDistanceToNow } from 'date-fns'

export default function TempAdminDashboard() {
  const { profile } = useAuthStore()
  const [_loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [adminTerm, setAdminTerm] = useState<any>(null)
  const [stats, setStats] = useState({
    activeStreams: 0,
    openReports: 0,
    adminCoinsBalance: 0
  })
  const [recentActions, setRecentActions] = useState<any[]>([])

  // Governance Forms
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState('Yes,No')
  const [pollDuration, setPollDuration] = useState(60)
  
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementMsg, setAnnouncementMsg] = useState('')
  
  // Economy Forms
  const [grantTarget, setGrantTarget] = useState('')
  const [grantAmount, setGrantAmount] = useState(100)
  const [waivePaymentId, setWaivePaymentId] = useState('')

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Get Term Info
      const { data: queueData } = await supabase
        .from('admin_for_week_queue')
        .select('*')
        .eq('user_id', profile?.id)
        .eq('status', 'active')
        .single()
      
      setAdminTerm(queueData)

      // 2. Get Stats from Views
      const { data: streamStats } = await supabase
        .from('admin_view_active_streams')
        .select('*')
        .single()
      
      const { count: reportCount } = await supabase
        .from('stream_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      // 3. Get Recent Actions
      const { data: actions } = await supabase
        .from('admin_actions_log')
        .select('*')
        .eq('admin_user_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setStats({
        activeStreams: streamStats?.active_streams_count || 0,
        openReports: reportCount || 0,
        adminCoinsBalance: profile?.temp_admin_coins_balance || 0
      })

      if (actions) setRecentActions(actions)
    } catch (err) {
      console.error('Failed to load admin dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [profile?.id, profile?.temp_admin_coins_balance])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const handleCreatePoll = async () => {
    if (!pollQuestion) return toast.error('Question required')
    
    try {
      const optionsArray = pollOptions.split(',').map(s => s.trim()).filter(s => s)
      const { error } = await supabase.rpc('admin_create_poll', {
        p_question: pollQuestion,
        p_options: optionsArray, // RPC expects jsonb, supabase client handles array->jsonb
        p_duration_minutes: parseInt(pollDuration.toString())
      })
      
      if (error) throw error
      toast.success('City Poll Created!')
      setPollQuestion('')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleTriggerEvent = async (type: string, label: string) => {
    try {
      const { error } = await supabase.rpc('admin_trigger_event', {
        p_event_type: type,
        p_label: label,
        p_duration_minutes: 60 // Default 1 hour
      })
      if (error) throw error
      toast.success(`Event "${label}" Triggered!`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleAnnouncement = async () => {
    if (!announcementTitle || !announcementMsg) return toast.error('Fields required')
    
    try {
      const { error } = await supabase.rpc('admin_create_announcement', {
        p_title: announcementTitle,
        p_message: announcementMsg,
        p_duration_hours: 24
      })
      if (error) throw error
      toast.success('Announcement Posted!')
      setAnnouncementTitle('')
      setAnnouncementMsg('')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleGrantCoins = async () => {
    if (!grantTarget || !grantAmount) return toast.error('Fields required')
    
    try {
      const { error } = await supabase.rpc('admin_grant_temp_coins', {
        p_target_user_id: grantTarget, // Needs UUID. UI should probably be a user search. For now input UUID.
        p_amount: parseInt(grantAmount.toString()),
        p_reason: 'Admin Grant'
      })
      if (error) throw error
      toast.success(`Granted ${grantAmount} Admin Coins`)
      setGrantTarget('')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleWaiveFine = async () => {
    if (!waivePaymentId) return toast.error('Payment ID required')
    
    try {
      const { error } = await supabase.rpc('admin_waive_court_fine', {
        p_payment_id: waivePaymentId,
        p_reason: 'Admin Waive'
      })
      if (error) throw error
      toast.success('Fine Waived')
      setWaivePaymentId('')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Calculate time remaining
  const expiresAt = adminTerm ? new Date(adminTerm.expires_at) : null
  const isExpired = expiresAt && new Date() > expiresAt

  if (isExpired) {
    return (
      <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-6 flex items-center justify-center`}>
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Admin Term Expired</h1>
          <p className="text-gray-400">Your temporary admin session has ended.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-6`}>
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-900/50 to-orange-900/50 border border-red-500/30 rounded-xl p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center border border-red-500/50">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                City Admin <span className="text-sm bg-red-600 px-2 py-0.5 rounded text-white font-bold">TEMPORARY</span>
              </h1>
              <p className="text-red-200/70">Authorized for strict moderation and governance duties.</p>
            </div>
          </div>
          
          <div className="text-right bg-black/30 p-4 rounded-lg border border-red-500/20">
            <div className="text-sm text-gray-400 mb-1 flex items-center justify-end gap-2">
              <Clock className="w-4 h-4" /> Term Expires In
            </div>
            <div className="text-2xl font-mono font-bold text-red-400">
              {expiresAt ? formatDistanceToNow(expiresAt) : 'Loading...'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart },
            { id: 'governance', label: 'City Governance', icon: Megaphone },
            { id: 'economy', label: 'Soft Economy', icon: Gift },
            { id: 'moderation', label: 'Moderation Logs', icon: Gavel },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/50'
                  : 'bg-zinc-900/50 text-gray-400 hover:bg-zinc-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="space-y-6">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-gray-400 text-sm">Active Streams</p>
                      <h3 className="text-3xl font-bold text-white">{stats.activeStreams}</h3>
                    </div>
                    <Radio className="w-8 h-8 text-green-500" />
                  </div>
                  <div className="text-xs text-gray-500">Live on air right now</div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-gray-400 text-sm">Reports Queue</p>
                      <h3 className="text-3xl font-bold text-yellow-500">{stats.openReports}</h3>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-yellow-500" />
                  </div>
                  <div className="text-xs text-gray-500">Pending moderation review</div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-gray-400 text-sm">My Admin Actions</p>
                      <h3 className="text-3xl font-bold text-blue-500">{recentActions.length}</h3>
                    </div>
                    <FileText className="w-8 h-8 text-blue-500" />
                  </div>
                  <div className="text-xs text-gray-500">Recorded in audit log</div>
                </div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  Recent Actions
                </h3>
                <div className="space-y-3">
                  {recentActions.map((action: any) => (
                    <div key={action.id} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${action.action_type.includes('kick') ? 'bg-red-500' : 'bg-blue-500'}`} />
                        <span className="font-mono text-sm text-gray-300">{action.action_type}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(action.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {recentActions.length === 0 && <p className="text-gray-500">No actions recorded yet.</p>}
                </div>
              </div>
            </>
          )}

          {/* GOVERNANCE TAB */}
          {activeTab === 'governance' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Create Poll */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                <h3 className="text-xl font-bold mb-4 text-purple-400 flex items-center gap-2">
                  <BarChart className="w-5 h-5" /> Create City Poll
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Question</label>
                    <input 
                      value={pollQuestion}
                      onChange={e => setPollQuestion(e.target.value)}
                      className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-sm"
                      placeholder="e.g., Should we enable chaos mode?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Options (comma separated)</label>
                    <input 
                      value={pollOptions}
                      onChange={e => setPollOptions(e.target.value)}
                      className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-sm"
                      placeholder="Yes,No"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Duration (minutes)</label>
                    <input 
                      type="number"
                      value={pollDuration}
                      onChange={e => setPollDuration(Number(e.target.value))}
                      className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-sm"
                    />
                  </div>
                  <button 
                    onClick={handleCreatePoll}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg transition-colors"
                  >
                    Launch Poll
                  </button>
                </div>
              </div>

              {/* City Announcement */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                <h3 className="text-xl font-bold mb-4 text-yellow-400 flex items-center gap-2">
                  <Megaphone className="w-5 h-5" /> City Announcement
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Title</label>
                    <input 
                      value={announcementTitle}
                      onChange={e => setAnnouncementTitle(e.target.value)}
                      className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-sm"
                      placeholder="URGENT NEWS"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Message</label>
                    <textarea 
                      value={announcementMsg}
                      onChange={e => setAnnouncementMsg(e.target.value)}
                      className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-sm h-24"
                      placeholder="Citizens of Troll City..."
                    />
                  </div>
                  <button 
                    onClick={handleAnnouncement}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 rounded-lg transition-colors"
                  >
                    Post Announcement (24h)
                  </button>
                </div>
              </div>

              {/* Event Triggers */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl md:col-span-2">
                <h3 className="text-xl font-bold mb-4 text-pink-400">Trigger City Events</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button 
                    onClick={() => handleTriggerEvent('double_xp', 'Double XP Hour')}
                    className="p-4 bg-pink-900/30 border border-pink-500/50 hover:bg-pink-900/50 rounded-xl text-pink-200 font-bold transition-all"
                  >
                    Double XP Hour
                  </button>
                  <button 
                    onClick={() => handleTriggerEvent('purge', 'The Purge (Chaos)')}
                    className="p-4 bg-red-900/30 border border-red-500/50 hover:bg-red-900/50 rounded-xl text-red-200 font-bold transition-all"
                  >
                    The Purge
                  </button>
                  <button 
                    onClick={() => handleTriggerEvent('peace', 'Peaceful Hour')}
                    className="p-4 bg-blue-900/30 border border-blue-500/50 hover:bg-blue-900/50 rounded-xl text-blue-200 font-bold transition-all"
                  >
                    Peaceful Hour
                  </button>
                  <button 
                    onClick={() => handleTriggerEvent('party', 'Block Party')}
                    className="p-4 bg-green-900/30 border border-green-500/50 hover:bg-green-900/50 rounded-xl text-green-200 font-bold transition-all"
                  >
                    Block Party
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ECONOMY TAB */}
          {activeTab === 'economy' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                <h3 className="text-xl font-bold mb-4 text-green-400 flex items-center gap-2">
                  <Gift className="w-5 h-5" /> Grant Admin Coins
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Issue temporary &quot;Admin Coins&quot; to users. These have NO cash value.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Target User ID (UUID)</label>
                    <input 
                      value={grantTarget}
                      onChange={e => setGrantTarget(e.target.value)}
                      className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-sm font-mono"
                      placeholder="00000000-0000-..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Amount</label>
                    <input 
                      type="number"
                      value={grantAmount}
                      onChange={e => setGrantAmount(Number(e.target.value))}
                      className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-sm"
                      max={1000}
                    />
                  </div>
                  <button 
                    onClick={handleGrantCoins}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-colors"
                  >
                    Grant Coins
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                <h3 className="text-xl font-bold mb-4 text-blue-400 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Waive Court Fine
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Forgive a user&apos;s court fine. Requires valid Payment ID.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Payment ID (UUID)</label>
                    <input 
                      value={waivePaymentId}
                      onChange={e => setWaivePaymentId(e.target.value)}
                      className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-sm font-mono"
                      placeholder="00000000-0000-..."
                    />
                  </div>
                  <button 
                    onClick={handleWaiveFine}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors"
                  >
                    Waive Fine
                  </button>
                </div>
              </div>
            </div>
          )}

           {/* MODERATION TAB */}
           {activeTab === 'moderation' && (
            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
               <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Gavel className="w-5 h-5" /> Moderation Log
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  View recent bans, kicks, and mutes. Filter by &quot;active&quot; to see current punishments.
                </p>
                <div className="space-y-2">
                  {recentActions.map((action: any) => (
                    <div key={action.id} className="grid grid-cols-12 gap-4 bg-black/20 p-4 rounded-lg border border-white/5 items-center">
                      <div className="col-span-2 text-xs text-gray-500 font-mono">
                        {new Date(action.created_at).toLocaleDateString()}
                        <br/>
                        {new Date(action.created_at).toLocaleTimeString()}
                      </div>
                      <div className="col-span-3 font-bold text-sm text-white">
                        {action.action_type}
                      </div>
                      <div className="col-span-3 text-sm text-gray-400 truncate">
                        Target: {action.target_user_id || 'System'}
                      </div>
                      <div className="col-span-4 text-sm text-gray-300 italic">
                        &quot;{action.reason || 'No reason'}&quot;
                      </div>
                    </div>
                  ))}
                </div>
            </div>
           )}

        </div>
      </div>
    </div>
  )
}
