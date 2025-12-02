import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { BookOpen, Shield, AlertTriangle, CheckCircle, FileText, Lock, ArrowRight } from 'lucide-react'

export default function Orientation() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [orientationStatus, setOrientationStatus] = useState<any>(null)

  useEffect(() => {
    if (!profile || !user) {
      navigate('/')
      return
    }

    // Admins don't need orientation/quiz - they're automatically active
    if (profile.role === 'admin' || profile.is_admin) {
      toast.info('Admins have full officer access without needing to complete orientation')
      navigate('/officer/lounge')
      return
    }

    // Lead officers don't need orientation/quiz - they're activated immediately
    if (profile.is_lead_officer) {
      toast.info('Lead officers do not need to complete orientation')
      navigate('/officer/lounge')
      return
    }

    // Check if user is an officer but not active
    if (profile.is_troll_officer && !profile.is_officer_active) {
      loadOrientationStatus()
    } else if (!profile.is_troll_officer) {
      toast.error('You must be an approved officer to access orientation')
      navigate('/')
    } else {
      // Already active, redirect to lounge
      navigate('/officer/lounge')
    }
  }, [profile, user, navigate])

  const loadOrientationStatus = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_officer_orientation_status', {
        p_user_id: user.id
      })

      if (error) throw error
      if (data) {
        setOrientationStatus(data)
      }
    } catch (err: any) {
      console.error('Error loading orientation status:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStartQuiz = () => {
    navigate('/officer/orientation/quiz')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Shield className="w-20 h-20 text-purple-400" />
              <div className="absolute inset-0 bg-purple-400/20 blur-2xl"></div>
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Troll Officer Orientation
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Welcome to the Troll Officer training program. Complete this orientation to become an active officer.
          </p>
        </div>

        {/* Status Card */}
        {orientationStatus && (
          <div className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold mb-2">Your Progress</h3>
                <div className="flex items-center gap-4">
                  {orientationStatus.status === 'assigned' && (
                    <span className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-semibold">
                      Orientation Assigned
                    </span>
                  )}
                  {orientationStatus.status === 'in_progress' && (
                    <span className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-semibold">
                      In Progress
                    </span>
                  )}
                  <span className="text-sm text-gray-400">
                    Attempts: {orientationStatus.attempts || 0} / {orientationStatus.max_attempts || 3}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Training Sections */}
        <div className="space-y-6 mb-12">
          {/* Troll City Conduct Standards */}
          <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8 hover:border-purple-500/50 transition-all">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <FileText className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-4 text-purple-300">Troll City Conduct Standards</h2>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Maintain order and enforce community guidelines fairly and consistently</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Treat all users with respect, regardless of their status or behavior</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Act with integrity and avoid conflicts of interest</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Keep all moderation actions confidential and professional</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Report any officer misconduct to administrators immediately</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* What is Bannable */}
          <div className="bg-[#1A1A1A] border-2 border-red-500/30 rounded-xl p-8 hover:border-red-500/50 transition-all">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-red-500/20 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-4 text-red-300">What is Bannable?</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-red-400 mb-2">Immediate Ban Offenses:</h3>
                    <ul className="space-y-2 text-gray-300 ml-4">
                      <li>• Harassment, threats, or hate speech</li>
                      <li>• Sharing explicit or illegal content</li>
                      <li>• Scamming, fraud, or financial exploitation</li>
                      <li>• Impersonating staff or other users</li>
                      <li>• Repeated violations after multiple warnings</li>
                    </ul>
                  </div>
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-sm text-red-300">
                      <strong>Important:</strong> Always issue warnings first for minor offenses. Bans should be a last resort after warnings have been ignored.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* How to Review a Report */}
          <div className="bg-[#1A1A1A] border-2 border-blue-500/30 rounded-xl p-8 hover:border-blue-500/50 transition-all">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-4 text-blue-300">How to Review a Report</h2>
                <ol className="space-y-3 text-gray-300 list-decimal list-inside">
                  <li><strong className="text-blue-400">Read the report carefully</strong> - Understand the full context of the complaint</li>
                  <li><strong className="text-blue-400">Check evidence</strong> - Review any screenshots, messages, or other evidence provided</li>
                  <li><strong className="text-blue-400">Investigate the user</strong> - Check their history for patterns of behavior</li>
                  <li><strong className="text-blue-400">Determine severity</strong> - Assess whether it's a warning, suspension, or ban offense</li>
                  <li><strong className="text-blue-400">Take appropriate action</strong> - Issue warning, suspend, or ban based on severity</li>
                  <li><strong className="text-blue-400">Document your action</strong> - Add notes explaining your decision</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Warn vs Suspend vs Ban */}
          <div className="bg-[#1A1A1A] border-2 border-yellow-500/30 rounded-xl p-8 hover:border-yellow-500/50 transition-all">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <Shield className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-4 text-yellow-300">Warn vs Suspend vs Ban</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-yellow-400 mb-2">⚠️ Warn</h3>
                    <p className="text-sm text-gray-300">
                      For minor first-time offenses. Notifies the user of the violation. No restrictions applied.
                    </p>
                  </div>
                  <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-orange-400 mb-2">⏸️ Suspend</h3>
                    <p className="text-sm text-gray-300">
                      For repeated violations or moderate offenses. Temporarily restricts user access (stream, chat, etc.) for a set duration.
                    </p>
                  </div>
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-red-400 mb-2">🚫 Ban</h3>
                    <p className="text-sm text-gray-300">
                      For serious violations or after multiple warnings. Permanently removes user access. Requires admin approval for restoration.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Confidentiality & Duty */}
          <div className="bg-[#1A1A1A] border-2 border-green-500/30 rounded-xl p-8 hover:border-green-500/50 transition-all">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <Lock className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-4 text-green-300">Confidentiality & Duty</h2>
                <div className="space-y-4 text-gray-300">
                  <p>
                    As a Troll Officer, you have access to sensitive information and moderation tools. You must:
                  </p>
                  <ul className="space-y-2 ml-4">
                    <li>• Keep all reports and moderation actions confidential</li>
                    <li>• Never share user information or internal discussions publicly</li>
                    <li>• Use your powers responsibly and only for legitimate moderation purposes</li>
                    <li>• Never accept gifts, payments, or favors in exchange for moderation actions</li>
                    <li>• Report any attempts to bribe or influence you to administrators</li>
                    <li>• Maintain professional boundaries with all users</li>
                  </ul>
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <p className="text-sm text-green-300">
                      <strong>Remember:</strong> Your role is to serve and protect the Troll City community. Abuse of power will result in immediate removal and potential legal action.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Start Quiz Button */}
        <div className="text-center">
          <button
            onClick={handleStartQuiz}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-purple-500/50 flex items-center gap-3 mx-auto"
          >
            <BookOpen className="w-6 h-6" />
            Start Quiz
            <ArrowRight className="w-6 h-6" />
          </button>
          <p className="text-sm text-gray-400 mt-4">
            You must score at least <strong className="text-yellow-400">80%</strong> to pass. You have <strong className="text-yellow-400">3 attempts</strong> maximum.
          </p>
        </div>
      </div>
    </div>
  )
}

