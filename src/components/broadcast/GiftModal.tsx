import { X, Coins, Zap } from "lucide-react";
import { useState } from "react";

const gifts = [
  { id: 0, name: "Troll", emoji: "🧟", coins: 1, rarity: 'troll', color: 'from-green-500 to-emerald-700' },
  { id: 1, name: "Rose", emoji: "🌹", coins: 10, rarity: 'common', color: 'from-red-500 to-rose-700' },
  { id: 2, name: "Heart", emoji: "💗", coins: 50, rarity: 'common', color: 'from-pink-500 to-fuchsia-700' },
  { id: 3, name: "Diamond", emoji: "💎", coins: 100, rarity: 'rare', color: 'from-blue-400 to-cyan-600' },
  { id: 4, name: "Crown", emoji: "👑", coins: 500, rarity: 'legendary', color: 'from-yellow-400 to-amber-600' },
  { id: 5, name: "Fireworks", emoji: "🎆", coins: 1000, rarity: 'legendary', color: 'from-purple-500 to-violet-700' },
  { id: 6, name: "Rocket", emoji: "🚀", coins: 5000, rarity: 'legendary', color: 'from-orange-500 to-red-600' },
];

export default function GiftModal({ onClose, onSendGift, recipientName, profile }) {
  const [selectedGift, setSelectedGift] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const handleSendGift = () => {
    if (!selectedGift) return;
    const giftPayload = { ...selectedGift, quantity };
    if (typeof onSendGift === 'function') onSendGift(giftPayload);
    setQuantity(1);
    if (typeof onClose === 'function') onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4 animate-fadeIn">
      <div className="bg-[#0b091f] sm:rounded-3xl rounded-t-3xl border border-purple-500/20 w-full max-w-md flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(139,92,246,0.3)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-[#120f24] to-[#0b091f]">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-yellow-400 fill-yellow-400 animate-pulse" />
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200 uppercase tracking-wide">
                Gift Shop
              </h2>
            </div>
            {recipientName && (
              <p className="text-xs text-purple-400 font-medium mt-1 pl-7">
                Sending to <span className="text-white">{recipientName}</span>
              </p>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Balance */}
        <div className="px-6 py-3 bg-[#080613] flex justify-between items-center border-b border-white/5">
          <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Your Balance</span>
          <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-600/20 to-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/30">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 font-bold text-sm">
              {profile?.troll_coins?.toLocaleString() || 0}
            </span>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {gifts.map((gift) => (
              <button
                key={gift.id}
                onClick={() => setSelectedGift(gift)}
                className={`group relative p-3 rounded-2xl transition-all duration-300 border flex flex-col items-center gap-2 ${
                  selectedGift?.id === gift.id
                    ? "bg-purple-600/20 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                    : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 hover:-translate-y-1"
                }`}
              >
                <div className="text-4xl group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">
                  {gift.emoji}
                </div>
                <div className="w-full text-center">
                  <div className="text-xs font-bold text-white truncate w-full">{gift.name}</div>
                  <div className="text-[10px] font-bold text-yellow-400 flex items-center justify-center gap-1 mt-1">
                    <Coins size={10} /> {gift.coins}
                  </div>
                </div>
                
                {selectedGift?.id === gift.id && (
                  <div className="absolute inset-0 rounded-2xl border-2 border-purple-500 animate-pulse pointer-events-none" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer / Send */}
        <div className="p-6 bg-[#080613] border-t border-white/5 rounded-b-3xl">
          {selectedGift ? (
            <div className="flex flex-col gap-4 animate-slideUp">
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/5">
                <span className="text-sm font-bold text-white/70">Quantity</span>
                <div className="flex items-center gap-4">
                   <button 
                     onClick={() => setQuantity(Math.max(1, quantity - 1))}
                     className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                   >
                     -
                   </button>
                   <span className="text-lg font-bold w-8 text-center">{quantity}</span>
                   <button 
                     onClick={() => setQuantity(quantity + 1)}
                     className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                   >
                     +
                   </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs text-white/50">Total Cost</span>
                  <span className="text-lg font-bold text-yellow-400 flex items-center gap-1">
                    <Coins size={16} /> {(selectedGift.coins * quantity).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={handleSendGift}
                  className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95 bg-gradient-to-r ${selectedGift.color}`}
                >
                  Send Gift
                </button>
              </div>
            </div>
          ) : (
            <button
              disabled
              className="w-full py-4 bg-white/5 rounded-xl font-bold text-white/30 cursor-not-allowed border border-white/5"
            >
              Select a gift to send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
