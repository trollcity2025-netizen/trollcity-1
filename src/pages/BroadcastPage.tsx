import { useState } from "react";
import { Heart, Gift, Settings, Plus, Minus } from "lucide-react";
import ChatBox from "@/components/broadcast/ChatBox";
import StatsPanel from "@/components/broadcast/StatsPanel";
import GiftModal from "@/components/broadcast/GiftModal";
import ProfileModal from "@/components/broadcast/ProfileModal";
import ParticipantBoxes from "@/components/broadcast/ParticipantBoxes";
import GiftBox from "@/components/broadcast/GiftBox";
import CoinStoreModal from "@/components/broadcast/CoinStoreModal";

interface Participant {
  id: number;
  name: string;
  color: string;
  isSpeaking: boolean;
}

export default function BroadcastPage() {
  const [viewerCount, setViewerCount] = useState(1284);
  const [trollLikeCount, setTrollLikeCount] = useState(3421);
  const [coinCount, setCoinCount] = useState(5280);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{
    name: string;
  } | null>(null);
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([
    { id: 1, name: "Participant 1", color: "#A78BFA", isSpeaking: false },
  ]);
  const [broadcasterSpeaking, setBroadcasterSpeaking] = useState(false);

  const handleAddParticipant = () => {
    const newId = Math.max(...participants.map((p) => p.id), 0) + 1;
    const colors = ["#A78BFA", "#F472B6", "#FB923C", "#34D399", "#60A5FA"];
    setParticipants([
      ...participants,
      {
        id: newId,
        name: `Participant ${newId}`,
        color: colors[newId % colors.length],
        isSpeaking: false,
      },
    ]);
  };

  const handleRemoveParticipant = (id: number) => {
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const handleTrollLike = () => {
    setTrollLikeCount(trollLikeCount + 1);
  };

  const handleGiftSent = (amount: number) => {
    setCoinCount(coinCount + amount);
    setIsGiftModalOpen(false);
  };

  const handleCoinsPurchased = (amount: number) => {
    setCoinCount(coinCount + amount);
    setIsCoinStoreOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-hidden">
      <style jsx global>{`
        @keyframes rgbRotate {
          0% {
            border-color: rgb(255, 0, 0);
            box-shadow: 0 0 20px rgb(255, 0, 0), inset 0 0 20px rgba(255, 0, 0, 0.3);
          }
          33% {
            border-color: rgb(0, 255, 0);
            box-shadow: 0 0 20px rgb(0, 255, 0), inset 0 0 20px rgba(0, 255, 0, 0.3);
          }
          66% {
            border-color: rgb(0, 0, 255);
            box-shadow: 0 0 20px rgb(0, 0, 255), inset 0 0 20px rgba(0, 0, 255, 0.3);
          }
          100% {
            border-color: rgb(255, 0, 0);
            box-shadow: 0 0 20px rgb(255, 0, 0), inset 0 0 20px rgba(255, 0, 0, 0.3);
          }
        }

        .rgb-neon {
          animation: rgbRotate 2s infinite;
          border: 2px solid;
        }

        .purple-neon {
          border: 2px solid #A78BFA;
          box-shadow: 0 0 15px rgba(167, 139, 250, 0.6), inset 0 0 15px rgba(167, 139, 250, 0.2);
        }

        .red-neon {
          border: 2px solid #F472B6;
          box-shadow: 0 0 15px rgba(244, 114, 182, 0.6), inset 0 0 15px rgba(244, 114, 182, 0.2);
        }

        .purple-neon:hover {
          box-shadow: 0 0 25px rgba(167, 139, 250, 0.8), inset 0 0 15px rgba(167, 139, 250, 0.3);
        }

        .red-neon:hover {
          box-shadow: 0 0 25px rgba(244, 114, 182, 0.8), inset 0 0 15px rgba(244, 114, 182, 0.3);
        }
      `}</style>

      <div className="flex h-screen gap-4 p-4">
        <div className="flex-1 flex flex-col gap-4">
          <div
            className="flex-[2] bg-gradient-to-br from-gray-900 to-black rounded-lg overflow-hidden relative"
            style={{
              border: broadcasterSpeaking ? "2px solid" : "2px solid #A78BFA",
              boxShadow: broadcasterSpeaking
                ? "0 0 15px rgba(167, 139, 250, 0.6), inset 0 0 15px rgba(167, 139, 250, 0.2)"
                : "0 0 15px rgba(167, 139, 250, 0.6), inset 0 0 15px rgba(167, 139, 250, 0.2)",
              animation: broadcasterSpeaking ? "rgbRotate 2s infinite" : "none",
            }}
          >
            <video
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              src="https://www.w3schools.com/html/mov_bbb.mp4"
            />

            <div className="absolute top-4 left-4 bg-black/70 rounded-lg px-4 py-2 purple-neon text-sm">
              <span className="font-bold">StreamMaster</span>
            </div>

            <div className="absolute top-16 left-4 bg-black/70 rounded-lg px-4 py-2 purple-neon text-xs">
              <span className="font-bold">{viewerCount.toLocaleString()}</span>{" "}
              watching
            </div>

            <div className="absolute bottom-4 left-4 flex gap-2 bg-black/70 rounded-lg p-3 purple-neon">
              <button
                onClick={handleAddParticipant}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded transition-colors"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={() => {
                  if (participants.length > 1) {
                    handleRemoveParticipant(
                      participants[participants.length - 1].id
                    );
                  }
                }}
                disabled={participants.length === 1}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-2 rounded transition-colors"
              >
                <Minus size={18} />
              </button>
            </div>

            <button
              onClick={handleTrollLike}
              className="absolute bottom-4 right-4 flex items-center gap-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 px-4 py-2 rounded-lg font-bold text-white transition-all hover:scale-110 active:scale-95 red-neon"
            >
              <Heart size={20} fill="currentColor" />
              {trollLikeCount}
            </button>

            <div className="absolute top-4 right-4 flex gap-2">
              <button className="p-2 bg-black/70 rounded-lg purple-neon hover:bg-black/80 transition-colors">
                <Settings size={20} />
              </button>
            </div>
          </div>

          {participants.length > 0 && (
            <ParticipantBoxes
              participants={participants}
              onRemove={handleRemoveParticipant}
            />
          )}
        </div>

        <div className="w-1/3 flex flex-col gap-4 min-w-0">
          <ChatBox
            onProfileClick={setSelectedProfile}
            onCoinSend={(userId, amount) => {
              setCoinCount(coinCount + amount);
            }}
          />

          <StatsPanel
            viewers={viewerCount}
            trollCount={trollLikeCount}
            coins={coinCount}
            onStoreClick={() => setIsCoinStoreOpen(true)}
          />

          <GiftBox
            onSendGift={(gift, recipient) => {
              setCoinCount(coinCount + gift.coins);
            }}
          />
        </div>
      </div>

      {isGiftModalOpen && (
        <GiftModal
          onClose={() => setIsGiftModalOpen(false)}
          onSendGift={handleGiftSent}
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

      {isCoinStoreOpen && (
        <CoinStoreModal
          onClose={() => setIsCoinStoreOpen(false)}
          onPurchase={handleCoinsPurchased}
        />
      )}
    </div>
  );
}
