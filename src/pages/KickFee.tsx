import { useNavigate } from "react-router-dom";
import { AlertCircle, CreditCard, Home } from "lucide-react";
import { useState } from "react";

export default function KickFee() {
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<"coins" | "paypal" | null>(null);
  const kickCount = localStorage.getItem("kickCount") ? parseInt(localStorage.getItem("kickCount")!) : 0;
  const reinstatementFee = 500 + kickCount * 500;

  const handlePayWithCoins = () => {
    alert(`Paid ${reinstatementFee} coins to rejoin streams!`);
    localStorage.removeItem("kickCount");
    navigate("/");
  };

  const handlePayWithPayPal = () => {
    alert("Redirecting to PayPal...");
    alert(`Paid $${(reinstatementFee / 100).toFixed(2)} to rejoin streams!`);
    localStorage.removeItem("kickCount");
    navigate("/");
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
            <AlertCircle size={48} className="text-red-400" />
          </div>

          <h1 className="text-3xl font-black text-center mb-4 text-red-400">
            Stream Access Suspended
          </h1>

          <p className="text-center text-gray-300 mb-6">
            You were kicked from a broadcast. Pay the reinstatement fee to rejoin streams.
          </p>

          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-red-500/30">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Kicks on Record:</span>
              <span className="font-bold text-red-400">{kickCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Reinstatement Fee:</span>
              <span className="font-bold text-yellow-400">{reinstatementFee} 🪙</span>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Each additional kick increases fee by 500 coins
            </p>
          </div>

          {kickCount >= 3 && (
            <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-4 mb-6">
              <p className="text-orange-300 font-bold text-sm">
                ⚠️ Warning: {3 - kickCount} more kicks will result in IP ban
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handlePayWithCoins}
              className="w-full py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 rounded-lg font-bold transition flex items-center justify-center gap-2"
            >
              💰 Pay {reinstatementFee} Coins
            </button>

            <button
              onClick={handlePayWithPayPal}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-lg font-bold transition flex items-center justify-center gap-2"
            >
              <CreditCard size={18} />
              Pay via PayPal
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
            Repeated offenses may result in ban or IP ban. You can appeal penalties in Troll Court.
          </p>
        </div>
      </div>
    </div>
  );
}
