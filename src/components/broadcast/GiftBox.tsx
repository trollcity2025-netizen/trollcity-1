import React, { useMemo, useState } from "react";
import { Gift, Users, Crown, Sparkles } from "lucide-react";
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
  onShowCoinStore?: () => void;
}

export default function GiftBox({ onSendGift, gifts, loading, loadError, onShowCoinStore }: GiftBoxProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("broadcaster");
  const { profile } = useAuthStore();
  const balance = profile?.troll_coins ?? 0;

  // Surface the priciest gifts first to mirror big broadcast apps
  const sortedGifts = useMemo(() => {
    return [...gifts].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [gifts]);

  const handleGiftClick = (gift: GiftItem) => {
    if (balance < gift.value) {
      onShowCoinStore?.();
    } else {
      onSendGift?.(gift, recipientMode);
    }
  };

  return (
    <div className="bg-gradient-to-b from-[#0e0a22] via-[#0c091b] to-[#0a0815] rounded-2xl border border-white/10 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-600/20 border border-purple-400/40 flex items-center justify-center text-purple-200 shadow-[0_0_25px_rgba(168,85,247,0.45)]">
              <Gift size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] uppercase text-white/80">Quick Gifts</p>
              <p className="text-xs text-white/50">Tap to send instantly</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/70 bg-white/5 border border-white/10 rounded-full px-3 py-1">
            <Sparkles size={14} className="text-yellow-300" />
            <span className="font-semibold">Balance {balance.toLocaleString()} coins</span>
          </div>
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-xs px-3 py-1 rounded-full border border-white/15 bg-white/5 text-white/70 hover:text-white"
          >
            {isExpanded ? "Hide" : "Show"}
          </button>
        </div>

      {loadError && (
        <div className="text-[10px] text-red-400 mb-2">
          {loadError}
        </div>
      )}

        <div className="flex gap-2 text-xs font-semibold">
          <button
            onClick={() => setRecipientMode("all")}
            className={`flex-1 py-2 rounded-full border transition-all ${
              recipientMode === "all"
                ? "border-purple-400 bg-purple-500/20 text-white shadow-[0_0_25px_rgba(168,85,247,0.35)]"
                : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
            }`}
          >
            <Users size={14} className="inline-block mr-1" />
            All Viewers
          </button>
          <button
            onClick={() => setRecipientMode("broadcaster")}
            className={`flex-1 py-2 rounded-full border transition-all ${
              recipientMode === "broadcaster"
                ? "border-amber-300 bg-amber-400/15 text-white shadow-[0_0_25px_rgba(252,211,77,0.35)]"
                : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
            }`}
          >
            <Crown size={14} className="inline-block mr-1" />
            Broadcaster
          </button>
        </div>

        {isExpanded && (
          <>
            {loading && sortedGifts.length === 0 ? (
              <div className="text-[11px] text-white/70">Loading Quick Gifts...</div>
            ) : sortedGifts.length === 0 ? (
              <div className="text-[11px] text-white/70">No Quick Gifts available.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 max-h-[580px] overflow-y-auto pr-1 custom-scrollbar pt-2">
                {sortedGifts.map((gift) => {
                  const isPremium = gift.category === "Epic" || gift.category === "Legendary";
                  const baseClasses =
                    "flex flex-col items-center gap-2 p-3 md:p-4 rounded-2xl transition-all text-center hover:-translate-y-[1px]";
                  const premiumClasses =
                    "bg-gradient-to-b from-yellow-500/25 via-yellow-500/12 to-transparent border border-yellow-400/60 shadow-[0_10px_35px_rgba(250,204,21,0.25)]";
                  const normalClasses =
                    "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/25 shadow-[0_10px_25px_rgba(0,0,0,0.25)]";

                  return (
                    <button
                      key={gift.id}
                      onClick={() => handleGiftClick(gift)}
                      className={`${baseClasses} ${isPremium ? premiumClasses : normalClasses}`}
                    >
                      <span className="text-3xl md:text-4xl drop-shadow">
                        {getGiftEmoji(gift.icon, gift.name)}
                      </span>
                      <span className="text-[12px] md:text-sm text-white/80 font-semibold leading-tight break-words">
                        {gift.name}
                      </span>
                      <span
                        className={`text-sm md:text-base font-extrabold tracking-wide ${
                          isPremium ? "text-yellow-200" : "text-amber-300"
                        }`}
                      >
                        {gift.value.toLocaleString()} coins
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
