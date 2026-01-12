import React, { useEffect, useState } from "react";
import { Gift, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface GiftItem {
  id: string;
  name: string;
  icon: string;
  value: number;
  category: string;
}

interface GiftBoxProps {
  onSendGift?: (gift: { id: string; coins: number; name: string; slug?: string; quantity?: number }, recipient?: string | null) => void;
  participants?: Array<{ name: string }>;
}

export default function GiftBox({ onSendGift, participants = [] }: GiftBoxProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const toGiftSlug = (value?: string) => {
    if (!value) return 'gift';
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'gift';
  };

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const { data, error } = await supabase
          .from('gift_items')
          .select('*')
          .order('value', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          setGifts(data.map(item => ({
            id: item.id,
            name: item.name,
            icon: item.icon,
            value: item.value,
            category: item.category || 'Common'
          })));
        } else {
            const DEFAULT_GIFTS = [
              { id: 'troll_clap', name: 'Troll Clap', icon: '👏', value: 5, category: 'Basic' },
              { id: 'glow_heart', name: 'Glow Heart', icon: '💜', value: 10, category: 'Basic' },
              { id: 'sticker_bomb', name: 'Sticker Bomb', icon: '🧷', value: 15, category: 'Basic' },
              { id: 'mini_crown', name: 'Mini Crown', icon: '👑', value: 20, category: 'Basic' },
              { id: 'troll_soda', name: 'Troll Soda', icon: '🥤', value: 25, category: 'Basic' },
              { id: 'laughing_mask', name: 'Laughing Mask', icon: '🎭', value: 30, category: 'Basic' },
              { id: 'purple_rose', name: 'Purple Rose', icon: '🌹', value: 40, category: 'Basic' },
              { id: 'hype_horn', name: 'Hype Horn', icon: '📣', value: 50, category: 'Basic' },
              { id: 'emoji_rain', name: 'Emoji Rain', icon: '🌧️', value: 60, category: 'Basic' },
              { id: 'gold_spark', name: 'Gold Spark', icon: '✨', value: 75, category: 'Basic' },
              { id: 'troll_mic_drop', name: 'Troll Mic Drop', icon: '🎤', value: 100, category: 'Rare' },
              { id: 'vip_wristband', name: 'VIP Wristband', icon: '🎟️', value: 120, category: 'Rare' },
              { id: 'fire_trail', name: 'Fire Trail', icon: '�', value: 150, category: 'Rare' },
              { id: 'neon_wings', name: 'Neon Wings', icon: '🪽', value: 180, category: 'Rare' },
              { id: 'troll_taxi', name: 'Troll Taxi', icon: '�', value: 200, category: 'Rare' },
              { id: 'street_graffiti', name: 'Street Graffiti', icon: '�️', value: 250, category: 'Rare' },
              { id: 'troll_boom_box', name: 'Troll Boom Box', icon: '📻', value: 300, category: 'Rare' },
              { id: 'diamond_smile', name: 'Diamond Smile', icon: '💎', value: 350, category: 'Rare' },
              { id: 'the_troll_drink', name: 'The Troll Drink', icon: '🍸', value: 400, category: 'Rare' },
              { id: 'gold_handshake', name: 'Gold Handshake', icon: '🤝', value: 450, category: 'Rare' },
              { id: 'troll_spotlight', name: 'Troll Spotlight', icon: '�', value: 500, category: 'Rare' },
              { id: 'neon_camera', name: 'Neon Camera', icon: '📷', value: 600, category: 'Rare' },
              { id: 'streamer_shield', name: 'Streamer Shield', icon: '🛡️', value: 750, category: 'Rare' },
              { id: 'troll_confetti', name: 'Troll Confetti', icon: '🎉', value: 850, category: 'Rare' },
              { id: 'bubble_throne', name: 'Bubble Throne', icon: '🫧', value: 950, category: 'Rare' },
              { id: 'crown_blast', name: 'Crown Blast', icon: '👑', value: 1200, category: 'Epic' },
              { id: 'purple_lightning', name: 'Purple Lightning', icon: '⚡', value: 1500, category: 'Epic' },
              { id: 'troll_limo', name: 'Troll Limo', icon: '�', value: 2000, category: 'Epic' },
              { id: 'gold_vault', name: 'Gold Vault', icon: '🏦', value: 2500, category: 'Epic' },
              { id: 'district_flag', name: 'District Flag', icon: '🚩', value: 3000, category: 'Epic' },
              { id: 'troll_court_gavel', name: 'Troll Court Gavel', icon: '🔨', value: 3500, category: 'Epic' },
              { id: 'neon_dragon', name: 'Neon Dragon', icon: '🐉', value: 4000, category: 'Epic' },
              { id: 'hologram_crown', name: 'Hologram Crown', icon: '👑', value: 4500, category: 'Epic' },
              { id: 'street_king', name: 'Street King', icon: '🪧', value: 5000, category: 'Epic' },
              { id: 'troll_jet', name: 'Troll Jet', icon: '✈️', value: 6000, category: 'Epic' },
              { id: 'diamond_storm', name: 'Diamond Storm', icon: '💎', value: 7000, category: 'Epic' },
              { id: 'ghost_rider_troll', name: 'Ghost Rider Troll', icon: '🏍️', value: 8000, category: 'Epic' },
              { id: 'luxury_yacht', name: 'Luxury Yacht', icon: '🛥️', value: 10000, category: 'Epic' },
              { id: 'meteor_drop', name: 'Meteor Drop', icon: '☄️', value: 12000, category: 'Epic' },
              { id: 'the_big_crown', name: 'The Big Crown', icon: '👑', value: 15000, category: 'Epic' },
              { id: 'golden_throne', name: 'Golden Throne', icon: '�', value: 20000, category: 'Legendary' },
              { id: 'crown_of_kings', name: 'Crown of Kings', icon: '�', value: 25000, category: 'Legendary' },
              { id: 'district_takeover', name: 'District Takeover', icon: '🏙️', value: 30000, category: 'Legendary' },
              { id: 'troll_city_skyline', name: 'Troll City Skyline', icon: '🌆', value: 35000, category: 'Legendary' },
              { id: 'titan_crown_drop', name: 'Titan Crown Drop', icon: '👑', value: 40000, category: 'Legendary' },
              { id: 'diamond_crown_aura', name: 'Diamond Crown Aura', icon: '�', value: 50000, category: 'Legendary' },
              { id: 'royal_parade', name: 'Royal Parade', icon: '🎺', value: 60000, category: 'Legendary' },
              { id: 'neon_godzilla_troll', name: 'Neon Godzilla Troll', icon: '🦖', value: 75000, category: 'Legendary' },
              { id: 'golden_city_explosion', name: 'Golden City Explosion', icon: '💥', value: 100000, category: 'Legendary' },
              { id: 'the_crowned_legend', name: 'The Crowned Legend', icon: '👑', value: 120000, category: 'Legendary' },
              { id: 'millionaire_crown', name: 'The Millionaire Crown', icon: '👑', value: 250000, category: 'Millionaire' },
              { id: 'troll_city_bank_heist', name: 'Troll City Bank Heist', icon: '🏦', value: 300000, category: 'Millionaire' },
              { id: 'private_jet_champagne', name: 'Private Jet + Champagne', icon: '�️', value: 350000, category: 'Millionaire' },
              { id: 'diamond_vault_explosion', name: 'Diamond Vault Explosion', icon: '💎', value: 400000, category: 'Millionaire' },
              { id: 'golden_crown_storm', name: 'Golden Crown Storm', icon: '👑', value: 500000, category: 'Millionaire' },
              { id: 'the_kingmaker', name: 'The Kingmaker', icon: '👑', value: 600000, category: 'Millionaire' },
              { id: 'neon_dragon_dynasty', name: 'Neon Dragon Dynasty', icon: '🐉', value: 750000, category: 'Millionaire' },
              { id: 'troll_city_penthouse', name: 'Troll City Penthouse', icon: '🏢', value: 900000, category: 'Millionaire' },
              { id: 'the_billionaire_throne', name: 'The Billionaire Throne', icon: '👑', value: 1000000, category: 'Millionaire' },
              { id: 'crowned_emperor', name: 'Crowned Emperor', icon: '👑', value: 1500000, category: 'Millionaire' },
            ];
            setGifts(DEFAULT_GIFTS);
        }
      } catch (err) {
        console.error('Error fetching gifts:', err);
        // Fallback on error
         const DEFAULT_GIFTS = [
              { id: 'troll_respect', name: '👍 Troll Respect', icon: '👍', value: 5, category: 'Common' },
              { id: 'neon_heart', name: '💜 Neon Heart', icon: '💜', value: 10, category: 'Common' },
              { id: 'candy_troll_pop', name: '🍭 Candy Troll Pop', icon: '🍭', value: 15, category: 'Common' },
              { id: 'lightbulb_idea', name: '💡 Lightbulb Idea', icon: '💡', value: 25, category: 'Common' },
              { id: 'mic_support', name: '🎤 Mic Support', icon: '🎤', value: 30, category: 'Common' },
              { id: 'mini_troll', name: '🧌 Mini Troll', icon: '🧌', value: 40, category: 'Interactive' },
              { id: 'roast_wind', name: '💨 Roast Wind', icon: '💨', value: 50, category: 'Interactive' },
              { id: 'laugh_riot', name: '😂 Laugh Riot', icon: '😂', value: 60, category: 'Interactive' },
              { id: 'diamond_troll', name: '💎 Diamond Troll', icon: '💎', value: 400, category: 'Premium' },
              { id: 'royal_crown_drop', name: '👑 Royal Crown Drop', icon: '👑', value: 1000, category: 'Premium' },
            ];
            setGifts(DEFAULT_GIFTS);
      }
    };

    fetchGifts();
  }, []);

  const displayedGifts = React.useMemo(() => {
    return gifts; 
  }, [gifts]);

  const [showModal, setShowModal] = React.useState(false);
  const [selectedGift, setSelectedGift] = React.useState<GiftItem | null>(null);
  const [quantity, setQuantity] = React.useState<number>(1);
  const [recipientMode, setRecipientMode] = React.useState<'all' | 'specific'>('all');
  const [selectedRecipient, setSelectedRecipient] = React.useState<string | null>(participants[0]?.name ?? null);

  const openChooser = (gift: GiftItem) => {
    setSelectedGift(gift);
    setRecipientMode('all');
    setSelectedRecipient(participants[0]?.name ?? null);
    setShowModal(true);
  };

  const confirmSend = () => {
    if (!selectedGift) return;
    const recipient = recipientMode === 'all' ? null : selectedRecipient;
    onSendGift?.({ 
      id: selectedGift.id, 
      name: selectedGift.name, 
      coins: selectedGift.value, 
      slug: toGiftSlug(selectedGift.name),
      quantity 
    } as any, recipient);
    setShowModal(false);
    setSelectedGift(null);
  };

  return (
    <div className="bg-[#0b091f] border-b border-white/10 p-4 relative">
      <button 
        className="w-full flex items-center justify-between group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
          <h3 className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">QUICK GIFTS</h3>
        </div>
        {isExpanded ? <ChevronUp size={16} className="text-white/50" /> : <ChevronDown size={16} className="text-white/50" />}
      </button>

      {isExpanded && (
        <div className="mt-4 grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
          {displayedGifts.map((gift) => (
            <button
              key={gift.id}
              onClick={() => openChooser(gift)}
              className="flex flex-col items-center gap-1 p-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-purple-500/50 rounded-lg transition-all"
            >
              <div className="text-2xl transform hover:scale-110 transition-transform">{gift.icon}</div>
              <div className="flex flex-col items-center w-full">
                <span className="text-[10px] font-medium text-white/70 truncate w-full text-center">{gift.name}</span>
                <span className="text-[10px] text-yellow-500 font-bold">{gift.value}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showModal && selectedGift && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative z-[101] bg-[#0B0A10] rounded-lg p-6 border border-purple-700/40 max-w-md w-full">
            <h4 className="text-lg font-bold mb-3">Send {selectedGift.name}</h4>
            <div className="mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={recipientMode === 'all'}
                  onChange={() => setRecipientMode('all')}
                />
                <span className="ml-2">Send to <strong>All viewers</strong></span>
              </label>
            </div>
            <div className="mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={recipientMode === 'specific'}
                  onChange={() => setRecipientMode('specific')}
                />
                <span className="ml-2">Send to specific user</span>
              </label>
              {recipientMode === 'specific' && (
                <select
                  value={selectedRecipient ?? ''}
                  onChange={(e) => setSelectedRecipient(e.target.value)}
                  className="w-full mt-2 bg-gray-800 text-white rounded px-2 py-1"
                >
                  {participants.length === 0 && <option value="">No participants</option>}
                  {participants.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              )}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold">Quantity</div>
                  <div className="flex gap-2">
                    {[5,10,30,60,100].map((q) => (
                      <button key={q} onClick={() => setQuantity(q)} className={`px-2 py-1 rounded ${quantity===q? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}>{q}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuantity(Math.max(1, quantity-1))} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">−</button>
                  <input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value)||1))} className="flex-1 bg-gray-800 text-white text-center py-1 rounded" />
                  <button onClick={() => setQuantity(quantity+1)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">+</button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-3 py-2 bg-gray-700 rounded">Cancel</button>
              <button onClick={confirmSend} className="px-3 py-2 bg-purple-600 rounded text-white">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
