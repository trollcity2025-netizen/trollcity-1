import React, { useState } from 'react'
import { supabase, UserRole } from '../../../lib/supabase'
import { RoleChangeLog, OfficerBadge } from '../../../types/admin'
import { toast } from 'sonner'
import { Shield, Award, History, Ban, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuthStore } from '../../../lib/store'
import UserNameWithAge from '../../../components/UserNameWithAge'

interface UserProfile {
  id: string
  username: string
  avatar_url: string
  role: UserRole
  is_officer_active: boolean
  is_lead_officer: boolean
  troll_role: string
  glowing_username_color?: string
  rgb_username_expires_at?: string
  is_gold?: boolean
  username_style?: string
  badge?: string
}

export default function OfficerManagementTab() {
  const { user } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [searchResults, setSearchResults] = useState<UserProfile[]>([])
  const [badges, setBadges] = useState<OfficerBadge[]>([])
  const [logs, setLogs] = useState<RoleChangeLog[]>([])
  const [actionReason, setActionReason] = useState('')
  const [loadingLogs, setLoadingLogs] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.length < 3) return

    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { 
          action: "get_users", 
          search: searchQuery,
          limit: 10 
        },
      })

      if (error) throw error
      setSearchResults((data?.data || []) as UserProfile[])
    } catch (error) {
      console.error(error)
      toast.error('Search failed')
    }
  }

  const selectUser = async (profile: UserProfile) => {
    setSelectedUser(profile)
    setSearchResults([])
    setSearchQuery('')
    fetchUserDetails(profile.id)
  }

  const fetchUserDetails = async (userId: string) => {
    setLoadingLogs(true)
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "get_officer_details_admin", userId },
      })

      if (error) throw error
      setBadges(data?.badges || [])
      setLogs(data?.logs || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load details')
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleSetRole = async (newRole: string) => {
    if (!selectedUser || !user || !actionReason) {
      toast.error('Please provide a reason')
      return
    }

    try {
      const { error } = await supabase.functions.invoke("admin-actions", {
        body: {
          action: "update_user_profile",
          userId: selectedUser.id,
          roleUpdate: {
            newRole: newRole,
            reason: actionReason
          }
        }
      })

      if (error) throw error
      toast.success(`Role updated to ${newRole}`)
      
      // Optimistic update
      setSelectedUser({ ...selectedUser, role: newRole as UserRole })
      fetchUserDetails(selectedUser.id)
      setActionReason('')
    } catch (error) {
      console.error(error)
      toast.error('Failed to update role')
    }
  }

  const handleSetStatus = async (status: boolean) => {
    if (!selectedUser || !user || !actionReason) {
      toast.error('Please provide a reason')
      return
    }

    try {
      const { error } = await supabase.functions.invoke("admin-actions", {
        body: {
          action: "set_officer_status",
          targetUserId: selectedUser.id,
          status: status,
          reason: actionReason
        }
      })

      if (error) throw error
      toast.success(`Officer status updated to ${status ? 'Active' : 'Suspended'}`)
      
      // Optimistic update
      setSelectedUser({ ...selectedUser, is_officer_active: status })
      fetchUserDetails(selectedUser.id)
      setActionReason('')
    } catch (error) {
      console.error(error)
      toast.error('Failed to update status')
    }
  }

  const handleToggleLeadOfficer = async () => {
    if (!selectedUser || !user) return

    try {
      const newVal = !selectedUser.is_lead_officer
      const { error } = await supabase.functions.invoke("admin-actions", {
        body: {
          action: "toggle_lead_officer",
          targetUserId: selectedUser.id,
          isLead: newVal
        }
      })

      if (error) throw error
      toast.success(`User ${newVal ? 'promoted to' : 'demoted from'} Lead Officer`)

      // Optimistic update
      setSelectedUser({ ...selectedUser, is_lead_officer: newVal })
      fetchUserDetails(selectedUser.id)
    } catch (error) {
      console.error(error)
      toast.error('Failed to update lead officer status')
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Shield className="w-5 h-5 text-blue-400" />
        Officer Management
      </h2>

      {/* Search */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Search username..."
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="bg-blue-600 px-6 rounded-lg text-white font-bold">Search</button>
        </form>
        
        {searchResults.length > 0 && (
          <div className="mt-2 bg-slate-900 border border-slate-600 rounded-lg overflow-hidden">
            {searchResults.map(result => (
              <div 
                key={result.id}
                className="p-3 hover:bg-slate-800 cursor-pointer flex items-center justify-between border-b border-slate-700 last:border-0"
                onClick={() => selectUser(result)}
              >
                <div className="flex items-center gap-3">
                  <img src={result.avatar_url || 'https://via.placeholder.com/40'} className="w-8 h-8 rounded-full" />
                  <UserNameWithAge user={result} className="text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">{result.role}</span>
                  {result.is_lead_officer && (
                    <span className="text-xs bg-amber-900/40 border border-amber-700 px-2 py-1 rounded text-amber-300">LEAD</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls */}
          <div>
            <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 mb-6">
              <div className="flex items-center gap-4 mb-6">
                <img src={selectedUser.avatar_url || 'https://via.placeholder.com/60'} className="w-16 h-16 rounded-full border-2 border-blue-500" />
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedUser.username}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs border border-blue-500/50">
                      {selectedUser.role}
                    </span>
                    {selectedUser.troll_role && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs border border-purple-500/50">
                        {selectedUser.troll_role}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs border ${
                      selectedUser.is_officer_active 
                        ? 'bg-green-500/20 text-green-300 border-green-500/50' 
                        : 'bg-red-500/20 text-red-300 border-red-500/50'
                    }`}>
                      {selectedUser.is_officer_active ? 'ACTIVE' : 'SUSPENDED'}
                    </span>
                    {selectedUser.is_lead_officer && (
                      <span className="px-2 py-0.5 bg-amber-900/20 text-amber-300 rounded text-xs border border-amber-500/50">
                        LEAD
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Reason for Action (Required)</label>
                  <textarea 
                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white h-20"
                    placeholder="Why are you changing this user's status?"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Role Management</p>
                    <button 
                      onClick={() => handleSetRole('admin')}
                      className="w-full bg-red-900/50 hover:bg-red-900 text-red-200 py-2 rounded text-sm border border-red-800 flex items-center justify-center gap-2"
                    >
                      <ArrowUp className="w-4 h-4" /> Promote to Admin
                    </button>
                    <button 
                      onClick={() => handleSetRole('moderator')}
                      className="w-full bg-blue-900/50 hover:bg-blue-900 text-blue-200 py-2 rounded text-sm border border-blue-800 flex items-center justify-center gap-2"
                    >
                      <Shield className="w-4 h-4" /> Set as Moderator
                    </button>
                    <button 
                      onClick={() => handleSetRole('user')}
                      className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded text-sm flex items-center justify-center gap-2"
                    >
                      <ArrowDown className="w-4 h-4" /> Demote to User
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Status</p>
                    {selectedUser.is_officer_active ? (
                      <button 
                        onClick={() => handleSetStatus(false)}
                        className="w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded text-sm flex items-center justify-center gap-2"
                      >
                        <Ban className="w-4 h-4" /> Suspend Officer
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleSetStatus(true)}
                        className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded text-sm flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Reactivate Officer
                      </button>
                    )}
                    
                    <button 
                      onClick={handleToggleLeadOfficer}
                      className={`w-full py-2 rounded text-sm flex items-center justify-center gap-2 border ${
                        selectedUser.is_lead_officer
                          ? 'bg-amber-900/20 border-amber-500/30 text-amber-400 hover:bg-amber-900/40'
                          : 'bg-amber-600 hover:bg-amber-500 text-white'
                      }`}
                    >
                      <Award className="w-4 h-4" /> 
                      {selectedUser.is_lead_officer ? 'Remove Lead Status' : 'Promote to Lead Officer'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-400" />
                Officer Badges
              </h3>
              <div className="flex flex-wrap gap-2">
                {badges.length === 0 ? (
                  <p className="text-slate-500 text-sm italic">No badges awarded</p>
                ) : (
                  badges.map((badge, idx) => (
                    <div key={idx} className="bg-slate-800 border border-slate-600 px-3 py-1 rounded-full text-sm text-yellow-200 flex items-center gap-2">
                      <Award className="w-3 h-3" /> {badge.badge_type}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* History */}
          <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 max-h-[600px] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              Role History
            </h3>
            <div className="space-y-4">
              {loadingLogs ? (
                <p className="text-slate-500">Loading history...</p>
              ) : logs.length === 0 ? (
                <p className="text-slate-500 italic">No history found</p>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="border-l-2 border-slate-700 pl-4 pb-4">
                    <div className="text-sm text-slate-300 font-medium">
                      Changed from <span className="text-red-400">{log.old_role}</span> to <span className="text-green-400">{log.new_role}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                    <div className="mt-2 bg-slate-800 p-2 rounded text-xs text-slate-300 italic">
                      &quot;{log.reason}&quot;
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      By Admin ID: {log.changed_by.slice(0, 8)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { CheckCircle } from 'lucide-react'
