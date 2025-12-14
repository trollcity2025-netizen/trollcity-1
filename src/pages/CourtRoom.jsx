import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { LiveKitRoomWrapper } from '../components/LiveKitVideoGrid';
import { useLiveKitSession } from '../hooks/useLiveKitSession';
import { toast } from "sonner";
import { Scale, Gavel, Users, Mic, MicOff, UserX, FileText, MessageSquare, Crown, AlertTriangle, CheckCircle, XCircle, Shield, Eye } from 'lucide-react';
import AuthorityPanel from '../components/AuthorityPanel';
import RequireRole from "../components/RequireRole";

// Court-themed chat component
function CourtChat({ isParticipant }) {
  const [messages, setMessages] = useState([
    { user: "Court Clerk", text: "⚖️ Court is now in session. All rise.", system: true, timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, {
      user: "You",
      text: input,
      system: false,
      timestamp: new Date()
    }]);
    setInput("");
  };

  return (
    <div className="bg-zinc-900 border border-purple-500/20 rounded-lg h-64 flex flex-col">
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {messages.map((msg, i) => (
          <div key={i} className={msg.system ? "text-center text-purple-300 text-sm italic" : ""}>
            {!msg.system && (
              <button className="text-purple-300 hover:underline text-sm">
                {msg.user}
              </button>
            )}
            {!msg.system && ": "}
            <span className={msg.system ? "" : "text-gray-300 text-sm"}>{msg.text}</span>
          </div>
        ))}
      </div>

      {isParticipant && (
        <div className="p-2 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 bg-gray-800 p-2 rounded-md text-white text-sm"
            placeholder="Court discussion..."
          />
          <button
            onClick={sendMessage}
            className="bg-purple-600 hover:bg-purple-700 px-3 rounded-md text-sm"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

// Evidence panel for court officials
function EvidencePanel({ isOfficial }) {
  const [evidence, setEvidence] = useState([
    { id: 1, title: "Transaction Records", submittedBy: "Plaintiff", status: "pending", description: "Payment logs from disputed transaction" },
    { id: 2, title: "Chat Logs", submittedBy: "Defendant", status: "pending", description: "Conversation history showing context" },
  ]);

  const approveEvidence = (id) => {
    setEvidence(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'approved' } : item
    ));
    toast.success("Evidence approved and added to court record");
  };

  const rejectEvidence = (id) => {
    setEvidence(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'rejected' } : item
    ));
    toast.info("Evidence rejected");
  };

  return (
    <div className="bg-zinc-900 border border-purple-500/20 rounded-lg p-4 h-64 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <FileText className="w-5 h-5 text-purple-400" />
        Evidence Panel
      </h3>
      <div className="space-y-2">
        {evidence.map((item) => (
          <div key={item.id} className="bg-gray-800/50 rounded p-3">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="font-semibold text-sm">{item.title}</p>
                <p className="text-xs text-gray-400">Submitted by: {item.submittedBy}</p>
                <p className="text-xs text-gray-500 mt-1">{item.description}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                item.status === 'pending' ? 'bg-yellow-600' :
                item.status === 'approved' ? 'bg-green-600' : 'bg-red-600'
              }`}>
                {item.status}
              </span>
            </div>

            {isOfficial && item.status === 'pending' && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => approveEvidence(item.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700 rounded py-1 text-xs font-semibold"
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectEvidence(item.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 rounded py-1 text-xs font-semibold"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


export default function CourtRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const userRole = (() => {
    if (profile?.role === 'admin' || profile?.is_lead_officer) return 'judge';
    if (profile?.role === 'troll_officer') return 'bailiff';
    return 'audience';
  })();

  const isJudge = userRole === 'judge';
  const isBailiff = userRole === 'bailiff';
  const isOfficial = isJudge || isBailiff;

  const {
    joinAndPublish,
    isConnected,
    isConnecting,
    toggleMicrophone,
    localParticipant,
    error,
    participants,
  } = useLiveKitSession({
    roomName: sessionId || 'troll-court',
    user: user ? { ...user, role: userRole } : null,
    autoPublish: isOfficial,
    maxParticipants: 6,
  });

  const [loading, setLoading] = useState(true);
  const [courtSession, setCourtSession] = useState(null);
  const [userDocket, setUserDocket] = useState(null);
  const [roomName, setRoomName] = useState(null);
  const isAudience = userRole === 'audience';
  const canParticipate = isOfficial;

  // Join LiveKit once room is known
  useEffect(() => {
    if (roomName && user?.id) {
      joinAndPublish();
    }
  }, [roomName, user?.id, joinAndPublish]);

  useEffect(() => {
    if (!user || !sessionId) return;
    initCourtroom();
  }, [user, sessionId]);

  const initCourtroom = async () => {
    try {
      setLoading(true);

      let actualSessionId = sessionId;

      // If sessionId is 'active', find the current live session
      if (sessionId === 'active') {
        const { data: currentSession, error: currentError } = await supabase.rpc('get_current_court_session');
        if (currentError || !currentSession?.[0]) {
          toast.error("No active court session found");
          navigate('/troll-court');
          return;
        }
        actualSessionId = currentSession[0].id;
      }

      // Get court session info
      const { data: session, error: sessionError } = await supabase
        .from('court_sessions')
        .select('*')
        .eq('id', actualSessionId)
        .eq('status', 'live')
        .single();

      if (sessionError || !session) {
        toast.error("Court session not found or ended");
        navigate('/troll-court');
        return;
      }

      setCourtSession(session);
      setRoomName(`courtroom-${actualSessionId}`);

      // Check if user has docket entry and mark as in_session
      if (user) {
        const { data: docketData } = await supabase.rpc('get_user_docket');
        const userDocketEntry = docketData?.find(d => d.status === 'scheduled');
        if (userDocketEntry) {
          setUserDocket(userDocketEntry);
          // Mark docket as in_session
          await supabase
            .from('court_docket')
            .update({
              status: 'in_session',
              court_session_id: actualSessionId,
              updated_at: new Date().toISOString()
            })
            .eq('id', userDocketEntry.id);
        }
      }

    } catch (err) {
      console.error("Courtroom initialization error:", err);
      toast.error("Unable to join court session.");
      navigate('/troll-court');
    } finally {
      setLoading(false);
    }
  };

  // Auto-start court when authority enters
  useEffect(() => {
    if (!courtSession || courtSession.status !== 'waiting' || !isConnected) return;

    // Auto-start court
    const autoStartCourt = async () => {
      try {
        const { data, error } = await supabase.rpc('auto_start_court_session', {
          authority_user_id: user.id
        });

        if (error) throw error;

        if (data) {
          // Court was started successfully
          const { data: updatedSession } = await supabase.rpc('get_current_court_session');
          setCourtSession(updatedSession?.[0] || courtSession);
          toast.success("Court session started");
        }
      } catch (error) {
        console.error('Error auto-starting court:', error);
      }
    };

    autoStartCourt();
  }, [courtSession, isConnected, user]);


  const handleRuling = (type) => {
    if (!isOfficial) return;

    const rulings = {
      warning: "⚠️ WARNING issued to defendant",
      mute: "🔇 Defendant muted for 24 hours",
      kick: "🚫 Defendant removed from platform",
      fine: "💰 Fine of 100 coins issued",
      dismiss: "❌ Case dismissed"
    };

    toast.success(rulings[type] || "Ruling issued");
  };

  const handleEndCourt = async () => {
    if (!isOfficial) return;

    try {
      await supabase
        .from('court_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', courtSession.id);

      toast.success("Court session ended");
      navigate('/troll-court');
    } catch (error) {
      console.error('Error ending court:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-10 text-center">
        <div className="animate-pulse">
          <Scale className="w-16 h-16 mx-auto mb-4 text-purple-400" />
          <p>Joining Courtroom...</p>
        </div>
      </div>
    );
  }

  return (
    <RequireRole roles={["user", "troll_officer", "lead_troll_officer", "admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">

        {/* Court Banner */}
        <div className="bg-gradient-to-r from-purple-900/80 to-gold-900/80 border-b border-purple-500/30 p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <Scale className="w-8 h-8 text-yellow-400" />
              <div>
                <h1 className="text-2xl font-bold text-yellow-300">⚖️ TROLL COURT IN SESSION</h1>
                <p className="text-sm text-purple-200">Justice, Order, and Accountability</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {userDocket && (
                <div className="bg-yellow-900/50 border border-yellow-500/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-semibold text-yellow-300">You are scheduled for court</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${courtSession?.status === 'live' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                <span className="text-sm font-semibold">
                  {courtSession?.status === 'live' ? 'LIVE SESSION' : 'SESSION STARTING'}
                </span>
              </div>

              <div className="text-sm text-gray-300">
                Role: <span className={`font-semibold ${
                  isJudge ? 'text-purple-400' :
                  isBailiff ? 'text-green-400' :
                  'text-blue-400'
                }`}>
                  {userRole}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Main Court Area */}
          <div className="flex-1 p-4">
            {roomName && (
              <LiveKitRoomWrapper
                roomName={roomName}
                user={{ ...user, role: userRole }}
                className="w-full h-full bg-black rounded-xl overflow-hidden"
                showLocalVideo={canParticipate}
                maxParticipants={6}
                autoPublish={false}
                role={userRole}
                autoConnect={false}
              />
            )}

            {/* Judge Controls - Only for judges */}
            {isJudge && (
              <div className="mt-6 bg-zinc-900 border border-purple-500/20 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-purple-400" />
                  Judge Controls
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <button
                    onClick={() => handleRuling('warning')}
                    className="bg-yellow-600 hover:bg-yellow-700 rounded-lg py-2 px-3 text-sm font-semibold flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Warning
                  </button>

                  <button
                    onClick={() => handleRuling('mute')}
                    className="bg-orange-600 hover:bg-orange-700 rounded-lg py-2 px-3 text-sm font-semibold flex items-center gap-2"
                  >
                    <MicOff className="w-4 h-4" />
                    Mute
                  </button>

                  <button
                    onClick={() => handleRuling('remove')}
                    className="bg-red-600 hover:bg-red-700 rounded-lg py-2 px-3 text-sm font-semibold flex items-center gap-2"
                  >
                    <UserX className="w-4 h-4" />
                    Remove
                  </button>

                  <button
                    onClick={() => handleRuling('fine')}
                    className="bg-purple-600 hover:bg-purple-700 rounded-lg py-2 px-3 text-sm font-semibold flex items-center gap-2"
                  >
                    <Gavel className="w-4 h-4" />
                    Fine
                  </button>

                  <button
                    onClick={() => handleRuling('verdict')}
                    className="bg-green-600 hover:bg-green-700 rounded-lg py-2 px-3 text-sm font-semibold flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Verdict
                  </button>

                  <button
                    onClick={handleEndCourt}
                    className="bg-gray-600 hover:bg-gray-700 rounded-lg py-2 px-3 text-sm font-semibold flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    End Court
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Side Panel */}
          <div className="w-80 bg-zinc-900/50 border-l border-purple-500/20 p-4 space-y-4 overflow-y-auto">
            {/* Live Chat */}
            <CourtChat isParticipant={canParticipate} />

            {/* Evidence Panel - Only for officials */}
            {isOfficial && <EvidencePanel isOfficial={isOfficial} />}

            {/* Court Status */}
            <div className="bg-zinc-900 border border-purple-500/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Court Status
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>Your Role:</span>
                  <span className={`font-semibold capitalize ${
                    isJudge ? 'text-purple-400' :
                    isBailiff ? 'text-green-400' :
                    'text-blue-400'
                  }`}>
                    {userRole}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Video/Audio:</span>
                  <span className={`font-semibold ${canParticipate ? 'text-green-400' : 'text-gray-400'}`}>
                    {canParticipate ? '✓ Enabled' : '○ Audience'}
                  </span>
                </div>
              </div>
            </div>

            {/* Session Info */}
            <div className="bg-zinc-900 border border-purple-500/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-400" />
                Session Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Participants:</span>
                  <span>{participants.size + (localParticipant ? 1 : 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-semibold ${courtSession?.status === 'live' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {courtSession?.status === 'live' ? '🟢 Live' : '🟡 Starting'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Session ID:</span>
                  <span className="font-mono text-xs">{sessionId?.slice(0, 8)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Authority Panel - Right Side Rail */}
        <div className="hidden lg:block fixed right-0 top-0 h-full z-10">
          <AuthorityPanel />
        </div>


      </div>
    </RequireRole>
  );
}
