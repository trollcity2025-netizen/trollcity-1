import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Video, Plus, Minus, LogOut, Settings, X, MoreVertical, Gift, ShoppingCart, ChevronRight, ChevronLeft } from "lucide-react";
import ChatBox from "@/components/broadcast/ChatBox";
import StatsPanel from "@/components/broadcast/StatsPanel";
import GiftModal from "@/components/broadcast/GiftModal";
import ProfileModal from "@/components/broadcast/ProfileModal";
import GiftBox from "@/components/broadcast/GiftBox";
import CoinStoreModal, { coinPackages } from "@/components/broadcast/CoinStoreModal";
import EntranceEffect from "@/components/broadcast/EntranceEffect";
import UserActionsMenu from "@/components/broadcast/UserActionsMenu";
import { useAuthStore } from "@/lib/store";
import { roomManager, RoomInstance } from "@/lib/roomManager";

interface Guest {
  id: string;
  name: string;
  isActive: boolean;
  roomId?: string;
}

interface Pricing {
  messagePrice: number;
  profileViewPrice: number;
  guestBoxPrice: number;
}

export default function Broadcast() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuthStore();
  const broadcastTitle = (location.state as any)?.title || "My Stream";
  const broadcastCategory = (location.state as any)?.category || "Just Chatting";
  const initialPricing = (location.state as any)?.pricing || {
    messagePrice: 0,
    profileViewPrice: 0,
    guestBoxPrice: 0,
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const broadcastStartTime = useRef<number>(Date.now());
  const broadcastRoomRef = useRef<RoomInstance | null>(null);

  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [peakViewerCount, setPeakViewerCount] = useState(0);
  const [coinCount, setCoinCount] = useState(5000);
  const [selectedProfile, setSelectedProfile] = useState<{ name: string } | null>(null);
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<"idle" | "granted" | "denied">("idle");
  const [pricing, setPricing] = useState<Pricing>(initialPricing);
  const [isStreamOptionsOpen, setIsStreamOptionsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; user: string } | null>(null);
  const [trollCount, setTrollCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState<{ name: string; role?: string } | null>(null);
  const [showEntranceEffect, setShowEntranceEffect] = useState(false);
  const [entranceUser, setEntranceUser] = useState<{ name: string; role: "admin" | "lead_troll_officer" | "troll_officer" } | null>(null);
  const [purchasedGifts, setPurchasedGifts] = useState<{ id: string; name: string; emoji: string }[]>([
    { id: "1", name: "Rose", emoji: "🌹" },
    { id: "2", name: "Heart", emoji: "💗" },
    { id: "3", name: "Diamond", emoji: "💎" },
  ]);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [totalGifts, setTotalGifts] = useState(0);
  const [newFollowers, setNewFollowers] = useState<string[]>([]);
  const [reports, setReports] = useState<string[]>([]);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);

  const userRole: "admin" | "lead_troll_officer" | "troll_officer" | "user" = 
    (profile?.role === "admin" || profile?.is_admin) 
      ? "admin" 
      : profile?.is_lead_officer 
        ? "lead_troll_officer" 
        : profile?.is_troll_officer 
          ? "troll_officer" 
          : "user";

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    
    initializeBroadcast();

    return () => {
      cleanupBroadcast();
    };
  }, [user, profile]);

  useEffect(() => {
    if (isBroadcasting) {
      const viewerInterval = setInterval(() => {
        setViewerCount((v) => {
          const newCount = Math.max(5, v + Math.floor(Math.random() * 3) - 1);
          if (newCount > peakViewerCount) {
            setPeakViewerCount(newCount);
          }
          return newCount;
        });
      }, 3000);
      return () => clearInterval(viewerInterval);
    }
  }, [isBroadcasting, peakViewerCount]);

  const initializeBroadcast = async () => {
    if (isInitializing) return;
    setIsInitializing(true);

    try {
      console.log("[Broadcast] Initializing... Creating room instantly");
      
      const username = profile?.username || user?.email || "Broadcaster";
      const broadcastRoom = await roomManager.createBroadcastRoom(
        user!.id,
        username,
        broadcastCategory
      );
      
      broadcastRoomRef.current = broadcastRoom;
      console.log(`✅ [Broadcast] Room created instantly: ${broadcastRoom.roomName}`);
      
      setIsBroadcasting(true);
      setViewerCount(5);
      setPeakViewerCount(5);
      setPermissionState("idle");
      
      requestMediaPermissions();
    } catch (error) {
      console.error("[Broadcast] Initialization error:", error);
      setIsInitializing(false);
    }
  };

  const requestMediaPermissions = async () => {
    try {
      console.log("[Broadcast] Requesting media permissions...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setPermissionState("granted");
      
      if (broadcastRoomRef.current) {
        console.log("[Broadcast] Publishing local tracks to room...");
        await roomManager.publishLocalTracks(broadcastRoomRef.current.id, stream);
        console.log("✅ [Broadcast] Local tracks published!");
      }
    } catch (error) {
      console.error("[Broadcast] Permission denied", error);
      setPermissionState("denied");
    } finally {
      setIsInitializing(false);
    }
  };

  const cleanupBroadcast = () => {
    if (broadcastRoomRef.current) {
      console.log("[Broadcast] Cleaning up broadcast room...");
      roomManager.disconnectRoom(broadcastRoomRef.current.id);
      broadcastRoomRef.current = null;
    }
    
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleAddGuest = async () => {
    if (!broadcastRoomRef.current) return;
    
    const newGuest: Guest = {
      id: `guest-${Date.now()}`,
      name: `Guest ${guests.length + 1}`,
      isActive: false,
      roomId: broadcastRoomRef.current.id,
    };
    
    setGuests([...guests, newGuest]);
    console.log(`[Broadcast] Guest added to room: ${broadcastRoomRef.current.roomName}`);
  };

  const handleRemoveGuest = (id: string) => {
    setGuests(guests.filter((g) => g.id !== id));
  };

  const handleGuestJoin = async (id: string) => {
    if (coinCount >= pricing.guestBoxPrice) {
      setCoinCount(coinCount - pricing.guestBoxPrice);
      setCoinsEarned(coinsEarned + pricing.guestBoxPrice);
      setGuests(guests.map((g) => (g.id === id ? { ...g, isActive: true } : g)));
      setViewerCount((v) => v + 1);
      console.log(`[Broadcast] Guest joined and connected to room`);
    } else {
      alert(`You need ${pricing.guestBoxPrice} coins to join a guest box`);
    }
  };

  const handleKickUser = (user: string) => {
    const targetUser = selectedUser;
    if (targetUser?.role && ["admin", "lead_troll_officer", "troll_officer"].includes(targetUser.role)) {
      alert("You cannot kick officers!");
      setSelectedUser(null);
      return;
    }
    alert(`${user} has been kicked from the stream`);
    setSelectedUser(null);
  };

  const handleReportUser = (user: string) => {
    setReports([...reports, `User ${user} reported`]);
    alert(`${user} has been reported for review`);
    setSelectedUser(null);
  };

  const handleFollowUser = (user: string) => {
    setNewFollowers([...newFollowers, user]);
    alert(`You are now following ${user}`);
    setSelectedUser(null);
  };

  const handleSummonToTrollCourt = (user: string) => {
    if (coinCount >= 1000) {
      setCoinCount(coinCount - 1000);
      setCoinsEarned(coinsEarned + 1000);
      alert(`${user} has been summoned to Troll Court! Court scheduled during business hours.`);
      setSelectedUser(null);
    } else {
      alert("You need 1000 coins to summon to Troll Court");
    }
  };

  const handleGiftUser = (amount: number) => {
    if (selectedUser) {
      alert(`${amount} coins gift sent to ${selectedUser.name}!`);
      setSelectedUser(null);
    }
  };

  const handleSimulateOfficerJoin = () => {
    setEntranceUser({ name: "Officer_Name", role: "troll_officer" });
    setShowEntranceEffect(true);
  };

  const handleEndBroadcast = () => {
    cleanupBroadcast();
    setIsBroadcasting(false);

    const duration = Math.floor((Date.now() - broadcastStartTime.current) / 1000);

    navigate("/broadcast-summary", {
      state: {
        title: broadcastTitle,
        category: broadcastCategory,
        duration: duration,
        totalGifts: totalGifts,
        totalCoins: coinsEarned,
        coinsPerDollar: 100,
        viewerCount: peakViewerCount,
        newFollowers: newFollowers.length > 0 ? newFollowers : [],
        reports: reports,
        violations: reports.length,
        level: 5,
      },
    });
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <style jsx global>{`
        .purple-neon {
          border: 2px solid #A78BFA;
          box-shadow: 0 0 15px rgba(167, 139, 250, 0.6), inset 0 0 15px rgba(167, 139, 250, 0.2);
        }

        .red-neon {
          border: 2px solid #F472B6;
          box-shadow: 0 0 15px rgba(244, 114, 182, 0.6), inset 0 0 15px rgba(244, 114, 182, 0.2);
        }
      `}</style>

      <div className="flex flex-col h-screen gap-3 p-3 md:flex-row">
        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Main Broadcaster Box */}
          <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden purple-neon min-h-0">
            {!isBroadcasting ? (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                <div className="text-center">
                  <Video size={48} className="mx-auto mb-4 text-purple-400" />
                  <p className="text-gray-400">{isInitializing ? "Initializing..." : "Camera unavailable"}</p>
                  <button
                    onClick={requestMediaPermissions}
                    disabled={isInitializing}
                    className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white transition"
                  >
                    {isInitializing ? "Setting up..." : "Request Permission"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-black/70 rounded px-3 py-1 text-xs font-bold">
                  {broadcastTitle}
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-600 px-3 py-1 rounded text-xs font-bold animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full" />
                  LIVE
                </div>
              </>
            )}
          </div>

          {/* Guest Boxes - 2x size */}
          {guests.length > 0 && (
            <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
              {guests.map((guest) => (
                <div
                  key={guest.id}
                  className="relative bg-gray-800 rounded-lg overflow-hidden purple-neon group"
                >
                  {!guest.isActive ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
                      <Video size={32} className="text-gray-500" />
                      <p className="text-sm text-gray-400 text-center">{guest.name}</p>
                      <button
                        onClick={() => handleGuestJoin(guest.id)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold transition"
                      >
                        Join
                      </button>
                    </div>
                  ) : (
                    <video className="w-full h-full object-cover bg-black" />
                  )}
                  <button
                    onClick={() => handleRemoveGuest(guest.id)}
                    className="absolute top-2 right-2 p-1 bg-red-600/80 hover:bg-red-700 rounded opacity-0 group-hover:opacity-100 transition"
                  >
                    <Minus size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Guest Controls */}
          <div className="flex gap-2 h-12">
            <button
              onClick={handleAddGuest}
              disabled={guests.length >= 5 || !isBroadcasting}
              className={`flex items-center justify-center gap-2 flex-1 rounded-lg font-bold transition ${
                guests.length >= 5 || !isBroadcasting
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700 transition purple-neon"
              }`}
            >
              <Plus size={18} />
              Add Guest
            </button>
            <button
              onClick={() => navigate("/tromody")}
              className="flex items-center justify-center gap-2 flex-1 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold transition"
            >
              🎪 Tromody Show
            </button>
            <button
              onClick={handleEndBroadcast}
              className="flex items-center justify-center gap-2 flex-1 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition red-neon"
            >
              <LogOut size={18} />
              End Stream
            </button>
          </div>
        </div>

        {/* Right Sidebar - Chat & Stats */}
        {sidebarVisible && (
        <div className="w-full md:w-80 flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-2 justify-between">
            {/* Stream Options Button */}
            <button
              onClick={() => setIsStreamOptionsOpen(!isStreamOptionsOpen)}
              className="flex-1 bg-purple-600 hover:bg-purple-700 rounded-lg p-3 font-bold flex items-center justify-center gap-2 transition purple-neon"
            >
              <Settings size={18} />
              <span className="hidden sm:inline">Options</span>
            </button>
            
            {/* Sidebar Toggle */}
            <button
              onClick={() => setSidebarVisible(false)}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-3 transition"
              title="Hide sidebar"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Chat - Reduced to 50% */}
          <div className="h-1/2 flex flex-col bg-gray-900 rounded-lg p-3 purple-neon min-h-0">
            <h3 className="text-xs font-bold mb-2 uppercase">Chat</h3>
            <div className="flex-1 overflow-y-auto text-xs text-gray-400 mb-2 min-h-0">
              <p>No messages yet</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type..."
                className="flex-1 bg-gray-800 border border-purple-500/30 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none"
              />
              <button className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold transition">
                Send
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-gray-900 rounded-lg p-3 red-neon">
            <h3 className="text-xs font-bold mb-3">Stats</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Viewers</span>
                <span className="font-bold">{viewerCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Trolls 👑</span>
                <span className="font-bold text-red-400">{trollCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Category</span>
                <span className="font-bold">{broadcastCategory}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Coins Earned</span>
                <span className="font-bold text-yellow-400">{coinsEarned}</span>
              </div>
              <button
                onClick={() => setIsCoinStoreOpen(true)}
                className="w-full mt-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs font-bold transition"
              >
                Open Store
              </button>
            </div>
          </div>

          {/* Quick Gifts - Purchased */}
          <div className="bg-gray-900 rounded-lg p-3 purple-neon">
            <h3 className="text-xs font-bold mb-2">Purchased Gifts</h3>
            <div className="grid grid-cols-3 gap-2">
              {purchasedGifts.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => {
                    if (selectedUser) {
                      alert(`Sent ${gift.name} ${gift.emoji} to ${selectedUser.name}!`);
                    } else {
                      alert("Click on a user to send them a gift");
                    }
                  }}
                  className="py-2 bg-gray-800 hover:bg-gray-700 rounded text-lg transition relative group"
                  title={gift.name}
                >
                  {gift.emoji}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap mb-1 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    {gift.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Leave Stream Button */}
          <button
            onClick={() => navigate("/")}
            className="w-full bg-red-600 hover:bg-red-700 rounded-lg p-2 font-bold text-xs transition flex items-center justify-center gap-2"
          >
            <LogOut size={14} />
            Leave Stream
          </button>
        </div>
        )}

        {/* Sidebar Toggle - Show Button */}
        {!sidebarVisible && (
          <button
            onClick={() => setSidebarVisible(true)}
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-3 transition h-fit"
            title="Show sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Stream Options Popup */}
      {isStreamOptionsOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-6 max-w-sm w-full purple-neon">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Stream Options</h3>
              <button
                onClick={() => setIsStreamOptionsOpen(false)}
                className="p-1 hover:bg-gray-800 rounded transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold block mb-2">Message Price (coins)</label>
                <input
                  type="number"
                  value={pricing.messagePrice}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      messagePrice: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full bg-gray-800 border border-purple-500/30 rounded px-3 py-2 text-white"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-bold block mb-2">Profile View Price (coins)</label>
                <input
                  type="number"
                  value={pricing.profileViewPrice}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      profileViewPrice: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full bg-gray-800 border border-purple-500/30 rounded px-3 py-2 text-white"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-bold block mb-2">Guest Box Price (coins)</label>
                <input
                  type="number"
                  value={pricing.guestBoxPrice}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      guestBoxPrice: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full bg-gray-800 border border-purple-500/30 rounded px-3 py-2 text-white"
                  min="0"
                />
              </div>
              <button
                onClick={() => setIsStreamOptionsOpen(false)}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded font-bold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Actions Menu */}
      {selectedUser && (
        <UserActionsMenu
          user={selectedUser}
          userRole={userRole}
          onClose={() => setSelectedUser(null)}
          onGift={handleGiftUser}
          onKick={() => handleKickUser(selectedUser.name)}
          onReport={() => handleReportUser(selectedUser.name)}
          onFollow={() => handleFollowUser(selectedUser.name)}
          onSummon={() => handleSummonToTrollCourt(selectedUser.name)}
        />
      )}

      {/* Entrance Effect Overlay */}
      {showEntranceEffect && entranceUser && (
        <EntranceEffect
          username={entranceUser.name}
          role={entranceUser.role}
        />
      )}

      {isCoinStoreOpen && (
        <CoinStoreModal
          onClose={() => setIsCoinStoreOpen(false)}
          onPurchase={(amount) => {
            setCoinCount(coinCount + amount);
            setIsCoinStoreOpen(false);
          }}
        />
      )}

      {selectedProfile && (
        <ProfileModal
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onSendCoins={(amount) => {
            setCoinCount(coinCount + amount);
            setSelectedProfile(null);
          }}
        />
      )}
    </div>
  );
}
