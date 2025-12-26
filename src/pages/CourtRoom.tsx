import React, { useEffect, useState, useMemo, memo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/store";
import { supabase, UserRole } from "../lib/supabase";
import { startCourtSession } from "../lib/courtSessions";
import { LiveKitRoom, ParticipantTile, useTracks } from "@livekit/components-react";
import "@livekit/components-styles";
import { toast } from "sonner";
import RequireRole from "../components/RequireRole";
import CourtAIAssistant from "../components/CourtAIAssistant";
import MAIAuthorityPanel from "../components/mai/MAIAuthorityPanel";
import CourtChatPanel from "../components/court/CourtChatPanel";
import { Scale, Gavel, FileText, Users, CheckCircle, XCircle, Upload, Eye, AlertTriangle } from "lucide-react";
import { Track } from "livekit-client";

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
            className="tc-neon-frame"
          >
            <ParticipantTile trackRef={t} />
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

export default function CourtRoom() {
   const { user, profile } = useAuthStore();
   const { courtId } = useParams();
   const navigate = useNavigate();
   const [token, setToken] = useState(null);
   const [serverUrl, setServerUrl] = useState(null);
   const [loading, setLoading] = useState(true);
   const [participantsAllowed, setParticipantsAllowed] = useState([]);
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
  const roomId = roomIdRef.current || courtId;

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
    description: ''
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

  useEffect(() => {
    // Check if courtId is provided
    if (!courtId) {
      toast.error('Invalid court session');
      navigate('/troll-court');
      return;
    }

    if (!user) return;

    initCourtroom();
  }, [user, courtId]);

  // Keep box count in sync for all viewers
  useEffect(() => {
    if (!courtId) return;
    let lastBoxCount = boxCount;
    
    const id = window.setInterval(async () => {
      try {
        const { data } = await supabase
          .from('court_sessions')
          .select('max_boxes,status')
          .eq('id', courtId)
          .maybeSingle();

        if (!data) return;
        if (data.status && data.status !== 'active') {
          toast.info('Court session ended');
          navigate('/troll-court');
          return;
        }
        if (typeof data.max_boxes === 'number') {
          const newBoxCount = Math.min(6, Math.max(2, data.max_boxes));
          if (newBoxCount !== lastBoxCount) {
            lastBoxCount = newBoxCount;
            setBoxCount(newBoxCount);
            console.log('[CourtRoom] BoxCount updated:', newBoxCount);
          }
        }
      } catch (err) {
        console.error('Court session polling error:', err);
      }
    }, 5000);

    return () => window.clearInterval(id);
  }, [courtId, navigate]);

  useEffect(() => {
    console.log('[CourtRoom] Component mounted with courtId:', courtId);
    return () => {
      console.log('[CourtRoom] Component unmounting');
    };
  }, [courtId]);

  const initCourtroom = async () => {
    try {
      setLoading(true);

      // Load court session metadata (public)
      try {
        const { data: sessionData } = await supabase
          .from('court_sessions')
          .select('*')
          .eq('id', courtId)
          .maybeSingle();

        if (sessionData) {
          setCourtSession(sessionData);
          setBoxCount(Math.min(6, Math.max(2, sessionData.max_boxes || 2)));
        }
      } catch (e) {
        // non-fatal, still allow joining if token works
      }

      const canRequestPublish =
        profile?.role === "admin" ||
        profile?.is_admin === true ||
        profile?.is_lead_officer === true;

      const { data, error } = await supabase.functions.invoke("livekit-token", {
        body: {
          room: courtId,
          identity: user.id,
          user_id: user.id,
          role: profile.role,
          allowPublish: canRequestPublish,
          isHost: canRequestPublish,
        },
      });

      if (error) throw error;

      setToken(data?.token);
      setServerUrl(data?.serverUrl || import.meta.env.VITE_LIVEKIT_URL);

      // who can broadcast?
      const allowed = ["admin", "lead_troll_officer", "defendant", "accuser", "witness", "attorney"];
      setParticipantsAllowed(allowed);

    } catch (err) {
      console.error("Courtroom token error:", err);
      toast.error("Unable to join court session.");
    } finally {
      setLoading(false);
    }
  };

  // Check if user is a judge (admin or lead officer)
  const isJudge = ['admin'].includes(profile?.role) ||
                   profile?.is_admin || profile?.is_lead_officer;

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
  const roleCanPublish = Boolean(isJudge) ||
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

      const { data, error } = await supabase.functions.invoke("livekit-token", {
        body: {
          room: courtId,
          identity: user.id,
          user_id: user.id,
          role: profile?.role,
          allowPublish: true,
          isHost: false,
        },
      });

      if (error) throw error;

      setToken(data?.token);
      setServerUrl(data?.serverUrl || import.meta.env.VITE_LIVEKIT_URL);
      setJoinBoxRequested(true);
      toast.success('Joined a court box');
    } catch (err) {
      console.error("Courtroom join box error:", err);
      if (err?.status === 404) {
        toast.error('LiveKit token service not deployed. Deploy the livekit-token edge function.');
      } else {
        toast.error('Unable to join a court box');
      }
    } finally {
      setJoinBoxLoading(false);
    }
  };

  const startCourtSessionNow = async () => {
    if (!isJudge || !user) return;

    const isValidUuid = (value) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

    const targetCourtId = isValidUuid(courtId) ? courtId : crypto.randomUUID();

    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await startCourtSession({
        sessionId: targetCourtId,
        maxBoxes: 2,
        roomName: targetCourtId
      });

      if (sessionError) throw sessionError;

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: targetCourtId,
          identity: user.id,
          user_id: user.id,
          role: profile?.role,
          allowPublish: true,
          isHost: true,
          create_room: true,
          room_metadata: {
            type: 'troll_court',
            max_participants: 6,
            judge: user.id,
            started_at: new Date().toISOString()
          }
        }
      });

      if (tokenError) throw tokenError;

      setCourtSession(sessionData || { id: targetCourtId, status: 'active' });
      setBoxCount(Math.min(6, Math.max(2, sessionData?.max_boxes || 2)));
      setToken(tokenData?.token);
      setServerUrl(tokenData?.serverUrl || import.meta.env.VITE_LIVEKIT_URL);
      toast.success('Court session started');
      if (targetCourtId !== courtId) {
        navigate(`/court/${targetCourtId}`);
      }
    } catch (err) {
      console.error('Error starting court session:', err);
      if (err?.status === 404) {
        toast.error('LiveKit token service not deployed. Deploy the livekit-token edge function.');
      } else {
        toast.error('Failed to start court session');
      }
    } finally {
      setLoading(false);
    }
  };

  const endCourtSessionNow = async () => {
    if (!isJudge || !courtId) return;

    try {
      await supabase
        .from('court_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', courtId);

      toast.success('Court session ended');
      navigate('/troll-court');
    } catch (err) {
      console.error('Error ending court session:', err);
      toast.error('Failed to end court session');
    }
  };



  // Court functions
  const startNewCase = async (caseData) => {
    if (!isJudge) return;

    try {
      const newCase = {
        title: caseData.title,
        defendant: caseData.defendant,
        accuser: caseData.accuser,
        description: caseData.description,
        status: 'in_session',
        started_at: new Date().toISOString(),
        evidence: [],
        witnesses: []
      };

      setActiveCase(newCase);
      setDefendant(caseData.defendant);
      setCourtPhase('opening');

      // Save case to database
      const { error } = await supabase
        .from('court_cases')
        .insert(newCase);

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

  const assignDefendant = (userId) => {
    if (!isJudge) return;
    setDefendant(userId);
  };

  const callWitness = (userId) => {
    if (!isJudge) return;
    // Logic to call witness to speak
    toast.success('Witness called');
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
        await supabase
          .from('court_sessions')
          .update({ judge_id: judgeId })
          .eq('id', courtId);
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

      // Update defendant's coin balance
      await supabase.rpc('update_user_coins', {
        user_id: defendant,
        amount: -paymentData.amount,
        reason: `Court payment: ${paymentData.reason}`
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
      const isDowngrade = ['user', 'troll_officer'].includes(roleChangeRequest.newRole);
      const isAdminRequest = roleChangeRequest.newRole === 'admin';

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

  if (!token || !serverUrl || token === '' || serverUrl === '') {
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
                        const next = Math.min(6, (boxCount || 2) + 1);
                        setBoxCount(next);
                        try {
                          await supabase.rpc('set_court_boxes', { p_session_id: String(courtId), p_max_boxes: next });
                        } catch {}
                      }}
                      className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
                      disabled={boxCount >= 6}
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
              <LiveKitRoom
                token={token}
                serverUrl={serverUrl}
                connect={true}
                audio={canPublish}
                video={canPublish}
                className="w-full"
              >
                <CourtTrackCounter onCount={setActiveBoxCount} />
                <CourtVideoGrid maxTiles={boxCount} />
              </LiveKitRoom>
            </div>

            {/* Court Status */}
            <div className="bg-zinc-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Court Status</h3>
                <div className="flex items-center gap-2">
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
                  <div><strong>Defendant:</strong> {defendant || 'Not assigned'}</div>
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
                  <button
                    onClick={() => setShowJudgeControls(!showJudgeControls)}
                    className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded"
                  >
                    {showJudgeControls ? 'Hide' : 'Show'}
                  </button>
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
                        <button
                          onClick={endCourtSessionNow}
                          className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                        >
                          End Court Session
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

            <MAIAuthorityPanel
              mode="court"
              location="court_room"
              recordId={courtSession?.id || undefined}
            />

            {/* MAI Court Assistant */}
            <CourtAIAssistant
              courtSession={courtSession}
              activeCase={activeCase}
              courtPhase={courtPhase}
              evidence={evidence}
              defendant={defendant}
              judge={judge}
              verdict={verdict}
            />
          </div>
        </div>

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
                    setNewCaseData({ title: '', defendant: '', accuser: '', description: '' });
                  }}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded font-semibold transition-colors"
                >
                  Start Case
                </button>
                <button
                  onClick={() => {
                    setShowNewCaseModal(false);
                    setNewCaseData({ title: '', defendant: '', accuser: '', description: '' });
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
                Sentencing Options for {defendant}
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
                      <span>{defendant} (Defendant)</span>
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

      </div>
    </RequireRole>
  );
}
