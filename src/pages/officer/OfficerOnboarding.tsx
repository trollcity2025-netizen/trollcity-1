import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { 
  BookOpen, Shield, CheckCircle, ArrowRight, FileText, 
  AlertTriangle, Lock, Users, MessageSquare, Clock
} from 'lucide-react'

interface OnboardingStep {
  id: string
  title: string
  icon: React.ReactNode
  content: React.ReactNode
  completed: boolean
}

export default function OfficerOnboarding() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!profile || !user) {
      navigate('/')
      return
    }

    if (!profile.is_troll_officer && profile.role !== 'troll_officer') {
      toast.error('You must be an approved officer to access onboarding')
      navigate('/')
      return
    }

    // Load completed steps from localStorage
    const saved = localStorage.getItem(`officer_onboarding_${user.id}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setCompletedSteps(new Set(parsed))
      } catch (e) {
        console.error('Error loading onboarding progress:', e)
      }
    }
  }, [profile, user, navigate])

  const markStepComplete = (stepId: string) => {
    const newCompleted = new Set(completedSteps)
    newCompleted.add(stepId)
    setCompletedSteps(newCompleted)
    if (user?.id) {
      localStorage.setItem(`officer_onboarding_${user.id}`, JSON.stringify(Array.from(newCompleted)))
    }
  }

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Troll Officer',
      icon: <Shield className="w-8 h-8" />,
      completed: completedSteps.has('welcome'),
      content: (
        <div className="space-y-4">
          <p className="text-lg text-gray-300">
            Welcome to the Troll Officer program! As a Troll Officer, you play a crucial role in maintaining 
            the safety and integrity of Troll City.
          </p>
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <h3 className="font-semibold text-purple-300 mb-2">Your Mission</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>• Protect the community from harassment and abuse</li>
              <li>• Enforce community guidelines fairly and consistently</li>
              <li>• Help create a safe and enjoyable environment for all users</li>
              <li>• Act with integrity and professionalism at all times</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'conduct',
      title: 'Code of Conduct',
      icon: <FileText className="w-8 h-8" />,
      completed: completedSteps.has('conduct'),
      content: (
        <div className="space-y-4">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <h3 className="font-semibold text-red-300 mb-3">❌ Never Do:</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>• Abuse your powers for personal gain</li>
              <li>• Accept gifts, payments, or favors from users</li>
              <li>• Use your status to promote personal content</li>
              <li>• Share confidential information publicly</li>
              <li>• Ban users without proper warnings</li>
              <li>• Show favoritism or bias</li>
            </ul>
          </div>
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
            <h3 className="font-semibold text-green-300 mb-3">✅ Always Do:</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>• Treat all users with respect</li>
              <li>• Issue warnings before bans (except for severe violations)</li>
              <li>• Document your actions clearly</li>
              <li>• Report officer misconduct immediately</li>
              <li>• Keep moderation actions confidential</li>
              <li>• Act fairly and consistently</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'moderation',
      title: 'Moderation Guidelines',
      icon: <AlertTriangle className="w-8 h-8" />,
      completed: completedSteps.has('moderation'),
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-yellow-400 mb-2">⚠️ Warning</h3>
              <p className="text-sm text-gray-300">
                For minor first-time offenses. Notifies the user of the violation. No restrictions applied.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-orange-400 mb-2">⏸️ Suspend Stream</h3>
              <p className="text-sm text-gray-300">
                For repeated violations or moderate offenses. Temporarily stops the stream. User can start a new stream after suspension period.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-red-400 mb-2">🚫 Ban User</h3>
              <p className="text-sm text-gray-300">
                For serious violations or after multiple warnings. Can be temporary (with duration) or permanent. 
                Always provide a clear, honest reason - this helps users understand and potentially return.
              </p>
            </div>
          </div>
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              <strong>Remember:</strong> Being honest about why someone was banned helps them get back on the app. 
              Always provide clear, honest reasons for your actions.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'reporting',
      title: 'Reporting System',
      icon: <MessageSquare className="w-8 h-8" />,
      completed: completedSteps.has('reporting'),
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            The reporting system works in three levels:
          </p>
          <div className="space-y-3">
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
              <h3 className="font-semibold text-purple-300 mb-2">Level 1: User Reports</h3>
              <p className="text-sm text-gray-300">
                Users can report other users or streams. These reports come to you for review.
              </p>
            </div>
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <h3 className="font-semibold text-blue-300 mb-2">Level 2: Officer Review</h3>
              <p className="text-sm text-gray-300">
                You review reports and take appropriate action (warn, suspend, ban). If a case is too complex 
                or requires admin attention, you can escalate it.
              </p>
            </div>
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <h3 className="font-semibold text-green-300 mb-2">Level 3: Admin Review</h3>
              <p className="text-sm text-gray-300">
                Complex cases or appeals can be escalated to admins for final review.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'tools',
      title: 'Officer Tools',
      icon: <Shield className="w-8 h-8" />,
      completed: completedSteps.has('tools'),
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="font-semibold text-purple-300 mb-2">Moderation Dashboard</h3>
              <p className="text-sm text-gray-300">
                Review reports, take actions, and manage user violations.
              </p>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="font-semibold text-purple-300 mb-2">Shift Scheduling</h3>
              <p className="text-sm text-gray-300">
                Schedule your work shifts and track your hours.
              </p>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="font-semibold text-purple-300 mb-2">Officer Lounge</h3>
              <p className="text-sm text-gray-300">
                Access officer resources, announcements, and tools.
              </p>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="font-semibold text-purple-300 mb-2">Ban Management</h3>
              <p className="text-sm text-gray-300">
                Set ban durations, manage temporary and permanent bans.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'complete',
      title: 'Complete Onboarding',
      icon: <CheckCircle className="w-8 h-8" />,
      completed: completedSteps.has('complete'),
      content: (
        <div className="space-y-4 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
          <h3 className="text-2xl font-bold text-green-400">Onboarding Complete!</h3>
          <p className="text-gray-300">
            You've completed the Troll Officer onboarding. You're now ready to start moderating!
          </p>
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-sm text-purple-300">
              Remember: Always act with integrity, fairness, and respect. The community trusts you to keep Troll City safe.
            </p>
          </div>
        </div>
      )
    }
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      markStepComplete(steps[currentStep].id)
      setCurrentStep(currentStep + 1)
    } else {
      markStepComplete(steps[currentStep].id)
      navigate('/officer/orientation')
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    navigate('/officer/orientation')
  }

  if (!profile || !user) {
    return null
  }

  const currentStepData = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-400">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              {currentStepData.icon}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-purple-300">{currentStepData.title}</h2>
              {currentStepData.completed && (
                <span className="text-xs text-green-400 flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3" />
                  Completed
                </span>
              )}
            </div>
          </div>

          <div className="min-h-[300px]">
            {currentStepData.content}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div>
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <ArrowRight className="w-5 h-5 rotate-180" />
                Previous
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {currentStep < steps.length - 1 && (
              <button
                onClick={handleSkip}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
              >
                Skip to Quiz
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              {currentStep === steps.length - 1 ? 'Start Quiz' : 'Next'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentStep
                  ? 'bg-purple-500 w-8'
                  : step.completed
                  ? 'bg-green-500'
                  : 'bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

