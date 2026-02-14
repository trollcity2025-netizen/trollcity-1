import React, { useEffect, useState, useMemo, memo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/store";
import { supabase, UserRole } from "../lib/supabase";
import { startCourtSession } from "../lib/courtSessions";
import { LiveKitRoom, ParticipantTile, useTracks, useParticipants } from "@livekit/components-react";
import "@livekit/components-styles";
import { toast } from "sonner";
import RequireRole from "../components/RequireRole";
import CourtAIAssistant from "../components/CourtAIAssistant";
import MAIAuthorityPanel from "../components/mai/MAIAuthorityPanel";
import CourtChat from "../components/CourtChat";
import CourtAIController from "../components/CourtAIController";
import UserSearchDropdown from "../components/UserSearchDropdown";
import { Scale, Gavel, FileText, Users, CheckCircle, Upload, Bell, Sparkles } from "lucide-react";
import { Track } from "livekit-client";
import CourtGeminiModal from "../components/CourtGeminiModal";
import CourtDocketModal from "../components/CourtDocketModal";
import { generateSummaryFeedback } from "../lib/courtAi";
import { getGlowingTextStyle } from "../lib/perkEffects";
// import { generateUUID } from "../lib/uuid";

const CourtParticipantLabel = ({ trackRef }: { trackRef: any }) => {
  const [username, setUsername] = useState<string | null>(null);
  const [rgbExpiry, setRgbExpiry] = useState<string | null>(null);
  const [glowingColor, setGlowingColor] = useState<string | null>(null);
  const identity = trackRef?.participant?.identity || null;
  const name = trackRef?.participant?.name || null;
  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!identity) {
        setUsername(name || null);
        return;
      }
      const { data, error } = await supabase
        .from('user_profiles')
        .select('username,rgb_username_expires_at,glowing_username_color')
        .eq('id', identity)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setUsername(name || identity);
        setRgbExpiry(null);
        setGlowingColor(null);
        return;
      }
      setUsername(data?.username || name || identity);
      setRgbExpiry(data?.rgb_username_expires_at || null);
      setGlowingColor(data?.glowing_username_color || null);
    };
    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [identity, name]);
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
        {username || identity || 'Participant'}
      </span>
    </div>
  );
};

// Memoized Court Video Grid - Prevents remounting and flickering
const CourtVideoGrid = memo(({ maxTiles }: { maxTiles: number }) => {
  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: true }
  );

  const visible = useMemo(() => 
    (tracks || []).slice(0, Math.max(2, maxTiles || 2)),
    [tracks, maxTiles]
  );

  const placeholders = Math.max(2, maxTiles || 2) - visible.length;

  const getCols = () => {
    const cols = Math.max(2, maxTiles || 2);
    if (cols <= 2) return 2;
    if (cols <= 3) return 3;
    return Math.min(cols, 4);
  };

  return (
    <div
      className="w-full h-[60vh] gap-2 p-2"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${getCols()}, minmax(0, 1fr))`
      }}
    >
      {visible.map((t, index) => {
        const participantSid = t.participant?.sid || `participant-${index}`;
        const stableKey = `${participantSid}-${index}`;
        
        return (
          <div
            key={stableKey}
            className="tc-neon-frame relative"
          >
            <ParticipantTile trackRef={t} />
            <CourtParticipantLabel trackRef={t} />
          </div>
        );
      })}
      {Array.from({ length: placeholders }).map((_, i) => (
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
});

CourtVideoGrid.displayName = 'CourtVideoGrid';

// Memoized Track Counter
const CourtTrackCounter = memo(({ onCount }: { onCount: (count: number) => void }) => {
  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: true }
  );

  const activeCount = useMemo(() => {
    const identities = new Set(
      (tracks || []).map((t) => t.participant?.sid || t.participant?.identity)
    );
    return identities.size;
  }, [tracks]);

  useEffect(() => {
    onCount(activeCount);
  }, [activeCount, onCount]);

  return null;
});

CourtTrackCounter.displayName = 'CourtTrackCounter';
  
  const CourtLimitEnforcer = ({ isJudge, isOfficer }: { isJudge: boolean, isOfficer: boolean }) => {
    const participants = useParticipants();
    const navigate = useNavigate();
    
    useEffect(() => {
       if (isJudge || isOfficer) return;

       // Filter for viewers (those who cannot publish)
       const viewers = participants.filter(p => !p.permissions?.canPublish);
       
       // Sort by join time to identify who exceeded the limit
       // We use a fallback to creationTime or just assume order if joinedAt is missing (though it shouldn't be)
       const sortedViewers = [...viewers].sort((a, b) => {
          const timeA = a.joinedAt?.getTime() || 0;
          const timeB = b.joinedAt?.getTime() || 0;
          return timeA - timeB;
       });

       const myIndex = sortedViewers.findIndex(p => p.isLocal);
       
       // If I am a viewer and I am the 11th or later (index 10+), I must leave
       if (myIndex !== -1 && myIndex >= 10) {
          toast.error('Viewer limit (10) reached.');
          navigate('/troll-court');
       }
    }, [participants, isJudge, isOfficer, navigate]);
    
    return null;
  };
  
  const isValidUuid = (value?: string | null) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value || ''
  );

export default function CourtRoom() {
   const { user, profile } = useAuthStore();
   const { courtId } = useParams();
   const navigate = useNavigate();
   const [token, setToken] = useState(null);
   const [serverUrl, setServerUrl] = useState(null);
   const [loading, setLoading] = useState(true);
   const [_participantsAllowed, _setParticipantsAllowed] = useState([]);
   const [courtSession, setCourtSession] = useState(null);
   const [boxCount, setBoxCount] = useState(2);
   const [joinBoxRequested, setJoinBoxRequested] = useState(false);
   const [joinBoxLoading, setJoinBoxLoading] = useState(false);
   const [activeBoxCount, setActiveBoxCount] = useState(0);

  // Stabilize room ID once at mount
  const roomIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (courtId && !roomIdRef.current) {
      roomIdRef.current = courtId;
      console.log('[CourtRoom] Room ID stabilized:', courtId);
    }
  }, [courtId]);
  
  // Court functionality state
  const [activeCase, setActiveCase] = useState(null);
  const [courtPhase, setCourtPhase] = useState('waiting'); // waiting, opening, evidence, deliberation, verdict
  const [evidence, setEvidence] = useState([]);
  const [defendant, setDefendant] = useState(null);
  const [judge, setJudge] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [showEvidencePanel, setShowEvidencePanel] = useState(false);
  const [showJudgeControls, setShowJudgeControls] = useState(false);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [newCaseData, setNewCaseData] = useState({
    title: '',
    defendant: '',
    accuser: '',
    description: '',
    severity: 'Low'
  });
  const [judgeControls, setJudgeControls] = useState({
    autoLockChat: false,
    requireLeadApproval: false,
    forceCaseRecord: false
  });
  const [showVerdictModal, setShowVerdictModal] = useState(false);
  const [verdictData, setVerdictData] = useState({
    verdict: 'not_guilty',
    penalty: '',
    reasoning: ''
  });
  const [availableJudges, setAvailableJudges] = useState<Array<{
    id: string
    username: string
    role: string
    is_admin?: boolean
    is_lead_officer?: boolean
  }>>([]);
  const [showJudgeSelection, setShowJudgeSelection] = useState(false);
  const [showSentencingOptions, setShowSentencingOptions] = useState(false);
  const [showPaymentTab, setShowPaymentTab] = useState(false);
  const [sentencingOptions, setSentencingOptions] = useState({
    fines: [],
    bans: [],
    communityService: [],
    otherPenalties: []
  });
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    reason: '',
    recipient: '',
    status: 'pending'
  });
  const [showRoleManagement, setShowRoleManagement] = useState(false);
  const [roleChangeRequest, setRoleChangeRequest] = useState({
    userId: '',
    currentRole: '',
    newRole: '',
    reason: ''
  });
  const [showSummonModal, setShowSummonModal] = useState(false);
  const [summonQuery, setSummonQuery] = useState('');
  const [summaries, setSummaries] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [summaryText, setSummaryText] = useState('');
  const [isSubmittingSummary, setIsSubmittingSummary] = useState(false);
  const [defenseCounselEnabled, setDefenseCounselEnabled] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [showDocketModal, setShowDocketModal] = useState(false);

  const summonUser = async (userId: string, username: string) => {
    try {
      // 1. Send notification via RPC
      const { error } = await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: 'moderation_action', // closest fit
        p_title: '📜 Court Summons',
        p_message: `You have been summoned to the Troll Court by Judge ${profile?.username || 'Unknown'}. Please report immediately!`,
        p_metadata: {
            action: 'court_summon',
            court_id: courtId,
            summoned_by: user.id
        }
      });

      if (error) throw error;

      toast.success(`Summon sent to @${username}`);
      setShowSummonModal(false);
      setSummonQuery('');
    } catch (err) {
      console.error('Error summoning user:', err);
      toast.error('Failed to summon user');
    }
  };


  const initCourtroom = useCallback(async () => {
    if (!user || !courtId || !isValidUuid(courtId)) return;

    setLoading(true);
    try {
      const { data: session, error: sessionError } = await supabase
        .from('court_sessions')
        .select('*')
        .eq('id', courtId)
        .maybeSingle();

      if (sessionError) throw sessionError;
      
      if (!session) {
        toast.error('Court session not found');
        navigate('/troll-court');
        return;
      }

      setCourtSession(session);
      setBoxCount(Math.min(4, Math.max(2, session.max_boxes || 2)));

      // Always connect to LiveKit for all users (viewers and speakers)
      const isJudge = profile?.role === 'admin' || profile?.role === 'lead_troll_officer' || profile?.is_admin || profile?.is_lead_officer;
      const isOfficer = profile?.role === 'troll_officer' || profile?.is_troll_officer;
      const canPublishInitial = isJudge || isOfficer || ["defendant", "accuser", "witness", "attorney"].includes(profile?.role);
      
      // Get token
      const vercelTokenUrl = import.meta.env.VITE_LIVEKIT_TOKEN_URL;
      const edgeBase = import.meta.env.VITE_EDGE_FUNCTIONS_URL;
      const edgeTokenUrl = edgeBase ? `${edgeBase}/livekit-token` : null;
      const tokenUrl = vercelTokenUrl || edgeTokenUrl || "/api/livekit-token";

      const authSession = await supabase.auth.getSession();
      const accessToken = authSession.data.session?.access_token;

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken || ''}`,
        },
        body: JSON.stringify({
          room: courtId,
          identity: user.id,
          user_id: user.id,
          role: profile?.role,
          allowPublish: canPublishInitial
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get LiveKit token');
      }

      const data = await response.json();
      setToken(data.token);
      setServerUrl(data.livekitUrl || data.serverUrl || import.meta.env.VITE_LIVEKIT_URL);

    } catch (err) {
      console.error('Error initializing courtroom:', err);
      toast.error('Failed to join court session');
    } finally {
      setLoading(false);
    }
  }, [user, courtId, navigate, profile]);

  useEffect(() => {
    if (!user) return;

    // Handle missing/invalid IDs early so we don't get "invalid input syntax for type uuid: \"null\""
    if (!courtId || courtId === 'null' || courtId === 'undefined') {
      toast.error('Invalid court session');
      setLoading(false);
      navigate('/troll-court');
      return;
    }

    // Support /court/active as a shortcut (resolves to the current live session)
    if (courtId === 'active') {
      void (async () => {
        try {
          const { data: currentSession, error } = await supabase.rpc('get_current_court_session');
          if (error) throw error;
          
          let session = Array.isArray(currentSession) ? currentSession[0] : currentSession;
          
          // If RPC returned nothing, check via direct query just in case (for 'active' status support)
          if (!session) {
             const { data: fallbackSession } = await supabase
              .from('court_sessions')
              .select('*')
              .in('status', ['live', 'active', 'waiting'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
             
             if (fallbackSession) {
               session = fallbackSession;
             }
          }

          const resolvedId = session?.id;
          if (!resolvedId || !isValidUuid(resolvedId)) {
            toast.error('No active court session found');
            setLoading(false);
            navigate('/troll-court');
            return;
          }
          navigate(`/court/${resolvedId}`);
        } catch (err) {
          console.error('[CourtRoom] Failed to resolve active court session:', err);
          toast.error('No active court session found');
          setLoading(false);
          navigate('/troll-court');
        }
      })();
      return;
    }

    if (!isValidUuid(courtId)) {
      toast.error('Invalid court session');
      setLoading(false);
      navigate('/troll-court');
      return;
    }

    initCourtroom();
  }, [user, courtId, initCourtroom, navigate]);

  useEffect(() => {
    if (!activeCase || !activeCase.id) return;
    const caseId = activeCase.id as string;

    const loadStateAndNotes = async () => {
      const { data: state } = await supabase
        .from('court_session_state')
        .select('*')
        .eq('case_id', caseId)
        .maybeSingle();

      if (state && typeof state.defense_counsel_mode === 'boolean') {
        setDefenseCounselEnabled(state.defense_counsel_mode);
      }

      const { data: summaryRows } = await supabase
        .from('court_summaries')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      setSummaries(summaryRows || []);

      const { data: feedbackRows } = await supabase
        .from('court_ai_feedback')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      setFeedback(feedbackRows || []);
    };

    loadStateAndNotes();

    const channel = supabase
      .channel(`court_notes_${caseId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'court_summaries',
          filter: `case_id=eq.${caseId}`,
        },
        (payload) => {
          const row = payload.new as any;
          setSummaries((prev) => [...prev, row]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'court_ai_feedback',
          filter: `case_id=eq.${caseId}`,
        },
        (payload) => {
          const row = payload.new as any;
          setFeedback((prev) => [...prev, row]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCase]);

  // Keep box count in sync for all viewers using Realtime (Push) instead of Polling (Pull)
  useEffect(() => {
    if (!courtId) return;
    if (courtId === 'active' || !isValidUuid(courtId)) return;
    
    // Initial fetch to ensure we have the latest state
    const fetchInitialState = async () => {
      try {
        const { data } = await supabase
          .from('court_sessions')
          .select('max_boxes,status')
          .eq('id', courtId)
          .maybeSingle();

        if (data) {
          if (data.status && !['active', 'live', 'waiting'].includes(data.status)) {
            toast.info('Court session ended');
            navigate('/troll-court');
            return;
          }
          if (typeof data.max_boxes === 'number') {
             setBoxCount((prev) => {
               const newCount = Math.min(4, Math.max(2, data.max_boxes));
               return newCount !== prev ? newCount : prev;
             });
          }
        }
      } catch (err) {
        console.error('Error fetching initial court state:', err);
      }
    };
    
    fetchInitialState();

    const channel = supabase
      .channel(`court_session_updates_${courtId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'court_sessions',
          filter: `id=eq.${courtId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.status && !['active', 'live', 'waiting'].includes(newData.status)) {
            toast.info('Court session ended');
            navigate('/troll-court');
            return;
          }
          if (typeof newData.max_boxes === 'number') {
            const newBoxCount = Math.min(4, Math.max(2, newData.max_boxes));
            setBoxCount((prev) => {
              if (prev !== newBoxCount) {
                console.log('[CourtRoom] BoxCount updated via Realtime:', newBoxCount);
                return newBoxCount;
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courtId, navigate]);

  useEffect(() => {
    console.log('[CourtRoom] Component mounted with courtId:', courtId);
    return () => {
      console.log('[CourtRoom] Component unmounting');
    };
  }, [courtId]);

  const isJudge =
    profile?.role === 'admin' ||
    profile?.role === 'lead_troll_officer' ||
    profile?.is_admin ||
    profile?.is_lead_officer;

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

  const effectiveRole = getEffectiveRole();

  // Server-side token enforces publish permissions; client mirrors as a UX hint.
  // Judges can always publish, and users with court roles can publish
  const isOfficer = profile?.role === 'troll_officer' || profile?.is_troll_officer;
  const roleCanPublish = Boolean(isJudge) || Boolean(isOfficer) ||
                         ["defendant", "accuser", "witness", "attorney"].includes(profile?.role);
  const canPublish = roleCanPublish || joinBoxRequested;

  const handleJoinBox = async () => {
    if (!user || !courtId) return;
    if (joinBoxLoading) return;
    if (activeBoxCount >= boxCount) {
      toast.error('All court boxes are full');
      return;
    }

    setJoinBoxLoading(true);
    try {
      const { data: boxData, error: boxError } = await supabase.rpc('request_court_box', {
        p_session_id: String(courtId),
      });

      if (boxError) throw boxError;
      if (!boxData?.success) {
        toast.error(boxData?.error || 'Unable to join a court box');
        return;
      }

      // Get token from Vercel endpoint
      const vercelTokenUrl = import.meta.env.VITE_LIVEKIT_TOKEN_URL;
      const edgeBase = import.meta.env.VITE_EDGE_FUNCTIONS_URL;
      const edgeTokenUrl = edgeBase ? `${edgeBase}/livekit-token` : null;
      const tokenUrl = vercelTokenUrl || edgeTokenUrl || "/api/livekit-token";

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
          room: courtId,
          identity: user.id,
          user_id: user.id,
          role: profile?.role,
          allowPublish: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Token request failed: ${response.status}`);
      }

      const data = await response.json();
      setToken(data?.token);
      setServerUrl(data?.livekitUrl || data?.serverUrl || import.meta.env.VITE_LIVEKIT_URL);
      setJoinBoxRequested(true);
      toast.success('Joined a court box');
    } catch (err) {
      console.error("Courtroom join box error:", err);
      if (err?.message?.includes('404') || err?.status === 404) {
        toast.error('LiveKit token service not available. Please check configuration.');
      } else {
        toast.error('Unable to join a court box');
      }
    } finally {
      setJoinBoxLoading(false);
    }
  };

  const startCourtSessionNow = async () => {
    if (!isJudge || !user) return;

    const targetCourtId = isValidUuid(courtId) ? courtId : crypto.randomUUID();

    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await startCourtSession({
        sessionId: targetCourtId,
        maxBoxes: 2,
        roomName: targetCourtId,
        userId: user.id
      });

      if (sessionError) throw sessionError;

      // Get token from Vercel endpoint
      const vercelTokenUrl = import.meta.env.VITE_LIVEKIT_TOKEN_URL;
      const edgeBase = import.meta.env.VITE_EDGE_FUNCTIONS_URL;
      const edgeTokenUrl = edgeBase ? `${edgeBase}/livekit-token` : null;
      const tokenUrl = vercelTokenUrl || edgeTokenUrl || "/api/livekit-token";

      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error('No active session');

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          room: targetCourtId,
          identity: user.id,
          user_id: user.id,
          role: profile?.role,
          allowPublish: true,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Token request failed: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      const resolvedSessionId = sessionData?.id || targetCourtId;
      setCourtSession(sessionData || { id: resolvedSessionId, status: 'active' });
      setBoxCount(Math.min(6, Math.max(2, sessionData?.maxBoxes || 2)));
      setToken(tokenData?.token);
      setServerUrl(tokenData?.livekitUrl || tokenData?.serverUrl || import.meta.env.VITE_LIVEKIT_URL);
      toast.success('Court session started');
      if (resolvedSessionId !== courtId) {
        navigate(`/court/${resolvedSessionId}`);
      }
    } catch (err) {
      console.error('Error starting court session:', err);
      if (err?.message?.includes('404') || err?.status === 404) {
        toast.error('LiveKit token service not available. Please check configuration.');
      } else {
        toast.error('Failed to start court session');
      }
    } finally {
      setLoading(false);
    }
  };

  const endCourtSessionNow = async () => {
    if (!isJudge) {
      toast.error('Only the judge can end the session');
      return;
    }

    // Force Case Record Check
    if (judgeControls.forceCaseRecord && activeCase && activeCase.status !== 'closed' && activeCase.status !== 'resolved') {
        toast.error('Case record must be completed (Verdict Issued) before closing session.');
        return;
    }
    
    if (!courtId) {
      toast.error('Invalid court session ID');
      console.error('Cannot end court session: courtId is missing');
      return;
    }

    try {
      console.log('Calling end_court_session RPC for courtId=', courtId)
      const res = await supabase.rpc('end_court_session', {
        p_session_id: courtId
      });
      console.log('end_court_session RPC response:', res)
      
      if ((res as any)?.error) {
        console.error('end_court_session RPC returned error object:', (res as any).error)
        throw (res as any).error
      }

      toast.success('Court session ended');
      
      // Also update local state to reflect ended status immediately
      setCourtSession(prev => prev ? { ...prev, status: 'ended' } : null);
      
      navigate('/troll-court');
    } catch (err) {
      console.error('Error ending court session:', err);
      toast.error(`Failed to end court session: ${(err as any)?.message || 'Unknown error'}`);
    }
  };



  // Court functions
  const startNewCase = async (caseData) => {
    if (!isJudge) return;

    try {
      // Resolve usernames to UUIDs
      const { data: defendantData, error: defendantError } = await supabase
        .from('user_profiles')
        .select('id, username')
        .eq('username', caseData.defendant)
        .single();

      if (defendantError || !defendantData) {
        toast.error('Defendant username not found');
        return;
      }

      const { data: accuserData, error: accuserError } = await supabase
        .from('user_profiles')
        .select('id, username')
        .eq('username', caseData.accuser)
        .single();

      if (accuserError || !accuserData) {
        toast.error('Accuser username not found');
        return;
      }

      const newCase = {
        title: caseData.title,
        defendant_id: defendantData.id,
        plaintiff_id: accuserData.id,
        description: caseData.description,
        severity: caseData.severity,
        status: 'in_session',
        started_at: new Date().toISOString(),
        evidence: [],
        witnesses: []
      };

      setActiveCase({ ...newCase, defendant: caseData.defendant, accuser: caseData.accuser });
      setDefendant(defendantData.id); // Store UUID
      setCourtPhase('opening');

      // Save case to database
      const { error } = await supabase
        .from('court_cases')
        .insert(newCase);

      // Apply judge controls based on severity
      const severity = caseData.severity;
      const newControls = {
        autoLockChat: severity === 'High' || severity === 'Critical',
        requireLeadApproval: severity === 'Critical',
        forceCaseRecord: severity !== 'Low'
      };
      setJudgeControls(newControls);

      if (newControls.autoLockChat) {
         toast.info('Chat auto-locked for this case due to severity');
      }

      if (error) throw error;

      toast.success('Court case started');
    } catch (err) {
      console.error('Error starting case:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        statusCode: err?.status
      });
      toast.error(`Failed to start case: ${err?.message || 'Unknown error'}`);
    }
  };

  const addEvidence = async (file, description) => {
    if (!activeCase) return;

    try {
      // Upload file to storage
      const fileName = `${activeCase.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('court-evidence')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const evidenceItem = {
        id: Date.now().toString(),
        fileName: file.name,
        fileUrl: uploadData.path,
        description,
        uploadedBy: user.id,
        uploadedAt: new Date().toISOString()
      };

      setEvidence(prev => [...prev, evidenceItem]);

      // Update case in database
      const { error } = await supabase
        .from('court_cases')
        .update({ evidence: [...(activeCase.evidence || []), evidenceItem] })
        .eq('id', activeCase.id);

      if (error) throw error;

      toast.success('Evidence added');
    } catch (err) {
      console.error('Error adding evidence:', err);
      toast.error('Failed to add evidence');
    }
  };

  const issueVerdict = async (verdictData) => {
    if (!isJudge || !activeCase) return;

    // Lead Officer Approval Check for Critical Cases
    if (judgeControls.requireLeadApproval) {
        const isLeadOrAdmin = profile?.role === 'admin' || profile?.is_admin || profile?.role === 'lead_troll_officer' || profile?.is_lead_officer;
        if (!isLeadOrAdmin) {
             toast.error('Critical Severity: Lead Officer approval required for this verdict.');
             return;
        }
    }

    try {
      const finalVerdict = {
        caseId: activeCase.id,
        verdict: verdictData.verdict, // 'guilty' or 'not_guilty'
        penalty: verdictData.penalty,
        reasoning: verdictData.reasoning,
        issuedBy: user.id,
        issuedAt: new Date().toISOString()
      };

      setVerdict(finalVerdict);
      setCourtPhase('verdict');

      // Save verdict to database
      const { error } = await supabase
        .from('court_verdicts')
        .insert(finalVerdict);

      if (error) throw error;

      // Update case status
      await supabase
        .from('court_cases')
        .update({ status: 'resolved', verdict: finalVerdict })
        .eq('id', activeCase.id);

      toast.success('Verdict issued');
    } catch (err) {
      console.error('Error issuing verdict:', err);
      toast.error('Failed to issue verdict');
    }
  };

  const _assignDefendant = (_userId) => {
    if (!isJudge) return;
    // setDefendant(userId);
  };

  const _callWitness = (_userId) => {
    if (!isJudge) return;
    // Logic to call witness to speak
    // toast.success('Witness called');
  };

  const fetchAvailableJudges = async () => {
   try {
     // Fetch users with admin or lead officer status (using boolean flags)
     const { data: judges, error } = await supabase
       .from('user_profiles')
       .select('id, username, role, is_admin, is_lead_officer')
       .or('role.eq.admin,is_admin.eq.true,is_lead_officer.eq.true')
       .neq('id', user.id); // Exclude current user

     if (error) throw error;

     // Filter judges based on current user's effective role
     const filteredJudges = judges.filter(j => {
       // Admins can see all potential judges
       if (effectiveRole === 'admin') {
         return true;
       }
       // Lead officers can only see other lead officers (not admins)
       if (effectiveRole === 'lead_troll_officer') {
         return j.is_lead_officer;
       }
       return false;
     });

     setAvailableJudges(filteredJudges);
     return filteredJudges;
   } catch (err) {
     console.error('Error fetching judges:', err);
     toast.error('Failed to fetch available judges');
     return [];
   }
  };

  const selectJudge = async (judgeId) => {
    if (!isJudge) return;

    try {
      // Check if the current user is allowed to select this judge
      const selectedJudge = availableJudges.find(j => j.id === judgeId);
      
      // Prevent lead officers from selecting admins
      if (effectiveRole === 'lead_troll_officer' &&
          (selectedJudge?.role === 'admin' || selectedJudge?.is_admin)) {
        toast.error('Lead officers cannot select admins as judges');
        return;
      }

      setJudge(judgeId);
      toast.success(`Judge ${selectedJudge.username} selected`);
      
      // Update court session with judge information
      if (courtId) {
        await supabase.rpc('update_court_judge', {
          p_session_id: courtId,
          p_judge_id: judgeId
        });
      }
    } catch (err) {
      console.error('Error selecting judge:', err);
      toast.error('Failed to select judge');
    }
  };

  const loadSentencingOptions = async () => {
    try {
      // Load predefined sentencing options from database
      const { data, error } = await supabase
        .from('court_sentencing_options')
        .select('*')
        .order('severity', { ascending: true });

      if (error) throw error;

      // Organize by type
      const fines = data.filter(option => option.type === 'fine');
      const bans = data.filter(option => option.type === 'ban');
      const communityService = data.filter(option => option.type === 'community_service');
      const otherPenalties = data.filter(option => option.type === 'other');

      setSentencingOptions({ fines, bans, communityService, otherPenalties });
      setShowSentencingOptions(true);
    } catch (err) {
      console.error('Error loading sentencing options:', err);
      toast.error('Failed to load sentencing options');
    }
  };

  const applySentence = async (sentenceType, sentenceDetails) => {
    if (!isJudge || !defendant) return;

    try {
      const sentenceData = {
        case_id: activeCase?.id,
        defendant_id: defendant,
        judge_id: judge || user.id,
        sentence_type: sentenceType,
        details: sentenceDetails,
        issued_at: new Date().toISOString(),
        status: 'active'
      };

      // Save sentence to database
      const { error } = await supabase
        .from('court_sentences')
        .insert(sentenceData);

      if (error) throw error;

      toast.success('Sentence applied successfully');
      
      // If it's a ban, update user status
      if (sentenceType.startsWith('ban')) {
        await supabase
          .from('user_profiles')
          .update({
            is_banned: true,
            ban_reason: sentenceDetails.reason,
            ban_expires: sentenceDetails.duration
          })
          .eq('id', defendant);
      }
      if (sentenceType === 'jail') {
        const releaseTime = new Date();
        releaseTime.setHours(releaseTime.getHours() + sentenceDetails.duration);
        await supabase.from('jail').insert({
          user_id: defendant,
          release_time: releaseTime.toISOString(),
          reason: sentenceDetails.reason,
          created_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error applying sentence:', err);
      toast.error('Failed to apply sentence');
    }
  };

  const processPayment = async () => {
    if (!isJudge || paymentData.amount <= 0) return;

    try {
      const paymentRecord = {
        case_id: activeCase?.id,
        defendant_id: defendant,
        amount: paymentData.amount,
        reason: paymentData.reason,
        recipient: paymentData.recipient,
        status: 'completed',
        processed_by: user.id,
        processed_at: new Date().toISOString()
      };

      // Save payment record
      const { error } = await supabase
        .from('court_payments')
        .insert(paymentRecord);

      if (error) throw error;

      // Update defendant's coin balance using court-specific function
      await supabase.rpc('court_levy_fine', {
        p_defendant_id: defendant,
        p_amount: paymentData.amount,
        p_reason: `Court payment: ${paymentData.reason}`,
        p_court_id: courtId,
        p_metadata: { recipient: paymentData.recipient }
      });

      toast.success('Payment processed successfully');
      setPaymentData({ amount: 0, reason: '', recipient: '', status: 'pending' });
      setShowPaymentTab(false);
    } catch (err) {
      console.error('Error processing payment:', err);
      toast.error('Failed to process payment');
    }
  };

  const initRoleChange = (targetUserId = user.id) => {
    // Initialize role change for current user or specified user
    const currentUserRole = effectiveRole;
    setRoleChangeRequest({
      userId: targetUserId,
      currentRole: currentUserRole,
      newRole: '',
      reason: ''
    });
    setShowRoleManagement(true);
  };

  const requestRoleChange = async () => {
    if (!roleChangeRequest.newRole || !roleChangeRequest.reason) {
      toast.error('Please select a new role and provide a reason');
      return;
    }

    try {
      // Determine if this is a downgrade or upgrade request
      const _isDowngrade = ['user', 'troll_officer'].includes(roleChangeRequest.newRole);
      const _isAdminRequest = roleChangeRequest.newRole === 'admin';

      // Only admins can directly change roles, others create requests
      if (effectiveRole !== 'admin') {
        // Create a role change request for admin approval
        const requestData = {
          user_id: roleChangeRequest.userId,
          requested_role: roleChangeRequest.newRole,
          current_role: roleChangeRequest.currentRole,
          reason: roleChangeRequest.reason,
          status: 'pending',
          requested_by: user.id,
          requested_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('role_change_requests')
          .insert(requestData);

        if (error) throw error;

        toast.success('Role change request submitted for admin approval');
      } else {
        // Admins can directly change roles
        const roleUpdate: {
          role: string
          is_admin?: boolean
          is_lead_officer?: boolean
        } = {
          role: roleChangeRequest.newRole
        };

        // Handle boolean flags based on role
        if (roleChangeRequest.newRole === 'admin') {
          roleUpdate.is_admin = true;
          roleUpdate.is_lead_officer = false;
        } else if (roleChangeRequest.newRole === 'lead_troll_officer') {
          roleUpdate.is_admin = false;
          roleUpdate.is_lead_officer = true;
        } else {
          roleUpdate.is_admin = false;
          roleUpdate.is_lead_officer = false;
        }

        const { error } = await supabase
          .from('user_profiles')
          .update(roleUpdate)
          .eq('id', roleChangeRequest.userId);

        if (error) throw error;

        // If changing own role, update the auth store
        if (roleChangeRequest.userId === user.id) {
          // This will trigger a profile refresh
          toast.success('Role changed successfully. Please refresh to see changes.');
        } else {
          toast.success('User role updated successfully');
        }
      }

      setShowRoleManagement(false);
    } catch (err) {
      console.error('Error processing role change:', err);
      toast.error('Failed to process role change');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-10 text-center">
        Joining Troll Court...
      </div>
    );
  }

  if (!courtSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-10 text-center">
        <div className="bg-zinc-900 border border-purple-500/20 rounded-xl p-8 max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4">⚖️ Court Adjourned</h1>
          <p className="text-gray-400 mb-6">
            There is currently no active court session. Please wait for a Troll Officer or Administrator to start a court session.
          </p>
          {isJudge && (
            <button
              type="button"
              onClick={startCourtSessionNow}
              className="mb-3 w-full px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition-colors"
            >
              Start Court Session
            </button>
          )}
          <a
            href="/troll-court"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition-colors"
          >
            Return to Court
          </a>
        </div>
      </div>
    );
  }

  if ((!token || !serverUrl || token === '' || serverUrl === '')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-10 text-center">
        <div className="text-red-400">Failed to join court session. Please try again.</div>
        <div className="text-xs text-gray-500 mt-2">
          Token: {token ? 'present' : 'missing'}, ServerUrl: {serverUrl ? 'present' : 'missing'}
        </div>
      </div>
    );
  }

  return (
    <RequireRole roles={[UserRole.USER, UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER, UserRole.ADMIN]}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-4">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
            <Scale className="w-8 h-8 text-purple-400" />
            Troll Court Session
          </h1>
          <div className="text-sm text-gray-400 mt-2">
            Phase: {courtPhase.charAt(0).toUpperCase() + courtPhase.slice(1)}
            {activeCase && ` | Case: ${activeCase.title}`}
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-4">

          {/* Main Court Area */}
          <div className="lg:col-span-3 space-y-4">

            {/* LiveKit Video Area */}
            <div className="bg-black rounded-xl overflow-hidden">
              {isJudge && (
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                  <div className="text-sm text-gray-300">
                    Boxes: <span className="font-semibold text-white">{boxCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const next = Math.max(2, (boxCount || 2) - 1);
                        setBoxCount(next);
                        try {
                          await supabase.rpc('set_court_boxes', { p_session_id: String(courtId), p_max_boxes: next });
                        } catch {}
                      }}
                      className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
                      disabled={boxCount <= 2}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = Math.min(4, (boxCount || 2) + 1);
                        setBoxCount(next);
                        try {
                          await supabase.rpc('set_court_boxes', { p_session_id: String(courtId), p_max_boxes: next });
                        } catch {}
                      }}
                      className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
                      disabled={boxCount >= 4}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
              {!isJudge && !canPublish && (
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                  <div className="text-sm text-gray-300">
                    Boxes: <span className="font-semibold text-white">{boxCount}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      ({Math.min(activeBoxCount, boxCount)} active)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleJoinBox}
                    className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-sm disabled:opacity-60"
                    disabled={joinBoxLoading || activeBoxCount >= boxCount}
                  >
                    {joinBoxLoading ? 'Joining...' : 'Join Box'}
                  </button>
                </div>
              )}
              {token && (
                <LiveKitRoom
                  token={token}
                  serverUrl={serverUrl}
                  connect={true}
                  audio={true}
                  video={true}
                  className="w-full"
                >
                  <CourtLimitEnforcer isJudge={Boolean(isJudge)} isOfficer={Boolean(isOfficer)} />
                  <CourtTrackCounter onCount={setActiveBoxCount} />
                  <CourtVideoGrid maxTiles={boxCount} />
                </LiveKitRoom>
              )}
            </div>

            {/* Court Status */}
            <div className="bg-zinc-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Court Status</h3>
                <div className="flex items-center gap-2">
                  {activeCase && (
                    <button
                      onClick={() => setIsGeminiModalOpen(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded shadow-lg shadow-purple-900/20 transition-all animate-pulse"
                      title="Open Gemini AI Assistant"
                    >
                      <Sparkles size={12} />
                      AI Assist
                    </button>
                  )}
                  {activeCase && isJudge && (
                    <button
                      onClick={() => setIsGeminiModalOpen(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded shadow-lg shadow-purple-900/20 transition-all animate-pulse"
                      title="Open Gemini AI Assistant"
                    >
                      <Sparkles size={12} />
                      AI Assist
                    </button>
                  )}
                  {courtPhase === 'waiting' && <span className="px-2 py-1 bg-gray-600 rounded text-xs">Waiting</span>}
                  {courtPhase === 'opening' && <span className="px-2 py-1 bg-blue-600 rounded text-xs">Opening Statements</span>}
                  {courtPhase === 'evidence' && <span className="px-2 py-1 bg-yellow-600 rounded text-xs">Evidence Phase</span>}
                  {courtPhase === 'deliberation' && <span className="px-2 py-1 bg-orange-600 rounded text-xs">Deliberation</span>}
                  {courtPhase === 'verdict' && <span className="px-2 py-1 bg-green-600 rounded text-xs">Verdict</span>}
                </div>
              </div>

              {activeCase && (
                <div className="space-y-2 text-sm">
                  <div><strong>Case:</strong> {activeCase.title}</div>
                  <div>
                    <strong>Severity:</strong> 
                    <span className={`ml-1 font-bold ${
                      activeCase.severity === 'Critical' ? 'text-red-500' :
                      activeCase.severity === 'High' ? 'text-orange-500' :
                      activeCase.severity === 'Medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {activeCase.severity || 'Low'}
                    </span>
                  </div>
                  <div><strong>Defendant:</strong> {activeCase.defendant || defendant || 'Not assigned'}</div>
                  <div><strong>Description:</strong> {activeCase.description}</div>
                </div>
              )}

              {verdict && (
                <div className="mt-3 p-3 bg-purple-900/30 rounded border border-purple-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Gavel className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold">Verdict Issued</span>
                  </div>
                  <div className="text-sm">
                    <div><strong>Verdict:</strong> {verdict.verdict === 'guilty' ? 'Guilty' : 'Not Guilty'}</div>
                    {verdict.penalty && <div><strong>Penalty:</strong> {verdict.penalty}</div>}
                    <div><strong>Reasoning:</strong> {verdict.reasoning}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {/* Judge Controls */}
            {isJudge && (
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-purple-400" />
                    Judge Controls
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={endCourtSessionNow}
                      className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 rounded font-bold transition-colors"
                    >
                      End Session
                    </button>
                    <button
                      onClick={() => setShowJudgeControls(!showJudgeControls)}
                      className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded"
                    >
                      {showJudgeControls ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {showJudgeControls && (
                  <div className="space-y-2">
                    {!activeCase ? (
                      <>
                        <button
                          onClick={() => setShowNewCaseModal(true)}
                          className="w-full py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                        >
                          Start New Case
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setCourtPhase('opening')}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                        >
                          Start Opening Statements
                        </button>
                        <button
                          onClick={() => setCourtPhase('evidence')}
                          className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
                        >
                          Begin Evidence Phase
                        </button>
                        <button
                          onClick={() => setCourtPhase('deliberation')}
                          className="w-full py-2 bg-orange-600 hover:bg-orange-700 rounded text-sm"
                        >
                          Start Deliberation
                        </button>
                        <button
                          onClick={() => setShowVerdictModal(true)}
                          className="w-full py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                        >
                          Issue Verdict
                        </button>
                        <div className="border-t border-zinc-700 pt-2 mt-2">
                          <button
                            onClick={loadSentencingOptions}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                          >
                            Sentencing Options
                          </button>
                          <button
                            onClick={() => setShowPaymentTab(true)}
                            className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
                          >
                            Process Payment
                          </button>
                          <button
                            onClick={endCourtSessionNow}
                            className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                          >
                            End Court Session
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Evidence Panel */}
            <div className="bg-zinc-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  Evidence ({evidence.length})
                </h3>
                <button
                  onClick={() => setShowEvidencePanel(!showEvidencePanel)}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded"
                >
                  {showEvidencePanel ? 'Hide' : 'Show'}
                </button>
              </div>

              {showEvidencePanel && (
                <div className="space-y-2">
                  {/* Evidence Upload */}
                  <div className="border-2 border-dashed border-gray-600 rounded p-3 text-center">
                    <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                    <input
                      type="file"
                      id="evidence-upload"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const description = prompt('Enter evidence description:');
                          if (description) {
                            addEvidence(file, description);
                          }
                        }
                      }}
                    />
                    <label
                      htmlFor="evidence-upload"
                      className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      Click to upload evidence
                    </label>
                  </div>

                  {/* Evidence List */}
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {evidence.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-4">
                        No evidence submitted yet
                      </div>
                    ) : (
                      evidence.map((item) => (
                        <div key={item.id} className="bg-zinc-800 rounded p-2 text-sm">
                          <div className="font-semibold">{item.fileName}</div>
                          <div className="text-gray-400 text-xs">{item.description}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(item.uploadedAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Court Roles */}
            <div className="bg-zinc-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  Court Roles
                </h3>
                {isJudge && (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await fetchAvailableJudges();
                        setShowJudgeSelection(true);
                      }}
                      className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded"
                    >
                      Select Judge
                    </button>
                    <button
                      onClick={() => initRoleChange()}
                      className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Manage Role
                    </button>
                    <button
                      onClick={() => setShowSummonModal(true)}
                      className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded flex items-center gap-1"
                    >
                      <Bell className="w-3 h-3" />
                      Summon
                    </button>
                    <button
                      onClick={() => setShowDocketModal(true)}
                      className="text-xs px-2 py-1 bg-cyan-600 hover:bg-cyan-700 rounded flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      Docket
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Judge:</span>
                  <span className="text-purple-400">{judge || 'Not assigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Defendant:</span>
                  <span className="text-red-400">{defendant || 'Not assigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Your Role:</span>
                  <span className="text-yellow-400">{effectiveRole}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Only Admin/Lead/Officers can broadcast. Others are audience.
                </div>
              </div>
          </div>

          {/* Court Chat */}
          <CourtChat 
              courtId={courtId || 'default'} 
              isLocked={judgeControls.autoLockChat && activeCase?.status !== 'resolved' && activeCase?.status !== 'closed'} 
          />

          {activeCase && (
            <CourtAIController
              caseId={activeCase.id}
              isJudge={isJudge}
              evidence={evidence}
              caseDetails={activeCase}
            />
          )}

          <CourtGeminiModal
            isOpen={isGeminiModalOpen}
            onClose={() => setIsGeminiModalOpen(false)}
            courtId={activeCase?.id || ''}
            isAuthorized={isJudge}
          />

          <CourtDocketModal
            isOpen={showDocketModal}
            onClose={() => setShowDocketModal(false)}
            isJudge={isJudge}
            onSelectCase={() => {
               // If needed, judge can load case from here
               // For now, we just close the modal, or maybe we want to load it?
               // The modal handles extensions/pardons. Loading a case into the room is separate.
               // If the user wants to "call to stand", we might want to do something.
               // For now, let's just log or toast, or maybe set active case?
               // The request said "docket system needs to show in court which is a popup with current user incident information...".
               // The modal does that.
               setShowDocketModal(false);
            }}
          />

            <MAIAuthorityPanel
              mode="court"
              location="court_room"
              recordId={courtSession?.id || undefined}
            />

            {/* MAI Court Assistant */}
            <CourtAIAssistant
              courtSession={courtSession}
              activeCase={activeCase}
              courtPhase={courtPhase as any}
              evidence={evidence}
              defendant={defendant}
              judge={judge}
              verdict={verdict}
            />
          </div>
        </div>

        {activeCase && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-gray-100">Case Summaries</h3>
                </div>
                {profile?.id === activeCase?.defendant_id && (
                  <label className="flex items-center gap-2 text-[11px] text-gray-300">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-600 bg-zinc-900"
                      checked={defenseCounselEnabled}
                      onChange={async (e) => {
                        const enabled = e.target.checked;
                        setDefenseCounselEnabled(enabled);
                        if (!activeCase?.id) return;
                        await supabase
                          .from('court_session_state')
                          .upsert({
                            case_id: activeCase.id,
                            defense_counsel_mode: enabled,
                            updated_at: new Date().toISOString(),
                          }, { onConflict: 'case_id' });
                      }}
                    />
                    <span>Defense Counsel may speak for defendant</span>
                  </label>
                )}
              </div>
              <div className="text-[11px] text-gray-400 mb-2">
                This is an in-game roleplay court. Not legal advice.
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {summaries.length === 0 && (
                  <div className="text-xs text-gray-500">No summaries submitted yet.</div>
                )}
                {summaries.map((s) => (
                  <div
                    key={s.id}
                    className="border border-zinc-800 rounded-md px-2 py-1.5 text-xs bg-zinc-950/40"
                  >
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-gray-200">{s.role}</span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(s.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-300 whitespace-pre-wrap">
                      {s.summary_text}
                    </div>
                  </div>
                ))}
              </div>
              {user && (
                <form
                  className="mt-3 space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!activeCase?.id || !summaryText.trim() || isSubmittingSummary) return;
                    setIsSubmittingSummary(true);
                    try {
                      let roleLabel = 'Witness';
                      if (user.id === activeCase.plaintiff_id) roleLabel = 'Plaintiff';
                      else if (user.id === activeCase.defendant_id) roleLabel = 'Defendant';
                      else if (isJudge) roleLabel = 'Judge';

                      const { data, error } = await supabase
                        .from('court_summaries')
                        .insert({
                          case_id: activeCase.id,
                          user_id: user.id,
                          role: roleLabel,
                          summary_text: summaryText.trim(),
                        })
                        .select('*')
                        .single();

                      if (error) throw error;

                      setSummaries((prev) => [...prev, data]);
                      setSummaryText('');

                      await generateSummaryFeedback(activeCase.id, user.id, 'Prosecutor', data.summary_text);
                      await generateSummaryFeedback(activeCase.id, user.id, 'Defense', data.summary_text);

                      toast.success('Summary submitted. AI feedback incoming.');
                    } catch (err) {
                      console.error('Error submitting summary:', err);
                      toast.error('Failed to submit summary');
                    } finally {
                      setIsSubmittingSummary(false);
                    }
                  }}
                >
                  <textarea
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 h-16 resize-none"
                    placeholder="Write your in-game case summary..."
                    value={summaryText}
                    onChange={(e) => setSummaryText(e.target.value)}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500">
                      Feedback is in-game roleplay only; not legal advice.
                    </span>
                    <button
                      type="submit"
                      disabled={!summaryText.trim() || isSubmittingSummary}
                      className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 rounded-md text-white disabled:opacity-50"
                    >
                      {isSubmittingSummary ? 'Submitting...' : 'Submit Summary'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-gray-100">AI Feedback</h3>
              </div>
              <div className="text-[11px] text-gray-400 mb-2">
                Prosecutor and Defense feedback are in-character. Not legal advice.
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {feedback.length === 0 && (
                  <div className="text-xs text-gray-500">No AI feedback yet.</div>
                )}
                {feedback.map((f) => (
                  <div
                    key={f.id}
                    className="border border-zinc-800 rounded-md px-2 py-1.5 text-xs bg-zinc-950/40"
                  >
                    <div className="flex justify-between mb-1">
                      <span
                        className={
                          f.agent_role === 'Prosecutor'
                            ? 'font-semibold text-red-400'
                            : 'font-semibold text-blue-400'
                        }
                      >
                        {f.agent_role} Feedback
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(f.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-300 whitespace-pre-wrap">
                      {f.feedback_text}
                    </div>
                    {f.json_data?.score != null && (
                      <div className="text-[10px] text-gray-500 mt-1">
                        Score: {f.json_data.score}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* New Case Modal */}
        {showNewCaseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-purple-400" />
                Start New Court Case
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Case Title</label>
                  <input
                    type="text"
                    value={newCaseData.title}
                    onChange={(e) => setNewCaseData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Enter case title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Defendant</label>
                  <input
                    type="text"
                    value={newCaseData.defendant}
                    onChange={(e) => setNewCaseData(prev => ({ ...prev, defendant: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Defendant username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Accuser</label>
                  <input
                    type="text"
                    value={newCaseData.accuser}
                    onChange={(e) => setNewCaseData(prev => ({ ...prev, accuser: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Accuser username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={newCaseData.description}
                    onChange={(e) => setNewCaseData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 h-20 resize-none"
                    placeholder="Case description and charges"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    startNewCase(newCaseData);
                    setShowNewCaseModal(false);
                    setNewCaseData({ title: '', defendant: '', accuser: '', description: '', severity: 'Low' });
                  }}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded font-semibold transition-colors"
                >
                  Start Case
                </button>
                <button
                  onClick={() => {
                    setShowNewCaseModal(false);
                    setNewCaseData({ title: '', defendant: '', accuser: '', description: '', severity: 'Low' });
                  }}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Verdict Modal */}
        {showVerdictModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-purple-400" />
                Issue Court Verdict
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Verdict</label>
                  <select
                    value={verdictData.verdict}
                    onChange={(e) => setVerdictData(prev => ({ ...prev, verdict: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="not_guilty">Not Guilty</option>
                    <option value="guilty">Guilty</option>
                  </select>
                </div>

                {verdictData.verdict === 'guilty' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Penalty</label>
                    <input
                      type="text"
                      value={verdictData.penalty}
                      onChange={(e) => setVerdictData(prev => ({ ...prev, penalty: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="e.g., 30 day ban, coin fine, etc."
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Reasoning</label>
                  <textarea
                    value={verdictData.reasoning}
                    onChange={(e) => setVerdictData(prev => ({ ...prev, reasoning: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 h-24 resize-none"
                    placeholder="Explain the verdict and reasoning"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    issueVerdict(verdictData);
                    setShowVerdictModal(false);
                    setVerdictData({ verdict: 'not_guilty', penalty: '', reasoning: '' });
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold transition-colors"
                >
                  Issue Verdict
                </button>
                <button
                  onClick={() => {
                    setShowVerdictModal(false);
                    setVerdictData({ verdict: 'not_guilty', penalty: '', reasoning: '' });
                  }}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Judge Selection Modal */}
        {showJudgeSelection && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-purple-400" />
                Select Court Judge
              </h3>

              <div className="mb-4">
                <p className="text-sm text-gray-300 mb-2">
                  {effectiveRole === 'admin' ?
                    'Select a judge from available administrators and lead officers:' :
                    'Select a judge from available lead officers:'}
                </p>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {availableJudges.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-4">
                    No available judges found
                  </div>
                ) : (
                  availableJudges.map((judgeOption) => (
                    <div
                      key={judgeOption.id}
                      className={`bg-zinc-800 rounded p-3 text-sm cursor-pointer hover:bg-zinc-700 transition-colors ${
                        judge === judgeOption.id ? 'border-2 border-purple-500' : ''
                      }`}
                      onClick={() => selectJudge(judgeOption.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-semibold">{judgeOption.username}</div>
                          <div className="text-xs text-gray-400">
                            {judgeOption.role === 'admin' || judgeOption.is_admin ? 'Admin' : 'Lead Officer'}
                          </div>
                        </div>
                        {judge === judgeOption.id && (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowJudgeSelection(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sentencing Options Modal */}
        {showSentencingOptions && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-2xl w-full">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-purple-400" />
                Sentencing Options for {activeCase?.defendant || 'Defendant'}
              </h3>

              <div className="grid md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {/* Fines */}
                <div className="bg-zinc-800 rounded-lg p-3">
                  <h4 className="font-semibold mb-2 text-purple-400">Fines</h4>
                  {sentencingOptions.fines.map((fine, index) => (
                    <div key={index} className="mb-2 p-2 bg-zinc-700 rounded">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{fine.description}</span>
                        <button
                          onClick={() => applySentence('fine', {
                            type: fine.type,
                            amount: fine.amount,
                            reason: fine.description
                          })}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                        >
                          Apply {fine.amount} coins
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bans */}
                <div className="bg-zinc-800 rounded-lg p-3">
                  <h4 className="font-semibold mb-2 text-red-400">Bans</h4>
                  {sentencingOptions.bans.map((ban, index) => (
                    <div key={index} className="mb-2 p-2 bg-zinc-700 rounded">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{ban.description}</span>
                        <button
                          onClick={() => applySentence('ban', {
                            type: ban.type,
                            duration: ban.duration,
                            reason: ban.description
                          })}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                        >
                          Apply {ban.duration}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Community Service */}
                <div className="bg-zinc-800 rounded-lg p-3">
                  <h4 className="font-semibold mb-2 text-blue-400">Community Service</h4>
                  {sentencingOptions.communityService.map((service, index) => (
                    <div key={index} className="mb-2 p-2 bg-zinc-700 rounded">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{service.description}</span>
                        <button
                          onClick={() => applySentence('community_service', {
                            type: service.type,
                            hours: service.hours,
                            reason: service.description
                          })}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                        >
                          Assign {service.hours} hours
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Other Penalties */}
                <div className="bg-zinc-800 rounded-lg p-3">
                  <h4 className="font-semibold mb-2 text-yellow-400">Other Penalties</h4>
                  {sentencingOptions.otherPenalties.map((penalty, index) => (
                    <div key={index} className="mb-2 p-2 bg-zinc-700 rounded">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{penalty.description}</span>
                        <button
                          onClick={() => applySentence('other', {
                            type: penalty.type,
                            details: penalty.details,
                            reason: penalty.description
                          })}
                          className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs"
                        >
                          Apply Penalty
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSentencingOptions(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Processing Modal */}
        {showPaymentTab && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-purple-400" />
                Court Payment Processing
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (coins)</label>
                  <input
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Enter amount"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Reason</label>
                  <select
                    value={paymentData.reason}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="">Select reason</option>
                    <option value="fine_payment">Fine Payment</option>
                    <option value="restitution">Restitution</option>
                    <option value="court_fees">Court Fees</option>
                    <option value="damages">Damages</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Recipient</label>
                  <select
                    value={paymentData.recipient}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, recipient: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="">Select recipient</option>
                    <option value="court">Court Treasury</option>
                    <option value="victim">Victim</option>
                    <option value="community_fund">Community Fund</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="bg-zinc-800 rounded-lg p-3">
                  <h4 className="font-semibold mb-2">Payment Summary</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span>{paymentData.amount} coins</span>
                    </div>
                    <div className="flex justify-between">
                      <span>From:</span>
                      <span>{activeCase?.defendant || 'Defendant'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>To:</span>
                      <span>{paymentData.recipient || 'Not selected'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reason:</span>
                      <span>{paymentData.reason || 'Not selected'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={processPayment}
                  disabled={paymentData.amount <= 0 || !paymentData.reason || !paymentData.recipient}
                  className={`flex-1 py-2 rounded font-semibold transition-colors ${
                    paymentData.amount > 0 && paymentData.reason && paymentData.recipient
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
                >
                  Process Payment
                </button>
                <button
                  onClick={() => {
                    setShowPaymentTab(false);
                    setPaymentData({ amount: 0, reason: '', recipient: '', status: 'pending' });
                  }}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Role Management Modal */}
        {showRoleManagement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Role Management
              </h3>

              <div className="space-y-4">
                <div className="bg-zinc-800 rounded-lg p-3">
                  <h4 className="font-semibold mb-2">Current Role Information</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Current Role:</span>
                      <span className="font-semibold text-yellow-400">{roleChangeRequest.currentRole}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>User:</span>
                      <span className="font-semibold">{roleChangeRequest.userId === user.id ? 'Yourself' : roleChangeRequest.userId}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">New Role</label>
                  <select
                    value={roleChangeRequest.newRole}
                    onChange={(e) => setRoleChangeRequest(prev => ({ ...prev, newRole: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select new role</option>
                    {effectiveRole === 'admin' && (
                      <>
                        <option value="admin">Admin</option>
                        <option value="lead_troll_officer">Lead Troll Officer</option>
                      </>
                    )}
                    <option value="troll_officer">Troll Officer</option>
                    <option value="user">Regular User</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Reason for Change</label>
                  <textarea
                    value={roleChangeRequest.reason}
                    onChange={(e) => setRoleChangeRequest(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
                    placeholder="Explain why this role change is needed"
                  />
                </div>

                {effectiveRole !== 'admin' && (
                  <div className="bg-yellow-900/30 rounded-lg p-3 border border-yellow-500/30">
                    <h4 className="font-semibold mb-2 text-yellow-400">⚠️ Important Notice</h4>
                    <p className="text-sm text-yellow-300">
                      Your role change request will be submitted for admin approval. Admins will review and process your request.
                    </p>
                  </div>
                )}

                {effectiveRole === 'admin' && (
                  <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-500/30">
                    <h4 className="font-semibold mb-2 text-blue-400">✅ Admin Privilege</h4>
                    <p className="text-sm text-blue-300">
                      As an admin, you can directly change roles. This change will take effect immediately.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={requestRoleChange}
                  disabled={!roleChangeRequest.newRole || !roleChangeRequest.reason}
                  className={`flex-1 py-2 rounded font-semibold transition-colors ${
                    roleChangeRequest.newRole && roleChangeRequest.reason
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
                >
                  {effectiveRole === 'admin' ? 'Change Role' : 'Submit Request'}
                </button>
                <button
                  onClick={() => setShowRoleManagement(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summon Modal */}
        {showSummonModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-400" />
                Summon User to Court
              </h3>

              <div className="space-y-4 relative min-h-[200px]">
                  <p className="text-sm text-gray-400">
                    Search for a user to send an immediate court summons notification.
                  </p>
                  
                  <div className="relative">
                    <input
                        type="text"
                        value={summonQuery}
                        onChange={(e) => setSummonQuery(e.target.value)}
                        placeholder="Type username..."
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                        autoFocus
                    />
                    
                    {summonQuery.length > 0 && (
                        <UserSearchDropdown 
                            query={summonQuery}
                            onSelect={(userId, username) => summonUser(userId, username)}
                            onClose={() => {}} 
                        />
                    )}
                  </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowSummonModal(false);
                    setSummonQuery('');
                  }}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </RequireRole>
  );
}
