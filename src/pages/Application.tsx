import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { Shield, Users, Skull, Crown, CheckCircle, XCircle } from 'lucide-react'

type ApplicationType = 'troll_officer' | 'troll_family' | 'troller' | 'lead_officer' | null

export default function Application() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState<ApplicationType>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }
  }, [user, navigate])

  const handleApplication = async (type: ApplicationType) => {
    if (!user || !type) return

    setLoading(true)
    try {
      // Check if user already has this role
      if (type === 'troll_officer' && (profile?.is_troll_officer || profile?.role === 'troll_officer')) {
        toast.error('You are already a Troll Officer')
        return
      }

      if (type === 'lead_officer' && profile?.is_lead_officer) {
        toast.error('You are already a Lead Officer')
        return
      }

      // Navigate to specific application page
      if (type === 'troll_officer') {
        navigate('/apply/officer')
      } else if (type === 'troll_family') {
        navigate('/apply/family')
      } else if (type === 'troller') {
        navigate('/apply/troller')
      } else if (type === 'lead_officer') {
        // Navigate to lead officer application page (if exists) or show form
        navigate('/apply/lead-officer')
      }
    } catch (error: any) {
      console.error('Error starting application:', error)
      toast.error('Failed to start application')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Please log in to apply</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 bg-purple-600 rounded-lg"
          >
            Log In
          </button>
        </div>
      </div>
    )
  }

  const applicationTypes = [
    {
      type: 'troll_officer' as ApplicationType,
      title: 'Troll Officer',
      icon: Shield,
      description: 'Moderate streams, enforce rules, and keep Troll City safe',
      color: 'purple',
      disabled: profile?.is_troll_officer || profile?.role === 'troll_officer',
      disabledText: 'You are already a Troll Officer'
    },
    {
      type: 'troll_family' as ApplicationType,
      title: 'Troll Family',
      icon: Users,
      description: 'Join or create a family, participate in family wars',
      color: 'blue',
      disabled: profile?.role === 'troll_family',
      disabledText: 'You are already in a family'
    },
    {
      type: 'troller' as ApplicationType,
      title: 'Troller',
      icon: Skull,
      description: 'Become a certified troller with special privileges',
      color: 'red',
      disabled: profile?.is_troller || profile?.role === 'troller',
      disabledText: 'You are already a Troller'
    },
    {
      type: 'lead_officer' as ApplicationType,
      title: 'Lead Officer',
      icon: Crown,
      description: 'Lead and manage Troll Officers',
      color: 'yellow',
      disabled: profile?.is_lead_officer,
      disabledText: 'You are already a Lead Officer'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Apply for Roles</h1>
          <p className="text-gray-400">Choose a role to apply for in Troll City</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {applicationTypes.map((app) => {
            const Icon = app.icon
            const isDisabled = app.disabled || loading
            const colorClasses = {
              purple: 'border-purple-600 bg-purple-900/20',
              blue: 'border-blue-600 bg-blue-900/20',
              red: 'border-red-600 bg-red-900/20',
              yellow: 'border-yellow-600 bg-yellow-900/20'
            }

            return (
              <div
                key={app.type}
                className={`rounded-xl border-2 p-6 transition-all ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:scale-105 cursor-pointer hover:shadow-lg'
                } ${colorClasses[app.color as keyof typeof colorClasses]}`}
                onClick={() => !isDisabled && handleApplication(app.type)}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-3 rounded-lg bg-${app.color}-600/20`}>
                    <Icon className={`w-8 h-8 text-${app.color}-400`} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{app.title}</h2>
                  </div>
                  {app.disabled && (
                    <div className="flex items-center gap-2">
                      {profile?.is_lead_officer || profile?.is_troll_officer ? (
                        <CheckCircle className="w-6 h-6 text-green-400" />
                      ) : (
                        <XCircle className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  )}
                </div>
                <p className="text-gray-300 mb-4">{app.description}</p>
                {app.disabled && (
                  <p className="text-sm text-gray-400 italic">{app.disabledText}</p>
                )}
                {!app.disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleApplication(app.type)
                    }}
                    disabled={loading}
                    className={`w-full px-4 py-2 rounded-lg font-semibold bg-${app.color}-600 hover:bg-${app.color}-700 disabled:opacity-50`}
                  >
                    {loading ? 'Loading...' : 'Apply Now'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-8 bg-black/60 border border-purple-600/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-2">Application Process</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>• Select a role above to start your application</li>
            <li>• Complete the application form with required information</li>
            <li>• Pay any required application fees (if applicable)</li>
            <li>• Wait for admin review and approval</li>
            <li>• You'll receive a notification when your application is reviewed</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
