import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuthStore } from "../../lib/store"
import { Shield, CheckCircle, XCircle } from "lucide-react"

interface QuizResult {
  id: string
  officer_name?: string
  officer_username?: string
  question_text: string
  submitted_answer: string
  correct_answer?: string
  is_correct: boolean
  quiz_submission_id?: string
  created_at?: string
}

export default function LeadOfficerReview() {
  const { profile, user } = useAuthStore()
  const [results, setResults] = useState<QuizResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        // Try to fetch from the view first
        const { data, error } = await supabase
          .from("officer_quiz_results_view")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) {
          console.warn("View not found, trying alternative query:", error)
          // Fallback: query quiz_submissions and quiz_answers directly
          const { data: submissions, error: subError } = await supabase
            .from("officer_quiz_submissions")
            .select(`
              id,
              user_id,
              created_at,
              user_profiles!user_id(username),
              quiz_answers (
                question_id,
                submitted_answer,
                officer_quiz_questions!question_id (
                  question_text,
                  correct_answer
                )
              )
            `)
            .order("created_at", { ascending: false })
            .limit(50)

          if (subError) {
            console.error("Error loading quiz results:", subError)
            return
          }

          // Transform the data to match the expected format
          const transformedResults: QuizResult[] = []
          submissions?.forEach((sub: any) => {
            sub.quiz_answers?.forEach((answer: any) => {
              const question = answer.officer_quiz_questions
              if (question) {
                transformedResults.push({
                  id: `${sub.id}-${answer.question_id}`,
                  officer_name: sub.user_profiles?.username || "Unknown",
                  officer_username: sub.user_profiles?.username,
                  question_text: question.question_text,
                  submitted_answer: answer.submitted_answer,
                  correct_answer: question.correct_answer,
                  is_correct: answer.submitted_answer?.trim().toLowerCase() === question.correct_answer?.trim().toLowerCase(),
                  quiz_submission_id: sub.id,
                  created_at: sub.created_at
                })
              }
            })
          })
          setResults(transformedResults)
        } else {
          setResults(data || [])
        }
      } catch (err) {
        console.error("Error loading quiz results:", err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Loading quiz submissions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Officer Quiz Submissions Review
          </h1>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No quiz submissions found</p>
            <p className="text-sm mt-2">Quiz results will appear here once officers submit their quizzes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((r) => (
              <div
                key={r.id}
                className="p-6 bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl hover:border-purple-500/50 transition-all"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-purple-400 mb-1">Officer</div>
                    <div className="text-white font-semibold">
                      {r.officer_name || r.officer_username || "Unknown Officer"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-purple-400">Status</div>
                    {r.is_correct ? (
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-semibold">Correct</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-400">
                        <XCircle className="w-5 h-5" />
                        <span className="font-semibold">Incorrect</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-purple-500/20">
                  <div className="text-sm text-purple-400 mb-1">Question</div>
                  <div className="text-white mb-4">{r.question_text}</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-purple-400 mb-1">Submitted Answer</div>
                      <div className="text-gray-300 bg-black/40 p-3 rounded-lg">
                        {r.submitted_answer || "No answer provided"}
                      </div>
                    </div>
                    {r.correct_answer && (
                      <div>
                        <div className="text-sm text-purple-400 mb-1">Correct Answer</div>
                        <div className="text-green-300 bg-green-900/20 p-3 rounded-lg border border-green-500/30">
                          {r.correct_answer}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {r.created_at && (
                  <div className="mt-4 text-xs text-gray-500">
                    Submitted: {new Date(r.created_at).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

