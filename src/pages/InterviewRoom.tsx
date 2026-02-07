import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useTracks, 
  VideoTrack,
  useRoomContext,
  useLocalParticipant,
  useRemoteParticipants
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useLiveKitToken } from '../hooks/useLiveKitToken'
import { 
  Mic, MicOff, Video, VideoOff, MessageSquare, 
  Users, Clock, XCircle, Briefcase, Shield
} from 'lucide-react'

// Interview session type
interface InterviewSession {
  id: string
  application_id: string
  user_id: string
  interviewer_id: string
  scheduled_at: string
  status: 'active' | 'completed' | 'hired' | 'rejected'
  notes: string
  applicant_name: string
  applicant_username: string
}

// Fake avatar images for test mode
const fakeAvatars = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana',
]

function getFakeAvatar(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash = hash & hash
  }
  return fakeAvatars[Math.abs(hash) % fakeAvatars.length]
}

// Broadcast box component for showing video
function BroadcastBox({ 
  trackRef,
  participant,
  label, 
  isMuted, 
  isVideoOff,
  isInterviewer,
  useFakeAvatar = false
}: { 
  trackRef?: any
  participant?: any
  label: string
  isMuted?: boolean
  isVideoOff?: boolean
  isInterviewer?: boolean
  useFakeAvatar?: boolean
}) {
  const fakeAvatarUrl = getFakeAvatar(label)

  return (
    <div 
      className={`relative bg-gray-900 rounded-xl overflow-hidden border-2 ${
        isInterviewer ? 'border-purple-500' : 'border-cyan-500'
      }`}
    >
      {/* Fake avatar mode */}
      {useFakeAvatar ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-cyan-900/50 animate-pulse" />
          <div className="relative z-10 text-center">
            <div className="w-32 h-32 rounded-full bg-gray-800 p-2 mx-auto mb-4 shadow-2xl">
              <img 
                src={fakeAvatarUrl} 
                alt={label}
                className="w-full h-full rounded-full"
              />
            </div>
            <p className="text-white font-bold text-xl">{label}</p>
            <p className="text-cyan-400 text-sm mt-1">🎭 Test Mode</p>
          </div>
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/80 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white text-xs font-medium">REC</span>
          </div>
        </div>
      ) : trackRef && !isVideoOff ? (
        <VideoTrack 
          trackRef={trackRef}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isInterviewer ? 'bg-purple-500/20' : 'bg-cyan-500/20'
            }`}>
              <Users className={`w-10 h-10 ${isInterviewer ? 'text-purple-400' : 'text-cyan-400'}`} />
            </div>
            <p className="text-white font-medium">{label}</p>
            <p className="text-gray-400 text-sm">Camera Off</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 bg-black/60 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">
        {isInterviewer ? <Shield className="w-4 h-4 text-purple-400" /> : <Briefcase className="w-4 h-4 text-cyan-400" />}
        <span>{label}</span>
      </div>

      <div className="absolute top-2 right-2 flex gap-2">
        {isMuted && (
          <div className="bg-red-500/80 p-1.5 rounded-full">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}
        {isVideoOff && (
          <div className="bg-red-500/80 p-1.5 rounded-full">
            <VideoOff className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </div>
  )
}

function InterviewContent({ 
  session, 
  testMode, 
  isAdminOrLead,
  setTestMode,
  showNotes,
  setShowNotes,
  notes,
  setNotes,
  hiring,
  hireCandidate,
  onLeave
}: {
  session: InterviewSession
  testMode: boolean
  isAdminOrLead: boolean
  setTestMode: (val: boolean) => void
  showNotes: boolean
  setShowNotes: (val: boolean) => void
  notes: string
  setNotes: (val: string) => void
  hiring: boolean
  hireCandidate: () => void
  onLeave: () => void
}) {
  const room = useRoomContext()
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone])
  const { localParticipant } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()
  
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)

  // Sync local mute/video state
  useEffect(() => {
    if (localParticipant) {
      setIsMuted(!localParticipant.isMicrophoneEnabled)
      setIsVideoOff(!localParticipant.isCameraEnabled)
    }
  }, [localParticipant?.isMicrophoneEnabled, localParticipant?.isCameraEnabled])

  const toggleMute = async () => {
    if (localParticipant) {
      const newState = !isMuted
      await localParticipant.setMicrophoneEnabled(!newState)
      setIsMuted(newState)
    }
  }

  const toggleVideo = async () => {
    if (localParticipant) {
      const newState = !isVideoOff
      await localParticipant.setCameraEnabled(!newState)
      setIsVideoOff(newState)
    }
  }

  // Find tracks for interviewer and applicant
  // We need to identify who is who.
  // isAdminOrLead = true -> Local is Interviewer, Remote is Applicant
  // isAdminOrLead = false -> Local is Applicant, Remote is Interviewer

  const localTrack = tracks.find(t => t.participant.identity === localParticipant.identity && t.source === Track.Source.Camera)
  
  // For simplicity in a 2-person room, we take the first remote participant
  const remoteParticipant = remoteParticipants[0]
  const remoteTrack = tracks.find(t => t.participant.identity === remoteParticipant?.identity && t.source === Track.Source.Camera)

  return (
    <>
      <div className="absolute inset-0 p-4 pt-20 pb-24">
        <div className="grid grid-cols-2 gap-4 h-full">
          {/* Interviewer Box */}
          <BroadcastBox 
            trackRef={isAdminOrLead ? localTrack : remoteTrack}
            participant={isAdminOrLead ? localParticipant : remoteParticipant}
            label={isAdminOrLead ? (localParticipant.name || 'Interviewer') : (remoteParticipant?.name || 'Interviewer')}
            isMuted={isAdminOrLead ? isMuted : (remoteParticipant?.isMicrophoneEnabled === false)}
            isVideoOff={isAdminOrLead ? isVideoOff : (remoteParticipant?.isCameraEnabled === false)}
            isInterviewer={true}
            useFakeAvatar={testMode && !isAdminOrLead}
          />
          
          {/* Applicant Box */}
          <BroadcastBox 
            trackRef={isAdminOrLead ? remoteTrack : localTrack}
            participant={isAdminOrLead ? remoteParticipant : localParticipant}
            label={session.applicant_name}
            isMuted={isAdminOrLead ? (remoteParticipant?.isMicrophoneEnabled === false) : isMuted}
            isVideoOff={isAdminOrLead ? (remoteParticipant?.isCameraEnabled === false) : isVideoOff}
            isInterviewer={false}
            useFakeAvatar={testMode && isAdminOrLead}
          />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-colors ${
              isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-colors ${
              isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
          </button>

          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`p-4 rounded-full transition-colors ${
              showNotes ? 'bg-cyan-500' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            <MessageSquare className="w-6 h-6 text-white" />
          </button>

          {isAdminOrLead && (
            <button
              onClick={() => setTestMode(!testMode)}
              className={`p-4 rounded-full transition-colors ${
                testMode ? 'bg-yellow-500' : 'bg-white/10 hover:bg-white/20'
              }`}
              title="Toggle Test Mode"
            >
              <span className="text-xl">🎭</span>
            </button>
          )}

          <button
            onClick={onLeave}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-colors"
          >
            End Interview
          </button>
        </div>

        {/* Notes & Actions Panel */}
        {showNotes && (
          <div className="absolute bottom-24 right-4 w-80 bg-gray-900/95 border border-white/10 rounded-xl p-4 backdrop-blur-sm overflow-y-auto max-h-[60vh]">
            <h3 className="text-white font-bold mb-2">Interview Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-32 bg-black/50 border border-white/10 rounded-lg p-2 text-white text-sm mb-4 focus:outline-none focus:border-cyan-500"
              placeholder="Take notes here..."
              readOnly={!isAdminOrLead}
            />
            {isAdminOrLead && (
              <div className="flex gap-2">
                <button
                  onClick={hireCandidate}
                  disabled={hiring}
                  className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                >
                  {hiring ? 'Processing...' : '✅ Hire Candidate'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Application Details Panel */}
        {showApplication && application && (
          <div className="absolute bottom-24 left-4 w-96 bg-gray-900/95 border border-white/10 rounded-xl p-6 backdrop-blur-sm overflow-y-auto max-h-[70vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Application Details</h3>
              <button onClick={() => setShowApplication(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Position</label>
                <p className="text-white font-medium capitalize">{application.type?.replace(/_/g, ' ')}</p>
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Status</label>
                <div className="mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    application.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    application.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {application.status?.toUpperCase()}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Submitted</label>
                <p className="text-white text-sm">{new Date(application.created_at).toLocaleDateString()}</p>
              </div>

              {/* Dynamic Answers Display */}
              {application.answers && typeof application.answers === 'object' && (
                <div className="border-t border-white/10 pt-4 mt-4">
                  <h4 className="text-cyan-400 font-medium mb-3">Responses</h4>
                  <div className="space-y-4">
                    {Object.entries(application.answers).map(([question, answer]: [string, any]) => (
                      <div key={question}>
                        <p className="text-gray-400 text-xs mb-1">{question}</p>
                        <p className="text-white text-sm bg-black/30 p-2 rounded border border-white/5">
                          {typeof answer === 'string' ? answer : JSON.stringify(answer)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Fallback if no structured answers but other fields exist */}
              {(!application.answers) && (
                 <div className="border-t border-white/10 pt-4 mt-4">
                   <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                     {JSON.stringify(application, (key, value) => {
                       if (['id', 'user_id', 'created_at', 'updated_at', 'status', 'type', 'reviewed_at'].includes(key)) return undefined;
                       return value;
                     }, 2)}
                   </pre>
                 </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function InterviewRoom() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()
  
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [application, setApplication] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const [showApplication, setShowApplication] = useState(false)
  const [notes, setNotes] = useState('')
  const [hiring, setHiring] = useState(false)
  const [testMode, setTestMode] = useState(false)

  const isAdminOrLead = profile?.role === 'admin' || profile?.role === 'lead_troll_officer'

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        toast.error('Invalid session ID')
        navigate('/career')
        return
      }

      try {
        const { data, error } = await supabase
          .from('interview_sessions')
          .select('*')
          .eq('id', sessionId)
          .single()

        if (error) throw error

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username, full_name')
          .eq('id', data.user_id)
          .single()

        const applicantName = profile?.full_name || profile?.username || 'Applicant'
        setSession({ ...data, applicant_name: applicantName })
        setNotes(data.notes || '')

        // Fetch application
        const { data: appData } = await supabase
          .from('applications')
          .select('*')
          .eq('id', data.application_id)
          .single()
        setApplication(appData)

      } catch (error) {
        console.error('Error fetching session:', error)
        toast.error('Failed to load interview session')
        navigate('/career')
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [sessionId, navigate])

  const { token, isLoading: tokenLoading } = useLiveKitToken({
    streamId: sessionId,
    roomName: `interview-${sessionId}`,
    userId: profile?.username || user?.id,
    isHost: isAdminOrLead,
    canPublish: true,
    enabled: !!session && !!user
  })

  // Timer
  useEffect(() => {
    if (session?.status === 'active') {
      const interval = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [session?.status])

  const endCall = async () => {
    if (session) {
      await supabase
        .from('interview_sessions')
        .update({ status: 'completed', notes })
        .eq('id', session.id)
    }
    toast.success('Interview ended')
    navigate('/career')
  }

  const hireCandidate = async () => {
    if (!session || !isAdminOrLead) return

    try {
      setHiring(true)
      
      await supabase
        .from('applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', session.application_id)

      const { data: application } = await supabase
        .from('applications')
        .select('type')
        .eq('id', session.application_id)
        .single()

      if (application) {
        const newRole = application.type === 'troll_officer' ? 'troll_officer' : 
                       application.type === 'lead_officer' ? 'lead_troll_officer' : 
                       application.type === 'pastor' ? 'pastor' : 'troller'

        await supabase
          .from('user_profiles')
          .update({ role: newRole })
          .eq('id', session.user_id)
      }

      await supabase
        .from('interview_sessions')
        .update({ status: 'completed', notes: notes + '\n\n✅ HIRED' })
        .eq('id', session.id)

      toast.success(`${session.applicant_name} has been hired!`)
      navigate('/admin/applications')
    } catch (error) {
      console.error('Error hiring candidate:', error)
      toast.error('Failed to hire candidate')
    } finally {
      setHiring(false)
    }
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading || tokenLoading) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading interview session...</p>
        </div>
      </div>
    )
  }

  if (!session || !token) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Session Error</h1>
          <p className="text-gray-400 mb-4">Could not connect to interview session.</p>
          <button
            onClick={() => navigate('/career')}
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
          >
            Return to Career Page
          </button>
        </div>
      </div>
    )
  }

  const livekitUrl = import.meta.env.VITE_LIVEKIT_URL

  return (
    <div className="min-h-screen bg-[#0A0814] relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/career')}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <XCircle className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Interview Room</h1>
              <p className="text-gray-400 text-sm">{session.applicant_name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-mono">{formatTime(elapsedTime)}</span>
            </div>

            <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              session.status === 'active' ? 'bg-green-500/20 text-green-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {session.status === 'active' ? 'Live Interview' : 'Completed'}
            </div>
          </div>
        </div>
      </div>

      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        data-lk-theme="default"
        className="h-full"
        onConnected={async () => {
          // Update status to active when connected
          await supabase
            .from('interview_sessions')
            .update({ status: 'active' })
            .eq('id', session.id)
          setSession(prev => prev ? { ...prev, status: 'active' } : null)
        }}
      >
        <InterviewContent 
          session={session}
          testMode={testMode}
          isAdminOrLead={isAdminOrLead}
          setTestMode={setTestMode}
          showNotes={showNotes}
          setShowNotes={setShowNotes}
          notes={notes}
          setNotes={setNotes}
          hiring={hiring}
          hireCandidate={hireCandidate}
          onLeave={endCall}
          showApplication={showApplication}
          setShowApplication={setShowApplication}
          application={application}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  )
}
