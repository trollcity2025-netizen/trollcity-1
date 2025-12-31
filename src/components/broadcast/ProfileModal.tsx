import { X, Send } from "lucide-react";
import { useState } from "react";

interface ProfileModalProps {
  profile: { name: string };
  onClose: () => void;
  onSendCoins?: (amount: number) => void;
}

export default function ProfileModal({
  profile,
  onClose,
  onSendCoins,
}: ProfileModalProps) {
  const [coinAmount, setCoinAmount] = useState(100);
  const [sent, setSent] = useState(false);

  const handleSendCoins = () => {
    onSendCoins?.(coinAmount);
    setSent(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-8 max-w-sm w-full purple-neon text-center">
        <div className="flex justify-end mb-4">
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-red-600 rounded-full flex items-center justify-center text-4xl font-bold">
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-2xl font-bold mb-2">{profile.name}</h2>
        <p className="text-gray-400 mb-6">@{profile.name.toLowerCase()}</p>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-2xl font-bold">2.5K</div>
            <div className="text-xs text-gray-400">Followers</div>
          </div>
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-2xl font-bold">842</div>
            <div className="text-xs text-gray-400">Following</div>
          </div>
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-2xl font-bold">1.2K</div>
            <div className="text-xs text-gray-400">Gifts</div>
          </div>
        </div>
        {!sent ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold block mb-2">Send Coins</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={coinAmount}
                  onChange={(e) =>
                    setCoinAmount(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="flex-1 bg-gray-800 text-white rounded px-3 py-2 text-center purple-neon"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {[50, 100, 500].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setCoinAmount(amount)}
                  className={`flex-1 py-1 text-xs rounded font-bold transition-all ${
                    coinAmount === amount
                      ? "bg-purple-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {amount}
                </button>
              ))}
            </div>
            <button
              onClick={handleSendCoins}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-700 hover:to-red-700 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
            >
              <Send size={18} />
              Send {coinAmount} Coins
            </button>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">✨</div>
            <p className="text-lg font-bold text-purple-300">Coins Sent!</p>
            <p className="text-sm text-gray-400">+{coinAmount} coins</p>
          </div>
        )}
      </div>
    </div>
  );
}
