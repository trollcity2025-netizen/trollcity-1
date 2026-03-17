import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useLiveKitRoom } from '../hooks/useRoom'
import { Room, LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack, Track } from 'livekit-client'
import { Button } from '../components/ui/button'
import { toast } from 'sonner'
import { User, DollarSign, CheckCircle, XCircle, Trash2, Mic, MicOff, Video, VideoOff } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'

const ParticipantBox = ({
  title,
  colorClass,
  videoTrack,
  audioTrack,
  isLocal,
  username,
  toggleCamera,
  toggleMicrophone,
}) => {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current && videoTrack) {
      videoTrack.play(videoRef.current);
    }
    return () => {
      if (videoTrack) {
        videoTrack.stop();
      }
    };
  }, [videoTrack]);

  useEffect(() => {
    if (audioTrack && !isLocal) {
      // Remote audio tracks need to be played explicitly
      audioTrack.play();
    }
    return () => {
      if (audioTrack && !isLocal) {
        audioTrack.stop();
      }
    };
  }, [audioTrack, isLocal]);

  const isMicOn = audioTrack && !audioTrack.muted;
  const isCamOn = videoTrack && !videoTrack.muted;

  return (
    <div className={`bg-gray-900 rounded-xl overflow-hidden border ${colorClass} aspect-video relative group`}>
      <div className={`absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 backdrop-blur-sm ${colorClass.replace('border-', 'text-')}`}>
        {title}
        <div className="flex gap-1 ml-2">
           {isMicOn ? <Mic size={14} className="text-green-400" /> : <MicOff size={14} className="text-red-400" />}
        </div>
      </div>
      
      {videoTrack ? (
        <div ref={videoRef} className="w-full h-full object-cover"></div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-500 flex-col gap-2">
          <User size={48} />
          <p>Waiting for {username}...</p>
        </div>
      )}

      {/* Local Controls Overlay */}
      {isLocal && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-2 rounded-full backdrop-blur-sm">
           <Button 
             size="icon" 
             variant={isMicOn ? "ghost" : "destructive"} 
             className="h-10 w-10 rounded-full"
             onClick={toggleMicrophone}
           >
             {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
           </Button>
           <Button 
             size="icon" 
             variant={isCamOn ? "ghost" : "destructive"} 
             className="h-10 w-10 rounded-full"
             onClick={toggleCamera}
           >
             {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
           </Button>
        </div>
      )}
    </div>
  );
};

  type Interview = {
  id: string
  applicant_id: string
  application_id?: string
  interviewer_id: string | null
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'hired' | 'declined'
  room_id: string
  applicant?: {
    username: string
    avatar_url: string
  }
}

interface InterviewGridProps {
  interview: Interview;
  isAdmin: boolean;
  localTracks: [LocalVideoTrack | undefined, LocalAudioTrack | undefined];
  remoteUsers: RemoteParticipant[];
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  localUserId: string;
  applicantId: string;
}

// Helper function to get video track from RemoteParticipant
const getRemoteVideoTrack = (participant: RemoteParticipant): RemoteVideoTrack | undefined => {
  const publication = participant.getTrackPublication(Track.Source.Camera);
  return publication?.track as RemoteVideoTrack | undefined;
};

// Helper function to get audio track from RemoteParticipant
const getRemoteAudioTrack = (participant: RemoteParticipant): RemoteAudioTrack | undefined => {
  const publication = participant.getTrackPublication(Track.Source.Microphone);
  return publication?.track as RemoteAudioTrack | undefined;
};

// Inner component to render the interview grid
function InterviewGrid({ 
  interview, 
  isAdmin: _isAdmin,
  localTracks,
  remoteUsers,
  toggleCamera,
  toggleMicrophone,
  localUserId,
  applicantId
}: InterviewGridProps) {
  const localVideoTrack = localTracks[0];
  const localAudioTrack = localTracks[1];

  // Find participants
  const isLocalUserApplicant = localUserId === applicantId;
  const applicantRemoteUser = remoteUsers.find(user => user.identity === applicantId);
  const interviewerRemoteUser = remoteUsers.find(user => user.identity !== applicantId && user.identity !== localUserId);

  const applicantDisplay = isLocalUserApplicant
    ? { user: { username: interview.applicant?.username || 'Applicant' }, videoTrack: localVideoTrack, audioTrack: localAudioTrack, isLocal: true }
    : (applicantRemoteUser ? { user: { username: interview.applicant?.username || 'Applicant' }, videoTrack: getRemoteVideoTrack(applicantRemoteUser), audioTrack: getRemoteAudioTrack(applicantRemoteUser), isLocal: false } : undefined);

  const interviewerDisplay = !isLocalUserApplicant
    ? { user: { username: interview.interviewer_id || 'Interviewer' }, videoTrack: localVideoTrack, audioTrack: localAudioTrack, isLocal: true }
    : (interviewerRemoteUser ? { user: { username: 'Interviewer' }, videoTrack: getRemoteVideoTrack(interviewerRemoteUser), audioTrack: getRemoteAudioTrack(interviewerRemoteUser), isLocal: false } : undefined);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl flex-1">
      {interviewerDisplay && <ParticipantBox
        title="Interviewer (Admin/Lead)"
        colorClass="border-purple-800"
        videoTrack={interviewerDisplay.videoTrack}
        audioTrack={interviewerDisplay.audioTrack}
        isLocal={interviewerDisplay.isLocal}
        username={interviewerDisplay.user.username}
        toggleCamera={toggleCamera}
        toggleMicrophone={toggleMicrophone}
      />}
      {applicantDisplay && <ParticipantBox
        title="Applicant"
        colorClass="border-blue-800"
        videoTrack={applicantDisplay.videoTrack}
        audioTrack={applicantDisplay.audioTrack}
        isLocal={applicantDisplay.isLocal}
        username={applicantDisplay.user.username}
        toggleCamera={toggleCamera}
        toggleMicrophone={toggleMicrophone}
      />}
    </div>
  );
}

export default function InterviewRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)
  const [roomUrl, setRoomUrl] = useState<string>('')
  const [roomToken, setRoomToken] = useState<string>('')
  const { localTracks, remoteUsers, toggleCamera, toggleMicrophone, isConnected } = useLiveKitRoom({ url: roomUrl, token: roomToken })
  const [connection, setConnection] = useState<string>("")
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Hire Modal State
  const [showHireModal, setShowHireModal] = useState(false)
  const [hrRate, setHrRate] = useState('15')
  const [workerRole, setWorkerRole] = useState('troll_officer')
  const [hiring, setHiring] = useState(false)

  useEffect(() => {
    if (!profile || !roomId) return

    const checkAccess = async () => {
      try {
        const { data, error } = await supabase
          .from('interviews')
          .select(`
            *,
            applicant:user_profiles!applicant_id(username, avatar_url)
          `)
          .eq('room_id', roomId)
              .maybeSingle()

        if (error || !data) {
          console.error('Error fetching interview data', error)
          toast.error('Could not fetch interview data.')
          navigate('/')
          return
        }

        setInterview(data)

        const isInterviewer = profile.role === 'admin' || profile.is_lead_officer || profile.role === 'secretary'
        const isApplicant = data.applicant_id === profile.id

        setIsAdmin(isInterviewer)

        // Get Connection Details
        const { data: connectionData, error: connectionError } = await supabase.functions.invoke('livekit-token', {
          body: {
            channel: roomId,
            uid: profile.id,
            role: (isInterviewer || isApplicant) ? 'publisher' : 'audience'
          }
        })

        if (connectionError || !connectionData?.token) {
          console.error("Connection error:", connectionError)
          toast.error("Failed to connect to video server")
          return
        }

        setConnection(connectionData.token)
        // Set URL and token for the hook - it will auto-connect
        const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || `wss://${window.location.host}/live`;
        setRoomUrl(`${livekitUrl}/${roomId}`);
        setRoomToken(connectionData.token);

        // If pending and admin joins, update status to active
        if (isInterviewer && data.status === 'pending') {
          await supabase
            .from('interviews')
            .update({ status: 'active', interviewer_id: profile.id })
            .eq('id', data.id)
        }

      } catch (error) {
        console.error('Error joining interview:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [roomId, profile, navigate, roomUrl, roomToken])

  // Real-time status updates
  useEffect(() => {
    if (!interview?.id) return

    const channel = supabase
      .channel(`interview-${interview.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviews',
          filter: `id=eq.${interview.id}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
             toast.info("Interview is over")
             navigate('/')
          } else if (payload.eventType === 'UPDATE') {
             const newStatus = payload.new.status
             const isApplicant = profile?.id === interview.applicant_id

             if (isApplicant) {
                 if (newStatus === 'hired') {
                     toast.success("Congrats!")
                     navigate('/')
                 } else if (newStatus === 'declined') {
                     toast.error("Please think about what you can do and reapply. Must wait 7 days to reapply.")
                     navigate('/')
                 }
             }

             if (newStatus === 'cancelled') {
                 toast.info("Interview is over")
                 navigate('/')
             }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [interview?.id, interview?.applicant_id, profile?.id, navigate])

  const handleHire = async () => {
    if (!interview) return
    setHiring(true)
    try {
      // 1. Update user profile with rate and role
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          hourly_rate: parseFloat(hrRate),
          role: workerRole, 
          is_troll_officer: workerRole === 'troll_officer',
          is_officer_active: true
        })
        .eq('id', interview.applicant_id)

      if (profileError) throw profileError

      // 2. Update interview status
      await supabase
        .from('interviews')
        .update({ status: 'hired' })
        .eq('id', interview.id)

      // 3. Update application status
      if (interview.application_id) {
          await supabase
            .from('applications')
            .update({ status: 'hired' })
            .eq('id', interview.application_id)
      }
        
      toast.success('Worker hired successfully!')
      setShowHireModal(false)
      navigate('/lead-officer')
    } catch (error: any) {
      console.error('Error hiring:', error)
      toast.error('Failed to hire worker')
    } finally {
      setHiring(false)
    }
  }

  const handleDecline = async () => {
    if (!confirm('Are you sure you want to decline this applicant?')) return
    try {
      await supabase
        .from('interviews')
        .update({ status: 'declined' })
        .eq('id', interview!.id)
      
      // Update application status to rejected
      if (interview!.application_id) {
          await supabase
            .from('applications')
            .update({ 
              status: 'rejected',
              updated_at: new Date().toISOString()
            })
            .eq('id', interview!.application_id)
      }
        
      toast.success('Applicant declined')
      navigate('/lead-officer')
    } catch {
      toast.error('Failed to decline')
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel and delete this interview?')) return
    try {
      await supabase
        .from('interviews')
        .delete()
        .eq('id', interview!.id)
        
      toast.success('Interview cancelled')
      navigate('/lead-officer')
    } catch {
      toast.error('Failed to cancel')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-white">Loading Interview Room...</div>

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-6xl mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-purple-400">Interview Room</h1>
          <p className="text-gray-400">Applicant: {interview?.applicant?.username}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
             <Button variant="destructive" onClick={handleCancel} className="gap-2">
              <Trash2 size={16} /> Cancel Interview
            </Button>
            <Button variant="outline" onClick={handleDecline} className="border-red-500 text-red-500 hover:bg-red-900/20 gap-2">
              <XCircle size={16} /> Decline
            </Button>
            <Button onClick={() => setShowHireModal(true)} className="bg-green-600 hover:bg-green-700 gap-2">
              <CheckCircle size={16} /> Hire Worker
            </Button>
          </div>
        )}
      </div>

      {connection && (
        <div className="flex-1 w-full flex flex-col items-center">
           <InterviewGrid 
    interview={interview!} 
    isAdmin={isAdmin} 
    localTracks={localTracks} 
    remoteUsers={remoteUsers}
    toggleCamera={toggleCamera} 
    toggleMicrophone={toggleMicrophone}
    localUserId={profile.id}
    applicantId={interview?.applicant_id}
/>
        </div>
      )}

      {/* Hire Modal */}
      <Dialog open={showHireModal} onOpenChange={setShowHireModal}>
        <DialogContent className="bg-[#1A1A2E] border-purple-800 text-white">
          <DialogHeader>
            <DialogTitle>Hire {interview?.applicant?.username}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Hourly Rate ($/hr)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  value={hrRate}
                  disabled={hiring}
                  onChange={(e) => setHrRate(e.target.value)}
                  className="pl-10 bg-black/40 border-purple-800 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={workerRole} onValueChange={setWorkerRole}>
                <SelectTrigger className="bg-black/40 border-purple-800 text-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0D1A] border-purple-800 text-white">
                  <SelectItem value="troll_officer">Troll Officer</SelectItem>
                  <SelectItem value="lead_troll_officer">Lead Troll Officer</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowHireModal(false)}>Cancel</Button>
            <Button onClick={handleHire} disabled={hiring} className="bg-green-600 hover:bg-green-700">
              {hiring ? 'Hiring...' : 'Confirm Hire'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
