import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react'

interface QuizQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  category: string
  order_index: number
  correct_answer?: string  // For text-based answers
}

export default function OrientationQuiz() {
  const { profile, user, setProfile } = useAuthStore()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizTimeStart, setQuizTimeStart] = useState<number | null>(null)
  const [orientationStatus, setOrientationStatus] = useState<any>(null)
  const [showResults, setShowResults] = useState(false)
  const [quizResult, setQuizResult] = useState<any>(null)

  useEffect(() => {
    if (!profile || !user) {
      navigate('/')
      return
    }

    if (!profile.is_troll_officer) {
      toast.error('You must be an approved officer to take the quiz')
      navigate('/')
      return
    }

    loadOrientationStatus()
    loadQuizQuestions()
  }, [profile, user, navigate])

  const loadOrientationStatus = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase.rpc('get_officer_orientation_status', {
        p_user_id: user.id
      })

      if (error) throw error
      if (data) {
        setOrientationStatus(data)
        
        // Check if max attempts reached
        if (data.status === 'failed') {
          toast.error('Maximum attempts reached. Please contact an administrator.')
          navigate('/officer/orientation')
          return
        }

        // Check if already passed
        if (data.status === 'passed') {
          toast.success('You have already passed the orientation!')
          navigate('/officer/lounge')
          return
        }

        // Start orientation if not started
        if (data.status === 'assigned') {
          await startOrientation()
        }
      }
    } catch (err: any) {
      console.error('Error loading orientation status:', err)
    }
  }

  const startOrientation = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase.rpc('start_officer_orientation', {
        p_user_id: user.id
      })

      if (error) throw error
      if (data?.success) {
        setQuizStarted(true)
        setQuizTimeStart(Date.now())
        await loadOrientationStatus()
      }
    } catch (err: any) {
      console.error('Error starting orientation:', err)
    }
  }

  const loadQuizQuestions = async () => {
    setLoading(true)
    try {
      console.log('Loading quiz questions...')
      const { data, error } = await supabase
        .from("officer_quiz_questions")
        .select("id, question_text, correct_answer")

      if (error) {
        console.error('Query error:', error)
        throw error
      }

      console.log('Quiz questions loaded:', data?.length || 0, 'questions')

      if (data && data.length > 0) {
        console.log('Sample question data:', data[0])
        // Map the data to match QuizQuestion interface
        const questionsData = data.map((q: any) => ({
          id: q.id,
          question_text: q.question_text,
          correct_answer: q.correct_answer,
          category: '', // Not needed for text-based quiz
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          order_index: 0
        })) as QuizQuestion[]
        
        // Log each question to see what fields are available
        questionsData.forEach((q, i) => {
          console.log(`Question ${i + 1}:`, {
            id: q.id,
            question_text: q.question_text,
            correct_answer: q.correct_answer
          })
        })
        setQuestions(questionsData)
        setQuizStarted(true)
        setQuizTimeStart(Date.now())
        console.log('Quiz started with', data.length, 'questions')
      } else {
        console.warn('No quiz questions returned from query')
        toast.error('No quiz questions available')
      }
    } catch (err: any) {
      console.error('Error loading quiz questions:', err)
      toast.error('Failed to load quiz questions: ' + (err?.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // Helper function to normalize answers for comparison
  const normalize = (str: string) => str.trim().toLowerCase()
  
  // Grading function for text-based answers
  const gradeAnswers = (questions: QuizQuestion[], answers: Record<string, string>) => {
    let score = 0
    
    for (const q of questions) {
      const userAnswer = answers[q.id] || ""
      const correct = q.correct_answer || ""
      
      const clean = (s: string) => s.trim().toLowerCase()
      
      if (clean(userAnswer) === clean(correct)) {
        score++
      }
    }
    
    return score
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

    const duration = quizTimeStart ? Math.floor((Date.now() - quizTimeStart) / 1000) : 0
    const totalQuestions = questions.length

    // Normalize function for text comparison
    const normalize = (s: string) => s.trim().toLowerCase()

    // Calculate score
    let score = 0
    for (const q of questions) {
      const userAnswer = answers[q.id] || ""
      const correct = q.correct_answer || ""
      if (normalize(userAnswer) === normalize(correct)) {
        score++
      }
    }

    const hasPassed = score >= Math.ceil(totalQuestions * 0.8)

    try {
      // Save answers to officer_orientation_results table
      const { error: saveError } = await supabase
        .from('officer_orientation_results')
        .upsert({
          user_id: user.id,
          score,
          has_passed: hasPassed,
          submitted_answers: answers,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (saveError) {
        console.error('Error saving orientation results:', saveError)
        toast.error('Failed to save quiz results')
      }

      // Also call the RPC function for backward compatibility
      const { data, error } = await supabase.rpc("submit_officer_quiz", {
        p_answers: answers,
        p_time_taken_seconds: duration,
        p_user_id: user.id,
      })

      if (error) {
        console.error("Quiz submission error:", error)
        toast.error("Failed to submit quiz. Try again.")
        setSubmitting(false)
        return
      }

      const passed = data?.passed ?? hasPassed

      if (passed) {
        toast.success("Quiz passed! Redirecting to Lead Officer review...")
        navigate("/lead-officer/review")
      } else {
        toast.error("Quiz failed! Redirecting to application page...")
        navigate("/admin/applications")
      }
    } catch (err: any) {
      console.error('Error in quiz submission:', err)
      toast.error(err.message || 'Failed to submit quiz')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Loading quiz...</p>
          <p className="text-sm text-gray-400 mt-2">Questions: {questions.length}</p>
        </div>
      </div>
    )
  }

  // Show results
  if (showResults && quizResult) {
    const passed = quizResult.passed
    const score = quizResult.score

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-2xl w-full"
        >
          <div className={`border-2 rounded-xl p-12 text-center ${
            passed 
              ? 'bg-green-900/20 border-green-500' 
              : 'bg-red-900/20 border-red-500'
          }`}>
            <AnimatePresence>
              {passed && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="mb-6"
                >
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full bg-yellow-400"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                      }}
                      initial={{ opacity: 0, y: 0 }}
                      animate={{ opacity: [0, 1, 0], y: -100 }}
                      transition={{ duration: 2, delay: Math.random() * 0.5 }}
                    />
                  ))}
                  <CheckCircle className="w-24 h-24 text-green-400 mx-auto mb-4" />
                </motion.div>
              )}
            </AnimatePresence>

            {!passed && (
              <XCircle className="w-24 h-24 text-red-400 mx-auto mb-4" />
            )}

            <h1 className={`text-4xl font-bold mb-4 ${
              passed ? 'text-green-400' : 'text-red-400'
            }`}>
              {passed ? '🎉 Congratulations!' : 'Quiz Failed'}
            </h1>

            <div className="mb-6">
              <div className="text-6xl font-bold mb-2" style={{
                background: passed 
                  ? 'linear-gradient(to right, #10b981, #34d399)'
                  : 'linear-gradient(to right, #ef4444, #f87171)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                {score}%
              </div>
              <p className="text-gray-300">
                {quizResult.correct_answers} out of {quizResult.total_questions} questions correct
              </p>
            </div>

            <p className="text-xl mb-8 text-gray-300">
              {passed 
                ? 'You are now an active Troll Officer! Redirecting to Officer Lounge...'
                : `Score below passing. You may retry. Remaining attempts: ${quizResult.attempts_remaining || 0}`
              }
            </p>

            {passed ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <Sparkles className="w-5 h-5" />
                  <span>Welcome to the team!</span>
                  <Sparkles className="w-5 h-5" />
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => navigate('/officer/orientation')}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
              >
                Return to Orientation
              </button>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  if (!quizStarted || questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Preparing quiz...</p>
          <p className="text-sm text-gray-400 mt-2">
            Quiz started: {quizStarted ? 'Yes' : 'No'} | Questions loaded: {questions.length}
          </p>
          {questions.length === 0 && (
            <button
              onClick={loadQuizQuestions}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
            >
              Retry Loading Questions
            </button>
          )}
        </div>
      </div>
    )
  }

  const allAnswered = questions.every(q => answers[q.id])
  const progress = (Object.keys(answers).length / questions.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">
              Progress: {Object.keys(answers).length} / {questions.length} answered
            </span>
            <span className="text-sm text-gray-400">
              {orientationStatus?.attempts || 0} / {orientationStatus?.max_attempts || 3} attempts
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-purple-600 to-pink-600 h-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6 mb-8">
          {questions.map((question, index) => {
            const isAnswered = !!answers[question.id]
            return (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-6 hover:border-purple-500/50 transition-all"
              >
                <div className="mb-4">
                  {question.category && (
                    <span className="text-xs text-purple-400 uppercase tracking-wide">{question.category}</span>
                  )}
                  <h3 className="text-xl font-bold mt-2 text-white">
                    {index + 1}. {question.question_text || 'Question text not available'}
                  </h3>
                  {!question.question_text && (
                    <p className="text-sm text-yellow-400 mt-1">⚠️ Question text missing from database</p>
                  )}
                </div>

                <input
                  type="text"
                  className="w-full rounded-lg border border-purple-600 bg-black/40 p-3 text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="Type your answer..."
                  value={answers[question.id] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.id]: e.target.value
                    }))
                  }
                />
              </motion.div>
            )
          })}
        </div>

        {/* Submit Button */}
        <div className="text-center">
          <button
            onClick={handleSubmitQuiz}
            disabled={!allAnswered || submitting}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg shadow-purple-500/50 flex items-center gap-3 mx-auto"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="w-6 h-6" />
                Submit Quiz
              </>
            )}
          </button>
          {!allAnswered && (
            <p className="text-sm text-yellow-400 mt-4">
              Please answer all {questions.length} questions before submitting
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

