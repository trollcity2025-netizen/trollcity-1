import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { downloadPayrollPDF } from '../lib/officerPayrollPDF'
import ChatWindow from '../components/stream/ChatWindow'
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
  Phone
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
  // const navigate = useNavigate()

  const [selectedStream, setSelectedStream] = useState<Stream | null>(null)
  const [officerChat, setOfficerChat] = useState<OfficerChatMessage[]>([])
  const [newOfficerMessage, setNewOfficerMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'moderation' | 'families' | 'calls'>('moderation')
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

  useEffect(() => {
    const fetchCalls = async () => {
      const { data, error } = await supabase
        .from('call_history')
        .select('*')
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

  // Listen for reports
  useEffect(() => {
    const channel = supabase
      .channel('reports-listener')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
        toast('New Report Alert!', {
          description: `Report filed against user ID: ${payload.new.target_user_id}`
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Officer Chat
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

    const channel = supabase
      .channel('officer-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'officer_chat_messages' }, (payload) => {
        setOfficerChat((prev) => [...prev, payload.new as OfficerChatMessage])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
      if (!user) return
      // This is a mock table or real table 'officer_payroll_logs'
      // If it doesn't exist, we skip.
      const { data, error } = await supabase
        .from('officer_payroll_logs')
        .select('*')
        .eq('officer_id', user.id)
        .order('created_at', { ascending: false })
      
      if (!error && data) {
        setPayrollReports(data)
      }
    }
    fetchPayroll()
  }, [user])

  const sendOfficerMessage = async () => {
    if (!newOfficerMessage.trim() || !user) return
    setChatLoading(true)
    const { error } = await supabase.from('officer_chat_messages').insert({
      user_id: user.id,
      message: newOfficerMessage,
      username: profile?.username || 'Officer',
      role: 'Officer'
    })
    if (error) toast.error('Failed to send message')
    else setNewOfficerMessage('')
    setChatLoading(false)
  }

  // Moderation Actions
  const kickUser = async (username: string) => {
    const { data: targetUser, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', username)
      .single()
    if (userError || !targetUser) {
      toast.error(`User ${username} not found`)
      return
    }
    const { data: _kickResult, error: kickError } = await supabase.rpc('kick_user', {
      p_target_user_id: targetUser.id,
      p_kicker_user_id: profile?.id,
      p_stream_id: selectedStream?.id || null
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
    const { data: targetUser, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', username)
      .single()
    if (userError || !targetUser) {
      toast.error(`User ${username} not found`)
      return
    }
    // Mock ban logic or real insert into bans table
    bumpStats('ban')
    toast.success(`User ${username} BANNED!`)
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

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans">
      {/* HEADER */}
      <header className="border-b border-white/10 bg-[#0a0a0a] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Shield className="text-blue-500 w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold tracking-wide uppercase">Troll Officer Lounge</h1>
            <p className="text-xs text-gray-400">Authorized Personnel Only</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="font-bold text-blue-400">{profile?.username}</span>
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded uppercase tracking-wider">
              {officerStats.rank}
            </span>
          </div>
          <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/50">
            <UserIconFallback />
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - NAVIGATION */}
        <aside className="w-64 bg-[#0a0a0a] border-r border-white/10 flex flex-col">
          <div className="p-4 space-y-2">
            <button
              onClick={() => setActiveTab('moderation')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${
                activeTab === 'moderation' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'hover:bg-white/5 text-gray-400'
              }`}
            >
              <Eye size={18} />
              <span className="font-semibold text-sm">Live Monitoring</span>
            </button>
            <button
              onClick={() => setActiveTab('families')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${
                activeTab === 'families' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'hover:bg-white/5 text-gray-400'
              }`}
            >
              <Users size={18} />
              <span className="font-semibold text-sm">Families & Gangs</span>
            </button>
            <button
              onClick={() => setActiveTab('calls')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${
                activeTab === 'calls' ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30' : 'hover:bg-white/5 text-gray-400'
              }`}
            >
              <Phone size={18} />
              <span className="font-semibold text-sm">Calls</span>
            </button>
          </div>

          <div className="mt-auto p-4 border-t border-white/10">
            <div className="bg-[#0f0f0f] rounded-xl p-4 border border-white/5">
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 flex items-center gap-2">
                <TrendingUp size={12} /> Your Session Stats
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Kicks</span>
                  <span className="text-white font-mono">{officerStats.kicks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Bans</span>
                  <span className="text-white font-mono">{officerStats.bans}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Coins Earned</span>
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
        </aside>

        {/* CENTER PANEL */}
        <main className="flex-1 overflow-y-auto bg-[#050505] p-6">
          {activeTab === 'moderation' && (
            <div className="space-y-6">
              {/* LIVE STREAMS GRID */}
              <div>
                <OfficerStreamGrid />
              </div>

              {/* SELECTED STREAM MONITOR */}
              {selectedStream && (
                <div className="border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Eye size={20} className="text-blue-400" />
                      Monitoring: <span className="text-blue-400">{selectedStream.title}</span>
                    </h3>
                    <button 
                      onClick={() => setSelectedStream(null)}
                      className="text-xs text-gray-500 hover:text-white"
                    >
                      Close Monitor
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* VIDEO PREVIEW */}
                    <div className="lg:col-span-2 bg-black rounded-xl border border-white/10 aspect-video flex items-center justify-center relative overflow-hidden">
                       <p className="text-gray-600 text-sm">Video Feed Preview</p>
                       {/* 
                         We can add a real video player here using LiveKit component 
                         similar to Viewer page but muted/small 
                       */}
                    </div>

                    {/* MOD ACTIONS */}
                    <div className="bg-[#111] rounded-xl border border-white/10 p-4 flex flex-col gap-3">
                      <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</h4>
                      <div className="space-y-2">
                        <input 
                          type="text" 
                          placeholder="Enter username to punish..." 
                          className="w-full bg-black border border-white/10 rounded px-3 py-2 text-sm focus:border-red-500 outline-none transition"
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

                      <div className="mt-4 border-t border-white/10 pt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Stream Chat Log</h4>
                        <div className="h-40 overflow-y-auto bg-black/50 rounded border border-white/5 p-2 text-xs space-y-1">
                          <div className="text-gray-500 italic">Connecting to chat stream...</div>
                          {selectedStream && (
                            <ChatWindow streamId={selectedStream.id} />
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
              <div className="bg-[#111] rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white/5 text-gray-400 uppercase text-xs">
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
                        <td className="px-6 py-4 font-bold text-gray-500">#{index + 1}</td>
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
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
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
              <div className="bg-[#111] rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white/5 text-gray-400 uppercase text-xs">
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
                        <td className="px-6 py-4 text-gray-300">{new Date(c.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4">{c.caller_id}</td>
                        <td className="px-6 py-4">{c.receiver_id}</td>
                        <td className="px-6 py-4">{c.type}</td>
                        <td className="px-6 py-4">{c.duration_minutes} min</td>
                      </tr>
                    ))}
                    {callsList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          No calls found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR - OFFICER CHAT */}
        <aside className="w-80 bg-[#080808] border-l border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10 bg-[#0a0a0a]">
            <h3 className="font-bold text-sm text-gray-300 flex items-center gap-2">
              <MessageSquare size={16} /> Officer Comms
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {officerChat.map((msg) => (
              <div key={msg.id} className="bg-[#111] p-3 rounded-lg border border-white/5">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-bold text-blue-400">{msg.username}</span>
                  <span className="text-[10px] text-gray-600">{new Date(msg.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{msg.message}</p>
              </div>
            ))}
          </div>
          <div className="p-4 bg-[#0a0a0a] border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={newOfficerMessage}
                onChange={(e) => setNewOfficerMessage(e.target.value)}
                placeholder="Secure channel..."
                className="flex-1 bg-[#151515] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none transition"
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
