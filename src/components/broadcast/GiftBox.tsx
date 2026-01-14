import React, { useState } from "react";
import { Gift, Users, Crown } from "lucide-react";
import { getGiftEmoji } from "../../lib/giftIcons";
import { useAuthStore } from "../../lib/store";

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  value: number;
  category: string;
}

export type RecipientMode = "all" | "broadcaster";

interface GiftBoxProps {
  onSendGift?: (gift: GiftItem, recipientMode: RecipientMode) => void;
  gifts: GiftItem[];
  loading?: boolean;
  loadError?: string | null;
}

export default function GiftBox({ onSendGift, gifts, loading, loadError }: GiftBoxProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("broadcaster");
  const { profile } = useAuthStore();
  const balance = profile?.troll_coins ?? 0;

  const handleGiftClick = (gift: GiftItem) => {
    onSendGift?.(gift, recipientMode);
  };

  return (
    <div className="bg-[#0b091f] border-b border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gift size={18} className="text-purple-400" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-white/70">Quick Gifts</p>
            <p className="text-[10px] text-white/40">Tap any icon to send a single gift</p>
          </div>
        </div>
        <div className="text-[10px] text-white/60">
          Balance: {balance.toLocaleString()} coins
        </div>
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-white/40 hover:text-white text-sm"
        >
          {isExpanded ? "Hide" : "Show"}
        </button>
      </div>

      {loadError && (
        <div className="text-[10px] text-red-400 mb-2">
          {loadError}
        </div>
      )}

      <div className="flex gap-2 mb-3 text-xs font-semibold">
        <button
          onClick={() => setRecipientMode("all")}
          className={`flex-1 py-1 rounded-full border ${
            recipientMode === "all"
              ? "border-purple-500 bg-purple-500/20 text-white"
              : "border-white/10 text-white/60"
          }`}
        >
          <Users size={12} className="inline-block mr-1" />
          All Users
        </button>
        <button
          onClick={() => setRecipientMode("broadcaster")}
          className={`flex-1 py-1 rounded-full border ${
            recipientMode === "broadcaster"
              ? "border-yellow-500 bg-yellow-500/20 text-white"
              : "border-white/10 text-white/60"
          }`}
        >
          <Crown size={12} className="inline-block mr-1" />
          Broadcaster
        </button>
      </div>

      {isExpanded && (
        <>
          {loading && gifts.length === 0 ? (
            <div className="text-[10px] text-white/60">
              Loading Quick Gifts...
            </div>
          ) : gifts.length === 0 ? (
            <div className="text-[10px] text-white/60">
              No Quick Gifts available.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
              {gifts.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => handleGiftClick(gift)}
                  className="flex flex-col items-center gap-1 p-2 bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 hover:border-white/20 transition-colors"
                >
                  <span className="text-2xl">{getGiftEmoji(gift.icon, gift.name)}</span>
                  <span className="text-[10px] text-white/70 text-center break-words">
                    {gift.name}
                  </span>
                  <span className="text-xs font-bold text-yellow-400">{gift.value} coins</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
