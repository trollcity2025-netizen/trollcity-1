import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/store";
import { supabase, UserRole } from "../lib/supabase";
import { startCourtSession } from "../lib/courtSessions";
import { toast } from "sonner";
import RequireRole from "../components/RequireRole";
import CourtAIAssistant from "../components/CourtAIAssistant";
import MAIAuthorityPanel from "../components/mai/MAIAuthorityPanel";
import CourtChat from "../components/CourtChat";
import CourtAIController from "../components/CourtAIController";
import UserSearchDropdown from "../components/UserSearchDropdown";
import { Mic, MicOff, Video, VideoOff, User } from "lucide-react";
import { Button } from "../components/ui/button";
import CourtGeminiModal from "../components/CourtGeminiModal";
import CourtDocketModal from "../components/CourtDocketModal";
import GiftBoxModal from "../components/broadcast/GiftBoxModal";
import { generateSummaryFeedback, CourtAgentRole } from "../lib/courtAi";
import { getGlowingTextStyle } from "../lib/perkEffects";

import { Room } from 'livekit-client';


const CourtParticipantLabel = ({ uid, username: initialUsername }: { uid: string, username: string | null }) => {
  const [username, setUsername] = useState<string | null>(initialUsername);
  const [rgbExpiry, setRgbExpiry] = useState<string | null>(null);
  const [glowingColor, setGlowingColor] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!uid) {
        setUsername(initialUsername);
        return;
      }
      const { data, error } = await supabase
        .from('user_profiles')
        .select('username,rgb_username_expires_at,glowing_username_color')
        .eq('id', uid)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setUsername(initialUsername || uid);
        setRgbExpiry(null);
        setGlowingColor(null);
        return;
      }
      setUsername(data?.username || initialUsername || uid);
      setRgbExpiry(data?.rgb_username_expires_at || null);
      setGlowingColor(data?.glowing_username_color || null);
    };
    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [uid, initialUsername]);
  const isRgbActive =
    rgbExpiry !== null && new Date(rgbExpiry) > new Date();
  
  const glowingStyle = (!isRgbActive && glowingColor) ? getGlowingTextStyle(glowingColor) : undefined;

  return (
    <div className="absolute bottom-2 left-2 right-2 flex justify-center pointer-events-none">
      <span
        className={`px-2 py-1 rounded bg-black/60 text-white text-xs ${
          isRgbActive ? 'rgb-username font-bold' : ''
        }`}
        style={glowingStyle}
      >
        {username || 'Participant'}
      </span>
    </div>
  );
};

type CombinedUserTrack = {
  uid: string | number;
  videoTrack?: ILocalVideoTrack | IRemoteVideoTrack;
  audioTrack?: ILocalAudioTrack | IRemoteAudioTrack;
};

const isValidUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

const ParticipantBox = ({ title, colorClass, videoTrack, audioTrack, isLocal, uid, username, onGiftUser, localUserId, toggleCamera, toggleMicrophone }: any) => {
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
      audioTrack.play();
    }
    return () => {
      if (audioTrack && !isLocal) {
        audioTrack.stop();
      }
    };
  }, [audioTrack, isLocal]);

  const isMicOn = audioTrack ? ('enabled' in audioTrack ? audioTrack.enabled : true) : false;
  const isCamOn = videoTrack ? ('enabled' in videoTrack ? videoTrack.enabled : true) : false;

  const targetUid = String(uid || '');
  const canGift = isValidUuid(targetUid) && targetUid !== localUserId;
  return (
    <div
      className={`bg-gray-900 rounded-xl overflow-hidden border ${colorClass} aspect-video relative group ${canGift ? 'cursor-pointer hover:border-yellow-400/70' : ''}`}
      onClick={() => {
        if (canGift && onGiftUser) onGiftUser(targetUid);
      }}
    >
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
      <CourtParticipantLabel uid={uid as string} username={username} />
    </div>
  );
};

const CourtVideoGrid = ({ maxTiles, localTracks, remoteUsers, toggleCamera, toggleMicrophone, localUserId, courtSession, onGiftUser }: {
  maxTiles: number;
  localTracks: [ILocalVideoTrack | undefined, ILocalAudioTrack | undefined];
  remoteUsers: RemoteParticipant[];
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  localUserId: string;
  courtSession: any; // TODO: Define proper type for courtSession
  onGiftUser?: (userId: string) => void;
}) => {
  const localVideoTrack = localTracks[0];
  const localAudioTrack = localTracks[1];

  // Logic to determine who is judge, defendant, etc.
  const judgeUser: CombinedUserTrack | undefined = remoteUsers.find(user => user.uid === courtSession?.judge_id) ||
                   (localUserId === courtSession?.judge_id ? { uid: localUserId, videoTrack: localVideoTrack, audioTrack: localAudioTrack } : undefined);
  
  const defendantUser: CombinedUserTrack | undefined = remoteUsers.find(user => user.uid === courtSession?.defendant_id) ||
                        (localUserId === courtSession?.defendant_id ? { uid: localUserId, videoTrack: localVideoTrack, audioTrack: localAudioTrack } : undefined);

  const participantUsers: CombinedUserTrack[] = remoteUsers.filter(user =>
    user.uid !== courtSession?.judge_id &&
    user.uid !== courtSession?.defendant_id
  );

  if (localUserId !== courtSession?.judge_id && localUserId !== courtSession?.defendant_id) {
    participantUsers.unshift({ uid: localUserId, videoTrack: localVideoTrack, audioTrack: localAudioTrack });
  }

  const getCols = () => {
    const totalParticipants = (judgeUser ? 1 : 0) + (defendantUser ? 1 : 0) + participantUsers.length;
    const cols = Math.max(2, Math.min(totalParticipants, maxTiles || 2));
    if (cols <= 2) return 2;
    if (cols <= 3) return 3;
    return Math.min(cols, 4);
  };

  const participantsToRender = [];
  if (judgeUser) {
    participantsToRender.push({
      title: 'Judge',
      colorClass: 'border-yellow-500',
      user: judgeUser,
      username: courtSession?.judge_username || 'Judge'
    });
  }
  if (defendantUser) {
    participantsToRender.push({
      title: 'Defendant',
      colorClass: 'border-red-500',
      user: defendantUser,
      username: courtSession?.defendant_username || 'Defendant'
    });
  }
  participantUsers.forEach((user, index) => {
    participantsToRender.push({
      title: `Participant ${index + 1}`,
      colorClass: 'border-gray-500',
      user: user,
      username: user.uid === localUserId ? 'You' : `Participant ${index + 1}` // TODO: Fetch actual username
    });
  });

  return (
    <div
      className="w-full h-[60vh] gap-2 p-2"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${getCols()}, minmax(0, 1fr))`
      }}
    >
      {participantsToRender.slice(0, maxTiles).map((p) => (
        <div key={p.user.uid} className="tc-neon-frame relative">
          <ParticipantBox
            title={p.title}
            colorClass={p.colorClass}
            videoTrack={p.user.videoTrack}
            audioTrack={p.user.audioTrack}
            isLocal={p.user.uid === localUserId}
            uid={p.user.uid}
            username={p.username}
            onGiftUser={onGiftUser}
            localUserId={localUserId}
            toggleCamera={toggleCamera}
            toggleMicrophone={toggleMicrophone}
          />
        </div>
      ))}
      {Array.from({ length: Math.max(0, maxTiles - participantsToRender.length) }).map((_, i) => (
        <div 
          key={`ph-${i}`}
          className="tc-neon-frame flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <div className="text-gray-400 text-sm">Waiting for participant…</div>
        </div>
      ))}
    </div>
  );
}

function uidFromString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const getLiveKitToken = async (room: string, identity: string) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL for LiveKit token endpoint');
  }
  const tokenUrl = `${supabaseUrl}/functions/v1/livekit-token`;

  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;
  if (!accessToken) throw new Error('No active session');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      channel: room, // Changed from 'room' to 'channel'
      identity: identity,
      role: 'host',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Token request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.token) {
    throw new Error('Invalid LiveKit token response');
  }
  return data.token;
};

export default function CourtRoom() {
   const { user, profile } = useAuthStore();
   const { courtId } = useParams();
   const navigate = useNavigate();
   const [courtSession, setCourtSession] = useState<any>(null);
   const [boxCount, setBoxCount] = useState(2);
   const [joinBoxRequested, setJoinBoxRequested] = useState(false);
   const [joinBoxLoading, setJoinBoxLoading] = useState(false);
   const [livekitClient, setLivekitClient] = useState<Room | null>(null);
   const [localTracks, setLocalTracks] = useState<[ILocalVideoTrack | undefined, ILocalAudioTrack | undefined]>([undefined, undefined]);
   const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);
   const [activeCase, setActiveCase] = useState<any>(null);
   const [courtState, setCourtState] = useState<any>(null);
   const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
   const [showDocketModal, setShowDocketModal] = useState(false);
   const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
   const [giftOpen, setGiftOpen] = useState(false);
   const [isSubmittingSummary, setIsSubmittingSummary] = useState(false);
   const [summaries, setSummaries] = useState<any[]>([]);
   const [showNewCaseModal, setShowNewCaseModal] = useState(false);
   const [evidence, setEvidence] = useState<any[]>([]);
   const [verdict, setVerdict] = useState<any>(null);

  const isJudge = user?.id === courtSession?.judge_id;
  const isOfficer = profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.is_admin;


  // Duration Limit (1 hour)
  useEffect(() => {
    if (courtSession?.created_at) {
        const checkDuration = () => {
            const startedAt = new Date(courtSession.created_at).getTime();
            const duration = Date.now() - startedAt;
            if (duration > 3600000) { // 1 hour
                 // Only show toast once or periodically?
                 // Since this runs every minute, it will toast every minute after 1 hour.
                 // That's acceptable for now to annoy them into ending.
                 if (isJudge) toast.error('Court session time limit (1 hour) reached.');
                 else toast.warning('This court session has exceeded the 1-hour limit.');
            }
        };
        checkDuration(); 
        const interval = setInterval(checkDuration, 60000);
        return () => clearInterval(interval);
    }
  }, [courtSession, isJudge]);

  // Get the effective role for display (prioritize is_admin flag)
  const getEffectiveRole = () => {
    if (profile?.is_admin) return 'admin';
    if (profile?.role === 'admin') return 'admin';
    if (profile?.is_lead_officer) return 'lead_troll_officer';
    if (profile?.role === 'troll_officer') return 'troll_officer';
    return profile?.role || 'user';
  };




  // HARDENED - Multi-step loading and Realtime listeners for court state
  useEffect(() => {
    if (!courtId || !isValidUuid(courtId)) return;

    // 1. Fetch the session, then the case, then the state
    const fetchFullCourtState = async () => {
      // Step 1: Get the court session
      const { data: sessionData, error: sessionError } = await supabase
        .from('court_sessions')
        .select('*')
        .eq('id', courtId)
        .maybeSingle();

      if (sessionError || !sessionData) {
        toast.error("Court session not found or an error occurred.");
        console.error("Error fetching court session:", sessionError?.message);
        navigate('/troll-court');
        return;
      }
      setCourtSession(sessionData);

      if (sessionData.status && !['active', 'live', 'waiting'].includes(sessionData.status)) {
        toast.info('This court session has concluded.');
        navigate('/troll-court');
        return;
      }
      
      const caseId = sessionData.case_id;
      if (!caseId || !isValidUuid(caseId)) {
          toast.error("Invalid case ID associated with this session.");
          navigate('/troll-court');
          return;
      }

      // Step 2: Get the court case
      const { data: caseData, error: caseError } = await supabase
        .from('court_cases')
        .select('*')
        .eq('id', caseId)
        .single(); // A session MUST have a case.

      if (caseError || !caseData) {
        toast.error("Could not load the associated court case.");
        console.error("Error fetching court case:", caseError?.message);
        navigate('/troll-court');
        return;
      }
      setActiveCase(caseData);

      // Step 3: Get the court session state
      const { data: stateData, error: stateError } = await supabase
        .from('court_session_state')
        .select('*')
        .eq('case_id', caseId)
        .maybeSingle(); // Use maybeSingle due to potential (but unlikely) race conditions

      if (stateError || !stateData) {
        // This should be rare now due to the auto-create trigger
        toast.warning("Could not load court session state. The system will attempt to recover.");
        console.error("Error fetching court session state:", stateError?.message);
        // We don't navigate away here, as the trigger should fix this.
      }
      setCourtState(stateData);
      setBoxCount(Math.min(4, Math.max(2, sessionData.max_boxes || 2)));
    };
    
    fetchFullCourtState();

    // REALTIME LISTENERS
    const sessionChannel = supabase
      .channel(`court_session_updates_${courtId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'court_sessions', filter: `id=eq.${courtId}` },
        (payload) => {
          if (!payload || !payload.new) return; // Guard against null payload
          const newData = payload.new as any;
          
          if (newData.status && !['active', 'live', 'waiting'].includes(newData.status)) {
            toast.info('Court session ended');
            navigate('/troll-court');
            return;
          }
          
          if (typeof newData.max_boxes === 'number') {
            const newBoxCount = Math.min(4, Math.max(2, newData.max_boxes));
            setBoxCount(prev => prev !== newBoxCount ? newBoxCount : prev);
          }
        }
      ).subscribe();
      
    const stateChannel = supabase
      .channel(`court_state_updates_${courtId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'court_session_state', filter: `case_id=eq.${(courtSession as any)?.case_id}` },
        (payload) => {
            if (!payload || !payload.new) return; // Guard against null payload
            console.log("Received court_session_state update:", payload.new);
            setCourtState(payload.new);
        }
      ).subscribe();


    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(stateChannel);
    };
  }, [courtId, navigate, user]);

  useEffect(() => {
    console.log('[CourtRoom] Component mounted with courtId:', courtId);
    return () => {
      console.log('[CourtRoom] Component unmounting');
    };
  }, [courtId]);

  const effectiveRole = getEffectiveRole();

  const toggleCamera = () => {
    if (localTracks[0]) {
      localTracks[0].setEnabled(!localTracks[0].enabled);
    }
  };

  const toggleMicrophone = () => {
    if (localTracks[1]) {
      localTracks[1].setEnabled(!localTracks[1].enabled);
    }
  };

  const handleJoinBox = async () => {
    setJoinBoxLoading(true);
    try {
      if (!livekitClient || !user || !courtId) {
        throw new Error('LiveKit client, user, or courtId not available.');
      }

      // Check if already publishing
      if (localTracks[0] && localTracks[1]) {
        toast.info('You are already publishing your video and audio.');
        setJoinBoxLoading(false);
        return;
      }

      // If already joined as viewer, leave first
      if (livekitClient.connectionState === 'CONNECTED') {
        await livekitRoom.disconnect();
      }

      const token = await getLiveKitToken(courtId, user.id);
      await livekitRoom.connect(import.meta.env.VITE_LIVEKIT_APP_ID!, courtId, token, user.id);
      const audioTrack = await  LocalAudioTrack.create();
      const videoTrack = await  LocalVideoTrack.create();
      setLocalTracks([videoTrack, audioTrack]);
      await livekitClient.publish([videoTrack, audioTrack]);
      setJoinBoxRequested(true);
      toast.success('Successfully joined the box and started publishing!');
    } catch (error: any) {
      console.error('Failed to join box and publish:', error);
      toast.error(`Failed to join box: ${error.message || 'Unknown error'}`);
    } finally {
      setJoinBoxLoading(false);
    }
  };

  const handleLeaveBox = async () => {
    try {
      if (!livekitClient) {
        throw new Error('LiveKit client not available.');
      }
      if (localTracks[0]) {
        await localTracks[0].close();
        await localTracks[0].stop();
      }
      if (localTracks[1]) {
        await localTracks[1].close();
        await localTracks[1].stop();
      }
      setLocalTracks([undefined, undefined]);
      await livekitClient.unpublish();
      await livekitRoom.disconnect();
      setJoinBoxRequested(false);
      toast.info('You have left the box and stopped publishing.');
      // Rejoin as viewer if needed, or simply leave the channel
      if (courtId && user) {
        await livekitRoom.connect(import.meta.env.VITE_LIVEKIT_APP_ID!, courtId, null, user.id);
      }
    } catch (error: any) {
      console.error('Failed to leave box and unpublish:', error);
      toast.error(`Failed to leave box: ${error.message || 'Unknown error'}`);
    }
  };




  const toggleGeminiModal = () => setIsGeminiModalOpen(!isGeminiModalOpen);
  const toggleDocketModal = () => setShowDocketModal(!showDocketModal);

  const localUserId = user?.id || '';

  const localUserIsJudge = localUserId === courtSession?.judge_id;

  // Placeholder for sending messages - replace with actual chat integration
  const sendMessage = (message: string) => {
    console.log("Sending message:", message);
    // Logic to send message via WebSocket or other means
  };


  const [summaryFeedbackState, setSummaryFeedbackState] = useState<{ summaryId: string; feedback: string } | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const handleGenerateSummaryFeedback = async (summaryId: string, summaryContent: string) => {
    if (!summaryId || !summaryContent) return;
    setIsSubmittingFeedback(true);
    try {
      await generateSummaryFeedback(summaryFeedbackState.summaryId, user?.id || '', effectiveRole as CourtAgentRole, summaryFeedbackState.feedback);
      toast.success("Feedback generated successfully!");
      // Note: The feedback is saved to the database by the function itself
      // We could fetch updated summaries here if needed
    } catch (error) {
      console.error("Error generating feedback:", error);
      toast.error("Error generating feedback.");
    } finally {
      setIsSubmittingFeedback(false);
      setSummaryFeedbackState(null); // Close feedback modal/state
    }
  };

  const handleSummarizeCourt = async () => {
    setIsSubmittingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-court', {
        body: JSON.stringify({ courtId: courtId }),
      });
      if (error) throw error;
      if (data && data.summary) {
        setSummaries(prev => [...prev, { id: data.summaryId, content: data.summary, created_at: new Date().toISOString() }]);
        toast.success("Court summarized successfully!");
      } else {
        toast.error("Failed to summarize court.");
      }
    } catch (error) {
      console.error("Error summarizing court:", error);
      toast.error("Error summarizing court.");
    } finally {
      setIsSubmittingSummary(false);
    }
  };
  
  return (
    <RequireRole roles={[UserRole.ADMIN, UserRole.LEAD_TROLL_OFFICER, UserRole.TROLL_OFFICER, UserRole.USER]} fallbackPath="/access-denied">
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <h1 className="text-3xl font-bold text-center mb-6 tc-neon-text">
          Courtroom {courtId}
        </h1>

        {courtSession && (
          <div className="mb-6 bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Session Details</h2>
            <p><strong>Status:</strong> {courtSession.status}</p>
            {courtSession.court_cases && courtSession.court_cases[0] && (
              <div className="mt-4">
                <h3 className="text-lg font-medium">Active Case: {courtSession.court_cases[0].title}</h3>
                <p><strong>Defendant:</strong> {courtSession.defendant_username || 'N/A'}</p>
                <p><strong>Judge:</strong> {courtSession.judge_username || 'N/A'}</p>
                <p><strong>Phase:</strong> {courtState?.phase || 'waiting'}</p>
                {activeCase?.description && <p><strong>Description:</strong> {activeCase.description}</p>}
                {verdict && <p><strong>Verdict:</strong> {verdict}</p>}
              </div>
            )}
          </div>
        )}

        <CourtVideoGrid
          maxTiles={boxCount}
          localTracks={localTracks}
          remoteUsers={remoteUsers}
          toggleCamera={toggleCamera}
          toggleMicrophone={toggleMicrophone}
          localUserId={user?.id || ''}
          courtSession={courtSession}
          onGiftUser={(targetUserId) => {
            if (!user) {
              navigate('/auth?mode=signup');
              return;
            }
            if (targetUserId === user.id) {
              toast.error('You cannot gift yourself');
              return;
            }
            setGiftRecipientId(targetUserId);
            setGiftOpen(true);
          }}
        />

        <div className="flex justify-center gap-4 mt-4">
          <Button onClick={handleJoinBox} disabled={joinBoxLoading || joinBoxRequested}>
            {joinBoxLoading ? 'Joining...' : 'Join Box'}
          </Button>
          <Button onClick={handleLeaveBox} disabled={!joinBoxRequested} variant="destructive">
            Leave Box
          </Button>
          {localUserIsJudge && (
            <Button onClick={() => setShowNewCaseModal(true)}>Start New Case</Button>
          )}
          <Button onClick={() => setShowDocketModal(true)}>View Docket</Button>
          <Button onClick={() => setIsGeminiModalOpen(true)}>AI Assistant</Button>
        </div>

        {/* Modals and other components */}
        <CourtGeminiModal
          isOpen={isGeminiModalOpen}
          onClose={() => setIsGeminiModalOpen(false)}
          courtId={courtId}
          isAuthorized={isJudge || isOfficer}
        />
        <CourtDocketModal
          isOpen={showDocketModal}
          onClose={() => setShowDocketModal(false)}
          courtId={courtId}
          isJudge={isJudge}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <CourtChat courtId={courtId} isLocked={!isJudge} />
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Court Controls & Info</h2>
            <CourtAIController
              caseId={courtId}
              caseDetails={activeCase}
              isJudge={isJudge}
              evidence={evidence}
            />

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Summaries</h3>
              <Button onClick={handleSummarizeCourt} disabled={isSubmittingSummary}>
                {isSubmittingSummary ? 'Summarizing...' : 'Summarize Court'}
              </Button>
              {summaries.length > 0 && (
                <div className="mt-4 space-y-2">
                  {summaries.map((s) => (
                    <div key={s.id} className="bg-gray-700 p-3 rounded text-sm">
                      <p className="font-semibold">Summary ({new Date(s.created_at).toLocaleString()}):</p>
                      <p>{s.content}</p>
                      {s.feedback && (
                        <div className="mt-2 text-xs text-gray-400">
                          <strong>AI Feedback:</strong> {s.feedback}
                        </div>
                      )}
                      {isJudge && !s.feedback && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setSummaryFeedbackState({ summaryId: s.id, feedback: s.content })}
                          disabled={isSubmittingFeedback}
                        >
                          Generate Feedback
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {summaryFeedbackState && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-1/2">
              <h2 className="text-xl font-semibold mb-4">Generate Feedback for Summary</h2>
              <p className="mb-4">Are you sure you want to generate AI feedback for this summary?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setSummaryFeedbackState(null)} disabled={isSubmittingFeedback}>
                  Cancel
                </Button>
                <Button onClick={() => handleGenerateSummaryFeedback(summaryFeedbackState.summaryId, summaryFeedbackState.feedback)} disabled={isSubmittingFeedback}>
                  {isSubmittingFeedback ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <GiftBoxModal
          isOpen={giftOpen}
          onClose={() => {
            setGiftOpen(false);
            setGiftRecipientId(null);
          }}
          recipientId={giftRecipientId || ''}
          streamId=""
        />

      </div>
    </RequireRole>
  );
}
