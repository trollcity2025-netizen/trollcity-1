import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Scale, AlertCircle, LogOut, Send, Gavel } from "lucide-react";
import { courtSystem } from "@/lib/courtSystem";
import { roomManager, RoomInstance } from "@/lib/roomManager";
import { useAuthStore } from "@/lib/store";

export default function TrollCourtSession() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [activeSession, setActiveSession] = useState(null);
  const [chatMessages, setChatMessages] = useState<{ user: string; message: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [courtRoomRef, setCourtRoomRef] = useState<RoomInstance | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const courtRoomRefRef = useRef<RoomInstance | null>(null);

  const currentUser = {
    id: user?.id || "user-default",
    name: profile?.username || user?.email || "Judge",
    role: (profile?.role === "admin" || profile?.is_admin) ? "admin" : profile?.is_lead_officer ? "lead_troll_officer" : profile?.is_troll_officer ? "troll_officer" : "user",
  };

  const isJudge = currentUser.role === "admin" || currentUser.role === "lead_troll_officer";

  const initializeInstantCourt = useCallback(async () => {
    if (isInitializing) return;
    if (courtRoomRefRef.current) return;
    if (activeSession) return;

    setIsInitializing(true);

    try {
      console.log("[TrollCourt] Initializing court instantly...");
      
      const courtRoom = await roomManager.createCourtRoom();
      setCourtRoomRef(courtRoom);
      courtRoomRefRef.current = courtRoom;
      console.log(`✅ [TrollCourt] Court room created instantly: ${courtRoom.roomName}`);

      const session = courtSystem.startCourtSession(
        {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role as "admin" | "lead_troll_officer" | "troll_officer",
        },
        []
      );

      setActiveSession(session);
      setChatMessages([
        {
          user: "Court",
          message: `🔨 Troll Court session started by Judge ${currentUser.name}. Court is now in session!`,
        },
      ]);
      console.log("✅ [TrollCourt] Court session started instantly!");
    } catch (error) {
      console.error("[TrollCourt] Initialization error:", error);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, currentUser.id, currentUser.name, currentUser.role]);

  useEffect(() => {
    if (isJudge) {
      initializeInstantCourt();
    }

    return () => {
      if (courtRoomRefRef.current) {
        roomManager.disconnectRoom(courtRoomRefRef.current.id);
      }
    };
  }, [isJudge, user, initializeInstantCourt]);

  const handleSendChat = () => {
    if (chatInput.trim()) {
      setChatMessages([...chatMessages, { user: currentUser.name, message: chatInput }]);
      setChatInput("");
    }
  };

  const handleGiveVerdict = (v: "guilty" | "not_guilty") => {
    const message =
      v === "guilty"
        ? "The defendant is found GUILTY. Penalties will be applied."
        : "The defendant is found NOT GUILTY. All charges dismissed.";
    setChatMessages([
      ...chatMessages,
      {
        user: "Court",
        message: `🔨 ${message}`,
      },
    ]);

    setTimeout(() => {
      alert("Court session ended. Verdict recorded.");
      if (courtRoomRef) {
        roomManager.disconnectRoom(courtRoomRef.id);
      }
      if (courtRoomRefRef.current) {
        roomManager.disconnectRoom(courtRoomRefRef.current.id);
        courtRoomRefRef.current = null;
      }
      setActiveSession(null);
      navigate("/");
    }, 3000);
  };

  if (!isJudge) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Scale size={40} className="text-purple-400" />
            <h1 className="text-4xl font-black">Troll Court</h1>
          </div>

          <div className="bg-gray-900 rounded-lg p-8 purple-neon text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-gray-500" />
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p className="text-gray-400 mb-6">
              Only judges and court officers can access the courtroom.
            </p>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition inline-flex items-center gap-2"
            >
              <LogOut size={18} />
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Scale size={40} className="text-purple-400" />
          <h1 className="text-4xl font-black">Troll Court - Judge Panel</h1>
        </div>

        {isInitializing ? (
          <div className="bg-gray-900 rounded-lg p-8 purple-neon text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-400 border-t-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Initializing court room...</p>
          </div>
        ) : activeSession ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Court Area */}
            <div className="lg:col-span-2 bg-gray-900 rounded-lg p-6 purple-neon">
              <h2 className="text-xl font-bold mb-4">🔨 Court in Session</h2>

              <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-400">Judge: {activeSession.judge.name}</p>
                <p className="text-sm text-gray-400">
                  Status: <span className="text-green-400 font-bold">🟢 ACTIVE</span>
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4 h-64 overflow-y-auto mb-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className="text-sm mb-2">
                    <span className="font-bold text-purple-300">{msg.user}:</span> {msg.message}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Court notes..."
                  className="flex-1 bg-gray-800 border border-purple-500/30 rounded px-4 py-2 text-white"
                />
                <button
                  onClick={handleSendChat}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition"
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleGiveVerdict("guilty")}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded font-bold transition"
                >
                  🔨 GUILTY
                </button>
                <button
                  onClick={() => handleGiveVerdict("not_guilty")}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded font-bold transition"
                >
                  ✓ NOT GUILTY
                </button>
              </div>
            </div>

            {/* Court Info */}
            <div className="bg-gray-900 rounded-lg p-6 purple-neon">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Gavel size={18} />
                Court Status
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-gray-400">Judge</p>
                  <p className="font-bold">{activeSession.judge.name}</p>
                </div>
                <div>
                  <p className="text-gray-400">Status</p>
                  <p className="font-bold text-green-400">🟢 IN SESSION</p>
                </div>
                <div>
                  <p className="text-gray-400">Participants</p>
                  <p className="font-bold">{activeSession.summoned.length}</p>
                </div>
                <div>
                  <p className="text-gray-400">Room</p>
                  <p className="font-bold text-xs break-all">{courtRoomRef?.roomName}</p>
                </div>
                <button
                  onClick={() => {
                    console.log("🛑 [TrollCourt] Force ending session...");
                    if (courtRoomRefRef.current) {
                      roomManager.disconnectRoom(courtRoomRefRef.current.id);
                      courtRoomRefRef.current = null;
                    }
                    setCourtRoomRef(null);
                    setActiveSession(null);
                    setChatMessages([]);
                    navigate("/");
                  }}
                  className="w-full mt-4 py-2 bg-red-600 hover:bg-red-700 rounded font-bold transition flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  End Session
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg p-8 purple-neon text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-gray-500" />
            <h2 className="text-2xl font-bold mb-4">Court Not Initialized</h2>
            <p className="text-gray-400 mb-6">
              Click the button below to start Troll Court instantly.
            </p>
            <button
              onClick={initializeInstantCourt}
              disabled={isInitializing}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-bold transition inline-flex items-center gap-2"
            >
              <Gavel size={18} />
              {isInitializing ? "Starting..." : "Start Court"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
