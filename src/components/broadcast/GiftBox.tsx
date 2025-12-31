import { Gift } from "lucide-react";

interface GiftBoxProps {
  onSendGift?: (gift: { id: number; coins: number }, recipient?: string) => void;
}

export default function GiftBox({ onSendGift }: GiftBoxProps) {
  const gifts = [
    { id: 1, name: "Rose", emoji: "🌹", coins: 10 },
    { id: 2, name: "Heart", emoji: "💗", coins: 50 },
    { id: 3, name: "Diamond", emoji: "💎", coins: 100 },
  ];

  return (
    <div className="bg-gradient-to-b from-gray-900 to-black rounded-lg p-4 purple-neon">
      <div className="flex items-center gap-2 mb-3">
        <Gift size={16} />
        <h3 className="text-sm font-bold">QUICK GIFTS</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {gifts.map((gift) => (
          <button
            key={gift.id}
            onClick={() => onSendGift?.(gift)}
            className="flex flex-col items-center gap-1 p-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
          >
            <div className="text-2xl">{gift.emoji}</div>
            <span className="text-xs text-gray-300">{gift.coins}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
