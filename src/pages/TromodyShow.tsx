import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Send, Trophy, ArrowLeft } from "lucide-react";

interface Viewer {
  id: string;
  name: string;
  avatar: string;
  coins: number;
}

const GIFT_AMOUNTS = [10, 50, 100, 500, 1000, 5000];
const BATTLE_DURATION = 180;

export default function TromodyShow() {
  const navigate = useNavigate();
  const [timeRemaining, setTimeRemaining] = useState(BATTLE_DURATION);
  const [broadcaster1Coins, setBroadcaster1Coins] = useState(0);
  const [broadcaster2Coins, setBroadcaster2Coins] = useState(0);
  const [selectedGiftAmount, setSelectedGiftAmount] = useState(100);
  const [chatMessages, setChatMessages] = useState<{ user: string; message: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [battleEnded, setBattleEnded] = useState(false);
  const [viewer1Data, setViewer1Data] = useState<Viewer[]>([
    { id: "v1", name: "Viewer1", avatar: "👤", coins: 150 },
    { id: "v2", name: "Viewer2", avatar: "👥", coins: 280 },
    { id: "v3", name: "TrollKing", avatar: "👑", coins: 420 },
  ]);
  const [viewer2Data, setViewer2Data] = useState<Viewer[]>([
    { id: "v4", name: "StreamFan", avatar: "⭐", coins: 200 },
    { id: "v5", name: "VlogMaster", avatar: "🎬", coins: 310 },
    { id: "v6", name: "GiftGiver", avatar: "🎁", coins: 500 },
  ]);

  useEffect(() => {
    if (timeRemaining > 0 && !battleEnded) {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && !battleEnded) {
      setBattleEnded(true);
    }
  }, [timeRemaining, battleEnded]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const winner = broadcaster1Coins > broadcaster2Coins ? "Broadcaster 1" : broadcaster2Coins > broadcaster1Coins ? "Broadcaster 2" : "Tie";
  const prizePool = broadcaster1Coins + broadcaster2Coins;

  const handleGiftBroadcaster1 = () => {
    setBroadcaster1Coins(broadcaster1Coins + selectedGiftAmount);
    setChatMessages([
      ...chatMessages,
      { user: "You", message: `Sent ${selectedGiftAmount} coins to Broadcaster 1! 🎁` },
    ]);
  };

  const handleGiftBroadcaster2 = () => {
    setBroadcaster2Coins(broadcaster2Coins + selectedGiftAmount);
    setChatMessages([
      ...chatMessages,
      { user: "You", message: `Sent ${selectedGiftAmount} coins to Broadcaster 2! 🎁` },
    ]);
  };

  const handleSendChat = () => {
    if (chatInput.trim()) {
      setChatMessages([...chatMessages, { user: "You", message: chatInput }]);
      setChatInput("");
    }
  };

  if (battleEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <div className="mb-8">
            <Trophy size={80} className="mx-auto text-yellow-400 mb-4 animate-bounce" />
            <h1 className="text-5xl font-black mb-4 text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text">
              Battle Complete!
            </h1>
          </div>

          <div className="bg-gray-900/80 rounded-xl p-8 border-2 border-purple-500/30 mb-8">
            <h2 className="text-3xl font-bold mb-4">
              {winner === "Tie" ? "It's a Tie!" : `${winner} Wins!`}
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className={`p-6 rounded-lg ${broadcaster1Coins > broadcaster2Coins ? "bg-yellow-500/20 border-2 border-yellow-500" : "bg-gray-800/50"}`}>
                <p className="text-sm text-gray-400 mb-2">Broadcaster 1</p>
                <p className="text-3xl font-bold text-yellow-400">{broadcaster1Coins}</p>
              </div>
              <div className={`p-6 rounded-lg ${broadcaster2Coins > broadcaster1Coins ? "bg-yellow-500/20 border-2 border-yellow-500" : "bg-gray-800/50"}`}>
                <p className="text-sm text-gray-400 mb-2">Broadcaster 2</p>
                <p className="text-3xl font-bold text-yellow-400">{broadcaster2Coins}</p>
              </div>
            </div>
            <p className="text-xl font-bold text-purple-300 mb-8">
              Prize Pool: {prizePool} coins
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate("/tromody")}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition"
            >
              Watch Another Battle
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-8 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition flex items-center gap-2"
            >
              <ArrowLeft size={18} />
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <style jsx global>{`
        .purple-neon {
          border: 2px solid #A78BFA;
          box-shadow: 0 0 15px rgba(167, 139, 250, 0.6), inset 0 0 15px rgba(167, 139, 250, 0.2);
        }
      `}</style>

      <div className="flex flex-col h-screen">
        {/* Timer Banner */}
        <div className="h-16 bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center purple-neon">
          <div className="text-center">
            <p className="text-xs text-white/80 uppercase tracking-wider">Battle Time</p>
            <p className="text-4xl font-black text-white">{formatTime(timeRemaining)}</p>
          </div>
        </div>

        {/* Main Battle Area */}
        <div className="flex-1 flex gap-3 p-3">
          {/* Left Broadcaster */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <div className="flex-1 relative bg-gradient-to-br from-purple-900 to-purple-800 rounded-lg overflow-hidden purple-neon">
              <video
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 bg-black/70 rounded-lg p-3">
                <p className="text-sm font-bold">Broadcaster 1</p>
                <p className="text-2xl font-black text-yellow-400">{broadcaster1Coins} 🪙</p>
              </div>
              {broadcaster1Coins > broadcaster2Coins && (
                <div className="absolute top-4 right-4 text-4xl animate-bounce">
                  👑
                </div>
              )}
            </div>

            {/* Viewer Grid 1 */}
            <div className="grid grid-cols-3 gap-2 h-24">
              {viewer1Data.map((viewer) => (
                <div
                  key={viewer.id}
                  className="bg-gray-800 rounded-lg p-2 flex flex-col items-center justify-center text-center text-xs"
                >
                  <div className="text-2xl mb-1">{viewer.avatar}</div>
                  <p className="font-bold truncate w-full">{viewer.name}</p>
                  <p className="text-yellow-400 text-xs">{viewer.coins} 🪙</p>
                </div>
              ))}
            </div>

            {/* Gift Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleGiftBroadcaster1}
                className="py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition flex items-center justify-center gap-1 text-sm purple-neon"
              >
                <Gift size={16} />
                Gift
              </button>
              <button
                onClick={handleGiftBroadcaster1}
                className="py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition text-sm"
              >
                {selectedGiftAmount} 🪙
              </button>
              <div></div>
            </div>
          </div>

          {/* Right Broadcaster */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <div className="flex-1 relative bg-gradient-to-br from-pink-900 to-pink-800 rounded-lg overflow-hidden purple-neon">
              <video
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 bg-black/70 rounded-lg p-3">
                <p className="text-sm font-bold">Broadcaster 2</p>
                <p className="text-2xl font-black text-yellow-400">{broadcaster2Coins} 🪙</p>
              </div>
              {broadcaster2Coins > broadcaster1Coins && (
                <div className="absolute top-4 right-4 text-4xl animate-bounce">
                  👑
                </div>
              )}
            </div>

            {/* Viewer Grid 2 */}
            <div className="grid grid-cols-3 gap-2 h-24">
              {viewer2Data.map((viewer) => (
                <div
                  key={viewer.id}
                  className="bg-gray-800 rounded-lg p-2 flex flex-col items-center justify-center text-center text-xs"
                >
                  <div className="text-2xl mb-1">{viewer.avatar}</div>
                  <p className="font-bold truncate w-full">{viewer.name}</p>
                  <p className="text-yellow-400 text-xs">{viewer.coins} 🪙</p>
                </div>
              ))}
            </div>

            {/* Gift Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleGiftBroadcaster2}
                className="py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition flex items-center justify-center gap-1 text-sm purple-neon"
              >
                <Gift size={16} />
                Gift
              </button>
              <button
                onClick={handleGiftBroadcaster2}
                className="py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition text-sm"
              >
                {selectedGiftAmount} 🪙
              </button>
              <div></div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-80 flex flex-col gap-3 min-w-0">
            {/* Gift Amount Selector */}
            <div className="bg-gray-900 rounded-lg p-3 purple-neon">
              <h3 className="text-xs font-bold mb-2 uppercase">Gift Amount</h3>
              <div className="grid grid-cols-2 gap-2">
                {GIFT_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setSelectedGiftAmount(amount)}
                    className={`py-2 rounded text-xs font-bold transition ${
                      selectedGiftAmount === amount
                        ? "bg-purple-600 text-white purple-neon"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat */}
            <div className="flex-1 bg-gray-900 rounded-lg p-3 purple-neon min-h-0 flex flex-col">
              <h3 className="text-xs font-bold mb-2 uppercase">Live Chat</h3>
              <div className="flex-1 overflow-y-auto mb-2 min-h-0 space-y-2 text-xs">
                {chatMessages.length === 0 ? (
                  <p className="text-gray-500">No messages yet...</p>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className="text-gray-300">
                      <span className="font-bold text-purple-300">{msg.user}:</span> {msg.message}
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Say something..."
                  className="flex-1 bg-gray-800 border border-purple-500/30 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleSendChat}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded transition"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>

            {/* Exit Button */}
            <button
              onClick={() => navigate("/")}
              className="py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-xs transition flex items-center justify-center gap-2"
            >
              <ArrowLeft size={14} />
              Exit Battle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
