import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Gavel, Calendar, Users, AlertCircle, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../lib/store'
import UserNameWithAge from '../../components/UserNameWithAge'

export default function CourtDocketsManager() {
  const { user } = useAuthStore()
  const [dockets, setDockets] = useState<any[]>([])
  const [selectedDocket, setSelectedDocket] = useState<any>(null)
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [warrants, setWarrants] = useState<any[]>([])

  // UI States
  const [showCreateDocket, setShowCreateDocket] = useState(false)
  const [showAddCase, setShowAddCase] = useState(false)
  
  // Create Docket Form
  const [newDocketDate, setNewDocketDate] = useState('')

  // Add Case Form
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedDefendant, setSelectedDefendant] = useState<any>(null)
  const [caseReason, setCaseReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadDockets()
    loadActiveWarrants()
  }, [])

  useEffect(() => {
    if (selectedDocket) {
      loadCases(selectedDocket.id)
    }
  }, [selectedDocket])

  // Search users debounce
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        return
      }
      
      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .limit(5)
      
      if (data) setSearchResults(data)
    }

    const timeout = setTimeout(searchUsers, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const loadDockets = async () => {
    const { data } = await supabase
      .from('court_dockets')
      .select('*')
      .order('court_date', { ascending: false })
    if (data) setDockets(data)
  }

  const loadCases = async (docketId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('court_cases')
      .select(`
        *,
        defendant:defendant_id(id, username, avatar_url, created_at),
        plaintiff:plaintiff_id(id, username, created_at)
      `)
      .eq('docket_id', docketId)
      .order('created_at', { ascending: false })
    if (data) setCases(data)
    setLoading(false)
  }

  const loadActiveWarrants = async () => {
    const { data } = await supabase
      .from('court_cases')
      .select(`
        *,
        defendant:defendant_id(id, username, avatar_url, created_at)
      `)
      .eq('warrant_active', true)
      .order('created_at', { ascending: false })
    if (data) setWarrants(data)
  }

  const handleCreateDocket = async () => {
    if (!newDocketDate) return toast.error('Please select a date')
    
    try {
      // Check if exists
      const { data: existing } = await supabase
        .from('court_dockets')
        .select('*')
        .eq('court_date', newDocketDate)
        .single()

      if (existing) {
        setSelectedDocket(existing)
        toast.success('Opened existing docket')
      } else {
        const { data, error } = await supabase
          .from('court_dockets')
          .insert({
            court_date: newDocketDate,
            status: 'open',
            created_by: user?.id
          })
          .select()
          .single()

        if (error) throw error
        setDockets([data, ...dockets])
        setSelectedDocket(data)
        toast.success('New docket created')
      }
      setShowCreateDocket(false)
      setNewDocketDate('')
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleAddCase = async () => {
    if (!selectedDefendant) return toast.error('Please select a user')
    if (!caseReason) return toast.error('Please enter a reason')
    if (!selectedDocket) return

    setIsSubmitting(true)
    try {
      // Use the RPC to create case and notify
      const { error } = await supabase.rpc('manage_court_case_safe', {
        p_defendant_id: selectedDefendant.id,
        p_reason: caseReason,
        p_court_date: selectedDocket.court_date
      })

      if (error) throw error

      toast.success('Case added and summons sent!')
      loadCases(selectedDocket.id)
      setShowAddCase(false)
      setSelectedDefendant(null)
      setCaseReason('')
      setSearchQuery('')
    } catch (error: any) {
      console.error('Error adding case:', error)
      toast.error(error.message || 'Failed to add case')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in relative">
      
      {/* Active Warrants Section */}
      {warrants.length > 0 && (
        <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            Active Warrants
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {warrants.map(w => (
              <div key={w.id} className="bg-black/40 border border-red-500/20 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">
                    <UserNameWithAge 
                      user={{
                        username: w.defendant?.username || 'Unknown',
                        created_at: w.defendant?.created_at,
                        id: w.defendant?.id
                      }}
                    />
                  </div>
                  <div className="text-xs text-red-300 mt-1">{w.reason}</div>
                  <div className="text-xs text-gray-500 mt-2">Issued: {new Date(w.created_at).toLocaleDateString()}</div>
                </div>
                <div className="text-red-500 text-xs font-bold px-2 py-1 bg-red-900/20 rounded border border-red-900/50">
                  WARRANT
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dockets List */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-[600px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              Court Dockets
            </h2>
            <button 
              onClick={() => setShowCreateDocket(true)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition text-purple-400"
              title="New Docket"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-2 overflow-y-auto flex-1">
            {dockets.map(docket => (
              <div 
                key={docket.id}
                onClick={() => setSelectedDocket(docket)}
                className={`p-4 rounded-lg cursor-pointer transition border ${
                  selectedDocket?.id === docket.id 
                    ? 'bg-purple-900/20 border-purple-500/50' 
                    : 'bg-black/20 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white">{new Date(docket.court_date).toLocaleDateString()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    docket.status === 'open' ? 'bg-green-500/20 text-green-400' :
                    docket.status === 'full' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-zinc-500/20 text-gray-400'
                  }`}>
                    {docket.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  Max Cases: {docket.max_cases}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Docket Cases */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-[600px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Gavel className="w-5 h-5 text-purple-400" />
              Docket Cases {selectedDocket && `- ${new Date(selectedDocket.court_date).toLocaleDateString()}`}
            </h2>
            {selectedDocket && (
              <button 
                onClick={() => setShowAddCase(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-bold transition"
              >
                <Plus className="w-4 h-4" />
                Add Case
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!selectedDocket ? (
              <div className="text-gray-500 text-center py-10">Select a docket to view cases</div>
            ) : loading ? (
              <div className="text-gray-500 text-center py-10">Loading cases...</div>
            ) : cases.length === 0 ? (
              <div className="text-gray-500 text-center py-10">No cases in this docket</div>
            ) : (
              <div className="space-y-3">
                {cases.map(c => (
                  <div key={c.id} className="bg-black/20 border border-zinc-800 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden">
                           <img src={c.defendant?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.defendant?.username}`} alt="" />
                        </div>
                        <div>
                          <div className="font-bold text-white">
                            <UserNameWithAge 
                              user={{
                                username: c.defendant?.username,
                                created_at: c.defendant?.created_at,
                                id: c.defendant?.id
                              }}
                            />
                          </div>
                          <div className="text-xs text-gray-400">Summoned by <UserNameWithAge user={{ username: c.plaintiff?.username, created_at: c.plaintiff?.created_at, id: c.plaintiff?.id }} /></div>
                        </div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded font-bold uppercase ${
                        c.status === 'warrant_issued' ? 'bg-red-500/20 text-red-400' :
                        c.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {c.status.replace('_', ' ')}
                      </div>
                    </div>
                    
                    <div className="bg-black/30 p-3 rounded text-sm text-gray-300 mb-2">
                      <span className="text-gray-500 text-xs block mb-1">REASON</span>
                      {c.reason}
                    </div>

                    {c.users_involved && (
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Involved: {c.users_involved}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Docket Modal */}
      {showCreateDocket && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Create New Docket</h3>
              <button onClick={() => setShowCreateDocket(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Court Date</label>
                <input 
                  type="date" 
                  value={newDocketDate}
                  onChange={(e) => setNewDocketDate(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                />
              </div>
              
              <button 
                onClick={handleCreateDocket}
                className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-bold transition"
              >
                Create Docket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Case Modal */}
      {showAddCase && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Summon User to Court</h3>
              <button onClick={() => setShowAddCase(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* User Search */}
              <div className="relative">
                <label className="block text-sm text-gray-400 mb-1">Defendant</label>
                {selectedDefendant ? (
                  <div className="flex items-center justify-between bg-purple-900/20 border border-purple-500/50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={selectedDefendant.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedDefendant.username}`} 
                        alt="" 
                        className="w-8 h-8 rounded-full bg-zinc-800"
                      />
                      <span className="font-bold">{selectedDefendant.username}</span>
                    </div>
                    <button 
                      onClick={() => setSelectedDefendant(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search username..."
                        className="w-full bg-black/50 border border-zinc-800 rounded-lg pl-10 p-3 text-white focus:border-purple-500 outline-none"
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                        {searchResults.map(user => (
                          <button
                            key={user.id}
                            onClick={() => {
                              setSelectedDefendant(user)
                              setSearchQuery('')
                              setSearchResults([])
                            }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800 text-left transition"
                          >
                            <img 
                              src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                              alt="" 
                              className="w-8 h-8 rounded-full bg-zinc-800"
                            />
                            <span>{user.username}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Reason for Summons</label>
                <textarea 
                  value={caseReason}
                  onChange={(e) => setCaseReason(e.target.value)}
                  placeholder="Explain why this user is being summoned..."
                  className="w-full bg-black/50 border border-zinc-800 rounded-lg p-3 text-white focus:border-purple-500 outline-none h-32 resize-none"
                />
              </div>
              
              <button 
                onClick={handleAddCase}
                disabled={isSubmitting}
                className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Summoning...' : 'Summon User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
