import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Video, Clock, CheckCircle, XCircle, Calendar } from 'lucide-react'
import { Button } from '../components/ui/button'

interface Application {
  id: string
  type: string
  status: string
  created_at: string
}

interface Interview {
  id: string
  room_id: string
  scheduled_at: string
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'hired' | 'rejected'
}

export default function InterviewRoomPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [application, setApplication] = useState<Application | null>(null)
  const [interview, setInterview] = useState<Interview | null>(null)

  useEffect(() => {
    if (!user) return

    const checkStatus = async () => {
      try {
        // 1. Check Application
        const { data: appData, error: appError } = await supabase
          .from('applications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (appError) throw appError
        setApplication(appData)

        // 2. Check Interview if application exists
        if (appData) {
          const { data: interviewData, error: interviewError } = await supabase
            .from('interviews')
            .select('*')
            .eq('applicant_id', user.id)
            .order('scheduled_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (interviewError) throw interviewError
          setInterview(interviewData)
        }

      } catch (error) {
        console.error('Error checking status:', error)
      } finally {
        setLoading(false)
      }
    }

    checkStatus()

    // Realtime subscription for updates
    const subscription = supabase
      .channel('applicant-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'interviews', 
        filter: `applicant_id=eq.${user.id}` 
      }, () => {
        checkStatus()
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'applications', 
        filter: `user_id=eq.${user.id}` 
      }, () => {
        checkStatus()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  // Redirect admins
  if (profile?.role === 'admin' || profile?.is_lead_officer) {
      return (
          <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4">
              <h1 className="text-2xl font-bold mb-4">Interview Administration</h1>
              <p className="text-gray-400 mb-8">Please use the Admin Interview Dashboard to manage interviews.</p>
              <Button onClick={() => navigate('/admin/interview-test')} className="bg-cyan-600 hover:bg-cyan-700">
                  Go to Dashboard
              </Button>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
            Interview Center
          </h1>
          <p className="text-gray-400">Track your application status and join your interview</p>
        </header>

        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden">
          {/* Status Timeline */}
          <div className="p-6 border-b border-[#2C2C2C] space-y-6">
            
            {/* Step 1: Application */}
            <div className={`flex gap-4 ${!application ? 'opacity-50' : ''}`}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  application ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-500'
                }`}>
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="w-0.5 h-full bg-[#2C2C2C] my-2" />
              </div>
              <div className="pb-8">
                <h3 className="font-semibold text-lg">Application Submitted</h3>
                <p className="text-gray-400 text-sm mt-1">
                  {application ? 
                    `Submitted on ${new Date(application.created_at).toLocaleDateString()}` : 
                    'Submit your application to get started'}
                </p>
                {!application && (
                  <Button 
                    onClick={() => navigate('/apply/troller')} 
                    className="mt-4 bg-purple-600 hover:bg-purple-700"
                  >
                    Apply Now
                  </Button>
                )}
              </div>
            </div>

            {/* Step 2: Review */}
            <div className={`flex gap-4 ${application?.status === 'pending' ? 'opacity-100' : 'opacity-50'}`}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  application?.status === 'approved' || application?.status === 'rejected' ? 
                  'bg-green-500/20 text-green-400' : 
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {application?.status === 'rejected' ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div className="w-0.5 h-full bg-[#2C2C2C] my-2" />
              </div>
              <div className="pb-8">
                <h3 className="font-semibold text-lg">Application Review</h3>
                <p className="text-gray-400 text-sm mt-1">
                  {application?.status === 'pending' ? 'Your application is being reviewed by our team.' :
                   application?.status === 'approved' ? 'Your application has been approved!' :
                   application?.status === 'rejected' ? 'Your application was not successful.' :
                   'Pending submission'}
                </p>
              </div>
            </div>

            {/* Step 3: Interview */}
            <div className={`flex gap-4 ${interview ? 'opacity-100' : 'opacity-50'}`}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  interview?.status === 'completed' || interview?.status === 'hired' ? 
                  'bg-green-500/20 text-green-400' : 
                  interview ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-800 text-gray-500'
                }`}>
                  <Video className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Interview Session</h3>
                <p className="text-gray-400 text-sm mt-1">
                  {interview ? 
                    'Your interview has been scheduled.' : 
                    'Wait for an admin to schedule your interview.'}
                </p>
                
                {interview && (interview.status === 'pending' || interview.status === 'active') && (
                  <div className="mt-4 bg-[#0F0F1A] border border-cyan-900/30 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3 text-cyan-300">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">
                        {new Date(interview.scheduled_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                      Please join the interview room 5 minutes before your scheduled time. 
                      You will be placed in a queue until the interviewer joins.
                    </p>
                    <Button 
                      onClick={() => navigate(`/interview/${interview.room_id}`)}
                      className="w-full bg-cyan-600 hover:bg-cyan-700 flex items-center justify-center gap-2"
                    >
                      <Video className="w-4 h-4" />
                      Join Interview Room
                    </Button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center text-sm text-gray-500">
          <p>Need help? Contact support via the main dashboard.</p>
        </div>
      </div>
    </div>
  )
}
