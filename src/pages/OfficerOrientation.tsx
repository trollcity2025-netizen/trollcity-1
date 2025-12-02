import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { BookOpen, CheckCircle, XCircle, Clock, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react'

interface QuizQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  category: string
  order_index: number
}

interface OrientationStatus {
  has_orientation: boolean
  status: 'assigned' | 'in_progress' | 'passed' | 'failed' | null
  attempts: number
  max_attempts: number
  assigned_at: string | null
  started_at: string | null
  completed_at: string | null
}

export default function OfficerOrientation() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const [orientationStatus, setOrientationStatus] = useState<OrientationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizTimeStart, setQuizTimeStart] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!profile || !user) {
      navigate('/')
      return
    }
    loadOrientationStatus()
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
        setOrientationStatus(data as any)
      }
    } catch (err: any) {
      console.error('Error loading orientation status:', err)
      toast.error('Failed to load orientation status')
    } finally {
      setLoading(false)
    }
  }

  const startOrientation = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('start_officer_orientation', {
        p_user_id: user.id
      })

      if (error) throw error

      if (data?.success) {
        await loadQuizQuestions()
        setQuizStarted(true)
        setQuizTimeStart(Date.now())
        await loadOrientationStatus()
        toast.success('Orientation started! Good luck!')
      } else {
        toast.error(data?.error || 'Failed to start orientation')
      }
    } catch (err: any) {
      console.error('Error starting orientation:', err)
      toast.error(err?.message || 'Failed to start orientation')
    } finally {
      setLoading(false)
    }
  }

  const loadQuizQuestions = async () => {
    try {
      const { data, error } = await supabase.rpc('get_officer_quiz_questions')

      if (error) throw error

      if (data) {
        setQuestions(data as QuizQuestion[])
      }
    } catch (err: any) {
      console.error('Error loading quiz questions:', err)
      toast.error('Failed to load quiz questions')
    }
  }

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleSubmitQuiz = async () => {
    if (!user?.id) return

    // Check if all questions are answered
    const unanswered = questions.filter(q => !answers[q.id])
    if (unanswered.length > 0) {
      toast.error(`Please answer all questions. ${unanswered.length} question(s) remaining.`)
      return
    }

    setSubmitting(true)
    try {
      const timeTaken = quizTimeStart ? Math.floor((Date.now() - quizTimeStart) / 1000) : 0

      const { data, error } = await supabase.rpc('submit_officer_quiz', {
        p_user_id: user.id,
        p_answers: answers,
        p_time_taken_seconds: timeTaken
      })

      if (error) throw error

      if (data?.success) {
        if (data.passed) {
          toast.success(data.message || 'Congratulations! You passed!')
          setTimeout(() => {
            navigate('/officer/lounge')
          }, 3000)
        } else {
          toast.error(data.message || 'You did not pass. Please try again.')
        }
        await loadOrientationStatus()
        setQuizStarted(false)
        setAnswers({})
        setCurrentQuestionIndex(0)
      } else {
        toast.error(data?.error || 'Failed to submit quiz')
      }
    } catch (err: any) {
      console.error('Error submitting quiz:', err)
      toast.error(err?.message || 'Failed to submit quiz')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !orientationStatus) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Loading orientation...</p>
        </div>
      </div>
    )
  }

  // If orientation is passed, show success message
  if (orientationStatus?.status === 'passed') {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-green-900/20 border-2 border-green-500 rounded-xl p-8 text-center">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-4 text-green-400">Orientation Complete!</h1>
            <p className="text-xl mb-6">You have successfully completed the Troll Officer Orientation and Quiz.</p>
            <p className="text-gray-300 mb-8">You are now an active Troll Officer. Welcome to the team!</p>
            <button
              onClick={() => navigate('/officer/lounge')}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
            >
              Go to Officer Lounge
            </button>
          </div>
        </div>
      </div>
    )
  }

  // If orientation failed (max attempts reached)
  if (orientationStatus?.status === 'failed') {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/20 border-2 border-red-500 rounded-xl p-8 text-center">
            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-4 text-red-400">Maximum Attempts Reached</h1>
            <p className="text-xl mb-6">You have reached the maximum number of attempts (3).</p>
            <p className="text-gray-300 mb-8">Please contact an administrator for assistance.</p>
            <button
              onClick={() => navigate('/support')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    )
  }

  // If quiz is started, show quiz interface
  if (quizStarted && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex]
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100
    const allAnswered = questions.every(q => answers[q.id])

    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-4xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className="text-sm text-gray-400">
                {Object.keys(answers).length} / {questions.length} answered
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-8 mb-6">
            <div className="mb-6">
              <span className="text-xs text-purple-400 uppercase tracking-wide">{currentQuestion.category}</span>
              <h2 className="text-2xl font-bold mt-2">{currentQuestion.question_text}</h2>
            </div>

            <div className="space-y-3">
              {['a', 'b', 'c', 'd'].map(option => {
                const optionText = currentQuestion[`option_${option}` as keyof QuizQuestion] as string
                const isSelected = answers[currentQuestion.id] === option
                return (
                  <button
                    key={option}
                    onClick={() => handleAnswerSelect(currentQuestion.id, option)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-gray-700 hover:border-purple-500/50 bg-[#0D0D0D]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-gray-600'
                        }`}
                      >
                        {isSelected && <div className="w-3 h-3 rounded-full bg-white" />}
                      </div>
                      <span className="font-semibold text-purple-400 mr-2">{option.toUpperCase()}.</span>
                      <span>{optionText}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Previous
            </button>

            {currentQuestionIndex === questions.length - 1 ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={!allAnswered || submitting}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting ? 'Submitting...' : 'Submit Quiz'}
                <CheckCircle className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2"
              >
                Next
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show orientation dashboard/training content
  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
            <BookOpen className="w-10 h-10 text-purple-400" />
            Troll Officer Orientation
          </h1>
          <p className="text-gray-400 text-lg">
            Complete this orientation and pass the quiz to become an active Troll Officer.
          </p>
        </div>

        {/* Status Card */}
        {orientationStatus && (
          <div className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold mb-2">Orientation Status</h3>
                <div className="flex items-center gap-2 mb-2">
                  {orientationStatus.status === 'assigned' && (
                    <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
                      Assigned
                    </span>
                  )}
                  {orientationStatus.status === 'in_progress' && (
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                      In Progress
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  Attempts: {orientationStatus.attempts} / {orientationStatus.max_attempts}
                </p>
              </div>
              <div className="text-right">
                {orientationStatus.assigned_at && (
                  <p className="text-sm text-gray-400">
                    Assigned: {new Date(orientationStatus.assigned_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Training Content */}
        <div className="space-y-6 mb-8">
          <div className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-yellow-400" />
              Your Duties as a Troll Officer
            </h2>
            <ul className="space-y-2 text-gray-300">
              <li>• Maintain order and enforce community guidelines</li>
              <li>• Review and respond to user reports promptly</li>
              <li>• Warn users for minor violations before taking action</li>
              <li>• Ban users only after warnings and for serious violations</li>
              <li>• Protect the community from harassment and abuse</li>
              <li>• Act with integrity and fairness at all times</li>
            </ul>
          </div>

          <div className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-400" />
              Code of Conduct
            </h2>
            <ul className="space-y-2 text-gray-300">
              <li>• Never abuse your power or privileges</li>
              <li>• Do not accept gifts or payments from users</li>
              <li>• Do not use your status to promote personal content</li>
              <li>• Report officer misconduct to admins immediately</li>
              <li>• Keep your account credentials secure and private</li>
              <li>• Treat all users with respect and fairness</li>
            </ul>
          </div>

          <div className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-400" />
              Quiz Requirements
            </h2>
            <ul className="space-y-2 text-gray-300">
              <li>• You must score at least <strong className="text-yellow-400">80%</strong> to pass</li>
              <li>• You have <strong className="text-yellow-400">3 attempts</strong> maximum</li>
              <li>• The quiz contains 10 multiple-choice questions</li>
              <li>• You must answer all questions to submit</li>
              <li>• Take your time and read each question carefully</li>
            </ul>
          </div>
        </div>

        {/* Start Button */}
        <div className="text-center">
          {orientationStatus?.status === 'assigned' && (
            <button
              onClick={startOrientation}
              disabled={loading}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 mx-auto"
            >
              <BookOpen className="w-6 h-6" />
              Start Orientation & Quiz
            </button>
          )}
          {orientationStatus?.status === 'in_progress' && (
            <button
              onClick={startOrientation}
              disabled={loading}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 mx-auto"
            >
              <BookOpen className="w-6 h-6" />
              Continue Quiz
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

