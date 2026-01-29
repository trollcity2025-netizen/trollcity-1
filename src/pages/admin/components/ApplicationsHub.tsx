import React, { useState, useEffect } from 'react'
import {
  FileText,
  Users,
  Shield,
  CheckCircle,
  XCircle,
  Star,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'

interface ApplicationsHubProps {
  onLoadApplications?: () => void
  applicationsLoading?: boolean
  onApproveApplication?: (appId: string, userId: string, newRole: string) => void
  onRejectApplication?: (id: string) => void
}

export default function ApplicationsHub({
  onLoadApplications,
  applicationsLoading = false,
  onApproveApplication,
  onRejectApplication
}: ApplicationsHubProps) {
  const [activeTab, setActiveTab] = useState<string>('officer')
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles!user_id (
            username,
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications(data || [])
    } catch (error) {
      console.error('Error fetching applications:', error)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  const handleRefresh = () => {
    fetchApplications()
    if (onLoadApplications) onLoadApplications()
  }

  const officerApps = applications.filter(app => app.type.includes('officer') && app.status === 'pending')
  const creatorApps = applications.filter(app => (app.type === 'creator' || app.type === 'seller') && app.status === 'pending')
  const approvedApps = applications.filter(app => app.status === 'approved').slice(0, 10)

  const tabs = [
    {
      id: 'officer',
      label: 'Officer Applications',
      icon: <Shield className="w-4 h-4" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30',
      count: officerApps.length
    },
    {
      id: 'creator',
      label: 'Creator/Seller Apps',
      icon: <Star className="w-4 h-4" />,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30',
      count: creatorApps.length
    },
    {
      id: 'approved',
      label: 'Recently Approved',
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
      count: approvedApps.length
    }
  ]

  const getApplicationsForTab = (tabId: string) => {
    switch (tabId) {
      case 'officer': return officerApps
      case 'creator': return creatorApps
      case 'approved': return approvedApps
      default: return []
    }
  }

  const renderApplicationCard = (app: any) => (
    <div key={app.id} className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#2C2C2C] rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h4 className="font-medium text-white">{app.user_profiles?.username || 'Unknown'}</h4>
            <p className="text-xs text-gray-400 capitalize">{app.type.replace('_', ' ')} Application</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          app.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
          app.status === 'approved' ? 'bg-green-500/20 text-green-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {app.status}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {/* Render dynamic fields from JSONB or columns if they exist, for now basic info */}
        <div className="text-sm">
          <span className="text-gray-400">Applied:</span>
          <span className="text-white ml-2">{new Date(app.created_at).toLocaleDateString()}</span>
        </div>
        {app.store_name && (
           <div className="text-sm">
           <span className="text-gray-400">Store Name:</span>
           <span className="text-white ml-2">{app.store_name}</span>
         </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>ID: {app.id.slice(0, 8)}</span>
        {app.reviewed_at && (
          <span>Reviewed {new Date(app.reviewed_at).toLocaleDateString()}</span>
        )}
      </div>

      {app.status === 'pending' && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onApproveApplication?.(app.id, app.user_id, app.type)}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Approve
          </button>
          <button
            onClick={() => onRejectApplication?.(app.id)}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        </div>
      )}
    </div>
  )

  const currentApplications = getApplicationsForTab(activeTab)

  return (
    <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/20 border border-orange-500/30 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Applications Hub</h3>
            <p className="text-sm text-gray-400">Manage all application types</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || applicationsLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${(loading || applicationsLoading) ? 'animate-spin' : ''}`} />
          <span className="text-sm">Refresh</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 p-1 bg-[#0A0814] rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md transition-all duration-200 ${
              activeTab === tab.id
                ? `${tab.bgColor} border ${tab.borderColor} text-white`
                : 'text-gray-400 hover:text-white hover:bg-[#2C2C2C]'
            }`}
          >
            <div className={activeTab === tab.id ? tab.color : 'text-gray-400'}>
              {tab.icon}
            </div>
            <span className="text-sm font-medium">{tab.label}</span>
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-600 text-gray-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Applications Grid */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-400">Loading applications...</p>
          </div>
        ) : currentApplications.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h4 className="text-lg font-medium text-gray-400 mb-2">No Applications</h4>
            <p className="text-gray-500">No {activeTab} applications at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentApplications.map(renderApplicationCard)}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{officerApps.length}</div>
          <div className="text-xs text-gray-400">Officer Apps</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{creatorApps.length}</div>
          <div className="text-xs text-gray-400">Creator/Seller Apps</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{approvedApps.length}</div>
          <div className="text-xs text-gray-400">Recently Approved</div>
        </div>
      </div>
    </div>
  )
}
