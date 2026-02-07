import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { trollCityTheme } from '../styles/trollCityTheme'
import { X, ChevronLeft, ChevronRight, CheckCircle, Sparkles } from 'lucide-react'

interface TourStep {
  step_number: number
  title: string
  description: string
  target_feature: string
  route_path: string
  action_type: string
}

interface DistrictOnboardingTourProps {
  isOpen: boolean
  onClose: () => void
  districtName: string
  onComplete: () => void
}

export default function DistrictOnboardingTour({
  isOpen,
  onClose,
  districtName,
  onComplete
}: DistrictOnboardingTourProps) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [tourSteps, setTourSteps] = useState<TourStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)

  const loadTourSteps = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_district_onboarding_tour', {
        p_district_name: districtName
      })

      if (error) throw error

      setTourSteps(data || [])
      setCurrentStep(0)
      setCompleted(false)
    } catch (error) {
      console.error('Error loading tour steps:', error)
    } finally {
      setLoading(false)
    }
  }, [districtName])

  useEffect(() => {
    if (isOpen && districtName) {
      loadTourSteps()
    }
  }, [isOpen, districtName, loadTourSteps])

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeTour()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const completeTour = async () => {
    if (!user?.id) return

    try {
      // Mark tour as completed
      const { data: districts } = await supabase.rpc('get_user_accessible_districts', {
        p_user_id: user.id
      })

      const district = districts?.find((d: any) => d.name === districtName)
      if (district) {
        await supabase.rpc('update_district_progress', {
          p_user_id: user.id,
          p_district_id: district.id,
          p_onboarding_completed: true
        })
      }

      setCompleted(true)
      setTimeout(() => {
        onComplete()
        onClose()
      }, 2000)
    } catch (error) {
      console.error('Error completing tour:', error)
    }
  }

  const navigateToFeature = () => {
    const step = tourSteps[currentStep]
    if (step?.route_path) {
      navigate(step.route_path)
      // Close tour after navigation
      setTimeout(() => {
        onClose()
      }, 500)
    }
  }

  if (!isOpen) return null

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className={`${trollCityTheme.backgrounds.card} rounded-xl p-6 ${trollCityTheme.borders.glass}`}>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-700 rounded w-48"></div>
            <div className="h-16 bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-700 rounded w-32"></div>
          </div>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className={`${trollCityTheme.backgrounds.card} rounded-xl p-8 border border-green-500/30 text-center`}>
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className={`text-2xl font-bold ${trollCityTheme.text.primary} mb-2`}>Tour Completed!</h2>
          <p className={`${trollCityTheme.text.muted}`}>You&apos;ve successfully explored this district.</p>
        </div>
      </div>
    )
  }

  const currentStepData = tourSteps[currentStep]
  const progress = ((currentStep + 1) / tourSteps.length) * 100

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`${trollCityTheme.backgrounds.card} rounded-xl ${trollCityTheme.borders.glass} max-w-2xl w-full max-h-[90vh] overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${trollCityTheme.borders.glass}`}>
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <div>
              <h2 className={`text-xl font-bold ${trollCityTheme.text.primary}`}>District Tour</h2>
              <p className={`text-sm ${trollCityTheme.text.muted}`}>
                Step {currentStep + 1} of {tourSteps.length}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3">
          <div className="w-full bg-white/5 rounded-full h-2">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {currentStepData && (
            <div className="space-y-6">
              <div>
                <h3 className={`text-2xl font-bold ${trollCityTheme.text.primary} mb-3`}>
                  {currentStepData.title}
                </h3>
                <p className={`${trollCityTheme.text.muted} text-lg leading-relaxed`}>
                  {currentStepData.description}
                </p>
              </div>

              {currentStepData.target_feature && (
                <div className={`bg-white/5 rounded-lg p-4 border ${trollCityTheme.borders.glass}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                    <span className="font-semibold text-purple-300">
                      Featured: {currentStepData.target_feature}
                    </span>
                  </div>
                  {currentStepData.route_path && (
                    <p className={`text-sm ${trollCityTheme.text.muted}`}>
                      Navigate to: {currentStepData.route_path}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <button
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1F1F2E] hover:bg-[#252530] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <div className="flex gap-3">
                  {currentStepData.action_type === 'navigate' && (
                    <button
                      onClick={navigateToFeature}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-semibold"
                    >
                      Go There
                    </button>
                  )}

                  <button
                    onClick={nextStep}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-semibold"
                  >
                    {currentStep === tourSteps.length - 1 ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Complete Tour
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}