import { useNavigate } from "react-router-dom";
import { AlertCircle, Scale, Home } from "lucide-react";
import { useState } from "react";

export default function BanFee() {
  const navigate = useNavigate();
  const banDays = localStorage.getItem("banDays") ? parseInt(localStorage.getItem("banDays")!) : 7;
  const banFee = 2000;

  const handlePayForAppeal = () => {
    alert(`Paid ${banFee} coins to appeal ban in Troll Court!`);
    localStorage.removeItem("banDays");
    navigate("/troll-court");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white flex items-center justify-center p-4">
      <style jsx global>{`
        .purple-neon {
          border: 2px solid #A78BFA;
          box-shadow: 0 0 15px rgba(167, 139, 250, 0.6), inset 0 0 15px rgba(167, 139, 250, 0.2);
        }
      `}</style>

      <div className="max-w-md w-full">
        <div className="bg-gray-900/80 rounded-xl p-8 purple-neon">
          <div className="flex items-center justify-center mb-6">
            <AlertCircle size={48} className="text-red-500" />
          </div>

          <h1 className="text-3xl font-black text-center mb-4 text-red-400">
            Account Banned
          </h1>

          <p className="text-center text-gray-300 mb-6">
            Your account has been banned. You can appeal this decision in Troll Court.
          </p>

          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-red-500/30">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Ban Duration:</span>
              <span className="font-bold text-red-400">{banDays} Days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Appeal Fee:</span>
              <span className="font-bold text-yellow-400">{banFee} 🪙</span>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Pay to join Troll Court and appeal your ban
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handlePayForAppeal}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition flex items-center justify-center gap-2 purple-neon"
            >
              <Scale size={18} />
              Appeal in Troll Court ({banFee} 🪙)
            </button>

            <button
              onClick={() => navigate("/")}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition flex items-center justify-center gap-2 text-gray-300"
            >
              <Home size={18} />
              Return Home
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            During your ban, you can still access Troll Court to appeal. Your case will be reviewed by officers.
          </p>
        </div>
      </div>
    </div>
  );
}
