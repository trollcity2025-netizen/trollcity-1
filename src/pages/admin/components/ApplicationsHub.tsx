import React, { useState } from 'react'
import {
  FileText,
  Users,
  Crown,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Award,
  UserCheck,
  RefreshCw
} from 'lucide-react'

interface ApplicationsHubProps {
  onLoadApplications?: () => void
  applicationsLoading?: boolean
  applications?: any[]
  onApproveApplication?: (appId: string, userId: string, newRole: string) => void
  onRejectApplication?: (id: string) => void
}

export default function ApplicationsHub({
  onLoadApplications,
  applicationsLoading = false,
  applications = [],
  onApproveApplication,
  onRejectApplication
}: ApplicationsHubProps) {
  const [activeTab, setActiveTab] = useState<string>('officer')

  const tabs = [
    {
      id: 'officer',
      label: 'Officer Applications',
      icon: <Shield className="w-4 h-4" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30',
      count: 0 // Will be populated from data
    },
    {
      id: 'broadcaster',
      label: 'Broadcaster Applications',
      icon: <Crown className="w-4 h-4" />,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30',
      count: 0 // Will be populated from data
    },
    {
      id: 'creator',
      label: 'Creator Applications',
      icon: <Star className="w-4 h-4" />,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30',
      count: 0 // Will be populated from data
    },
    {
      id: 'approved',
      label: 'Recently Approved',
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
      count: 0 // Will be populated from data
    }
  ]

  const mockApplications = {
    officer: [
      {
        id: '1',
        user_id: 'user-1',
        username: 'TrollMaster2025',
        type: 'officer',
        status: 'pending',
        created_at: new Date().toISOString(),
        experience: '2 years streaming',
        reason: 'Want to help maintain order in Troll City'
      },
      {
        id: '2',
        user_id: 'user-2',
        username: 'CityGuardian',
        type: 'officer',
        status: 'pending',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        experience: 'Former moderator',
        reason: 'Passionate about community safety'
      }
    ],
    broadcaster: [
      {
        id: '3',
        user_id: 'user-3',
        username: 'StreamQueen',
        type: 'broadcaster',
        status: 'pending',
        created_at: new Date().toISOString(),
        content_type: 'Gaming & Entertainment',
        followers: 1500
      }
    ],
    creator: [
      {
        id: '4',
        user_id: 'user-4',
        username: 'ArtisticTroll',
        type: 'creator',
        status: 'pending',
        created_at: new Date().toISOString(),
        portfolio: 'Digital art and animations',
        experience: '3 years creating content'
      }
    ],
    approved: [
      {
        id: '5',
        user_id: 'user-5',
        username: 'OfficerMike',
        type: 'officer',
        status: 'approved',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        approved_at: new Date(Date.now() - 86400000).toISOString(),
        approved_by: 'Admin'
      }
    ]
  }

  const getApplicationsForTab = (tabId: string) => {
    return mockApplications[tabId as keyof typeof mockApplications] || []
  }

  const renderApplicationCard = (app: any) => (
    <div key={app.id} className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#2C2C2C] rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h4 className="font-medium text-white">{app.username}</h4>
            <p className="text-xs text-gray-400 capitalize">{app.type} Application</p>
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
        {app.experience && (
          <div className="text-sm">
            <span className="text-gray-400">Experience:</span>
            <span className="text-white ml-2">{app.experience}</span>
          </div>
        )}
        {app.reason && (
          <div className="text-sm">
            <span className="text-gray-400">Reason:</span>
            <span className="text-white ml-2">{app.reason}</span>
          </div>
        )}
        {app.content_type && (
          <div className="text-sm">
            <span className="text-gray-400">Content Type:</span>
            <span className="text-white ml-2">{app.content_type}</span>
          </div>
        )}
        {app.followers && (
          <div className="text-sm">
            <span className="text-gray-400">Followers:</span>
            <span className="text-white ml-2">{app.followers.toLocaleString()}</span>
          </div>
        )}
        {app.portfolio && (
          <div className="text-sm">
            <span className="text-gray-400">Portfolio:</span>
            <span className="text-white ml-2">{app.portfolio}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Applied {new Date(app.created_at).toLocaleDateString()}</span>
        {app.approved_at && (
          <span>Approved {new Date(app.approved_at).toLocaleDateString()}</span>
        )}
      </div>

      {app.status === 'pending' && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onApproveApplication?.(app.id, app.user_id, app.type === 'officer' ? 'troll_officer' : app.type)}
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
          onClick={onLoadApplications}
          disabled={applicationsLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${applicationsLoading ? 'animate-spin' : ''}`} />
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
        {applicationsLoading ? (
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
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{mockApplications.officer.length}</div>
          <div className="text-xs text-gray-400">Officer Apps</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{mockApplications.broadcaster.length}</div>
          <div className="text-xs text-gray-400">Broadcaster Apps</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{mockApplications.creator.length}</div>
          <div className="text-xs text-gray-400">Creator Apps</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{mockApplications.approved.length}</div>
          <div className="text-xs text-gray-400">Recently Approved</div>
        </div>
      </div>
    </div>
  )
}