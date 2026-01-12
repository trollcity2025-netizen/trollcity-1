import React, { useEffect, useState } from "react";
import { Gift, Users, Crown } from "lucide-react";
import { supabase } from "../../lib/supabase";

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
}

const DEFAULT_GIFTS: GiftItem[] = [
  { id: "troll_clap", name: "Troll Clap", icon: "dY`?", value: 5, category: "Basic" },
  { id: "glow_heart", name: "Glow Heart", icon: "dY'o", value: 10, category: "Basic" },
  { id: "laughing_mask", name: "Laughing Mask", icon: "dYZ-", value: 30, category: "Basic" },
  { id: "troll_mic_drop", name: "Troll Mic Drop", icon: "dYZ", value: 100, category: "Rare" },
  { id: "troll_confetti", name: "Troll Confetti", icon: "dYZ%", value: 850, category: "Rare" },
  { id: "crown_blast", name: "Crown Blast", icon: "dY``", value: 1200, category: "Epic" },
  { id: "diamond_storm", name: "Diamond Storm", icon: "dY'Z", value: 7000, category: "Epic" },
  { id: "the_big_crown", name: "The Big Crown", icon: "dY``", value: 15000, category: "Legendary" },
];

export default function GiftBox({ onSendGift }: GiftBoxProps) {
  const [gifts, setGifts] = useState<GiftItem[]>(DEFAULT_GIFTS);
  const [isExpanded, setIsExpanded] = useState(true);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("broadcaster");

  useEffect(() => {
    let active = true;
    const fetchGifts = async () => {
      try {
        const { data, error } = await supabase
          .from("gift_items")
          .select("id,name,icon,value,category")
          .order("value", { ascending: true });

        if (error) throw error;
        if (!active) return;

        const payload = (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          icon: item.icon,
          value: item.value,
          category: item.category || "Common",
        }));

        if (payload.length > 0) {
          setGifts(payload);
        }
      } catch (err) {
        console.error("Error fetching gifts:", err);
      }
    };

    fetchGifts();
    return () => {
      active = false;
    };
  }, []);

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
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-white/40 hover:text-white text-sm"
        >
          {isExpanded ? "Hide" : "Show"}
        </button>
      </div>

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
        <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
          {gifts.map((gift) => (
            <button
              key={gift.id}
              onClick={() => handleGiftClick(gift)}
              className="flex flex-col items-center gap-1 p-2 bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 hover:border-white/20 transition-colors"
            >
              <span className="text-2xl">{gift.icon}</span>
              <span className="text-[10px] text-white/70 text-center break-words">
                {gift.name}
              </span>
              <span className="text-xs font-bold text-yellow-400">{gift.value} coins</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
