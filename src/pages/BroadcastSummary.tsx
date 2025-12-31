import { useLocation, useNavigate } from "react-router-dom";
import { Gift, Heart, Users, AlertCircle, TrendingUp, X } from "lucide-react";

interface SummaryData {
  title: string;
  category: string;
  duration: number;
  totalGifts: number;
  totalCoins: number;
  coinsPerDollar: number;
  viewerCount: number;
  newFollowers: string[];
  reports: string[];
  violations: number;
  level: number;
}

export default function BroadcastSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const data = (location.state as any) || {
    title: "My Stream",
    category: "Just Chatting",
    duration: 3600,
    totalGifts: 2450,
    totalCoins: 12500,
    coinsPerDollar: 100,
    viewerCount: 245,
    newFollowers: ["User123", "StreamFan", "TrollKing"],
    reports: ["Toxicity"],
    violations: 0,
    level: 5,
  };

  const estimatedEarnings = (data.totalCoins / data.coinsPerDollar).toFixed(2);
  const durationMinutes = Math.floor(data.duration / 60);
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white p-4">
      <style jsx global>{`
        .purple-neon {
          border: 2px solid #A78BFA;
          box-shadow: 0 0 15px rgba(167, 139, 250, 0.6), inset 0 0 15px rgba(167, 139, 250, 0.2);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideIn {
          animation: slideIn 0.5s ease-out;
        }
      `}</style>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 animate-slideIn">
          <h1 className="text-4xl font-black mb-2 text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
            Stream Summary
          </h1>
          <p className="text-gray-400">Thanks for streaming with us!</p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-slideIn">
          {/* Earnings */}
          <div className="bg-gray-900/80 rounded-lg p-6 purple-neon">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp size={24} className="text-green-400" />
              <h3 className="text-lg font-bold">Earnings</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Coins Earned</span>
                <span className="font-bold text-yellow-400">{data.totalCoins.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Estimated USD</span>
                <span className="font-bold text-green-400">${estimatedEarnings}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Rate</span>
                <span>{data.coinsPerDollar} coins = $1</span>
              </div>
            </div>
          </div>

          {/* Stream Info */}
          <div className="bg-gray-900/80 rounded-lg p-6 purple-neon">
            <div className="flex items-center gap-3 mb-4">
              <Users size={24} className="text-blue-400" />
              <h3 className="text-lg font-bold">Stream Info</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Category</span>
                <span className="font-bold">{data.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Duration</span>
                <span className="font-bold">
                  {durationHours}h {remainingMinutes}m
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Peak Viewers</span>
                <span className="font-bold">{data.viewerCount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Gifts */}
          <div className="bg-gray-900/80 rounded-lg p-6 purple-neon">
            <div className="flex items-center gap-3 mb-4">
              <Gift size={24} className="text-pink-400" />
              <h3 className="text-lg font-bold">Gifts Received</h3>
            </div>
            <div className="text-3xl font-bold text-pink-400 mb-2">
              {data.totalGifts.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400">Total gifts sent during stream</p>
          </div>

          {/* Performance */}
          <div className="bg-gray-900/80 rounded-lg p-6 purple-neon">
            <div className="flex items-center gap-3 mb-4">
              <Heart size={24} className="text-red-400" />
              <h3 className="text-lg font-bold">Performance</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Level</span>
                <span className="font-bold text-purple-300">Level {data.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Violations</span>
                <span className={`font-bold ${data.violations === 0 ? "text-green-400" : "text-red-400"}`}>
                  {data.violations}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* New Followers */}
        {data.newFollowers.length > 0 && (
          <div className="bg-gray-900/80 rounded-lg p-6 purple-neon mb-6 animate-slideIn">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users size={20} />
              New Followers ({data.newFollowers.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.newFollowers.map((follower, idx) => (
                <div
                  key={idx}
                  className="bg-gray-800/50 rounded p-3 text-center text-sm font-semibold text-purple-300 hover:bg-gray-800 transition"
                >
                  {follower}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reports */}
        {data.reports.length > 0 && (
          <div className="bg-gray-900/80 rounded-lg p-6 border-2 border-red-600/50 mb-6 animate-slideIn">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-400">
              <AlertCircle size={20} />
              Reports ({data.reports.length})
            </h3>
            <div className="space-y-2">
              {data.reports.map((report, idx) => (
                <div key={idx} className="bg-red-900/20 rounded p-3 text-sm text-red-300">
                  • {report}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center animate-slideIn">
          <button
            onClick={() => navigate("/go-live")}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition purple-neon"
          >
            Go Live Again
          </button>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
          >
            Return Home
          </button>
        </div>
      </div>
    </div>
  );
}
