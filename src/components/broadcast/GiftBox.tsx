import React, { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface GiftItem {
  id: string;
  name: string;
  icon: string;
  value: number;
  category: string;
}

interface GiftBoxProps {
  onSendGift?: (gift: { id: string; coins: number; name: string }, recipient?: string | null) => void;
  participants?: Array<{ name: string }>;
}

export default function GiftBox({ onSendGift, participants = [] }: GiftBoxProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const { data, error } = await supabase
          .from('gift_items')
          .select('*')
          .order('value', { ascending: true });
        
        if (error) throw error;
        
        if (data) {
          setGifts(data.map(item => ({
            id: item.id,
            name: item.name,
            icon: item.icon,
            value: item.value,
            category: item.category || 'Common'
          })));
        }
      } catch (err) {
        console.error('Error fetching gifts:', err);
        // Fallback or empty
      } finally {
        setLoading(false);
      }
    };

    fetchGifts();
  }, []);

  const displayedGifts = React.useMemo(() => {
    // If we have gifts from DB, use them. 
    // We can shuffle or just show them sorted by value (which is usually better for UX)
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
    // attach quantity to gift object for handler
    onSendGift?.({ 
      id: selectedGift.id, 
      name: selectedGift.name, 
      coins: selectedGift.value, 
      quantity 
    } as any, recipient);
    setShowModal(false);
    setSelectedGift(null);
  };

  return (
    <div className="bg-gradient-to-b from-gray-900 to-black rounded-lg p-4 purple-neon">
      <div className="flex items-center gap-2 mb-3">
        <Gift size={16} />
        <h3 className="text-sm font-bold">QUICK GIFTS</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {displayedGifts.map((gift) => (
          <button
            key={gift.id}
            onClick={() => openChooser(gift)}
            className="flex flex-col items-center gap-1 p-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
          >
            <div className="text-2xl">{gift.icon}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300">{gift.value}</span>
              {gift.category && (
                <span className={`text-[10px] px-1 py-0.5 rounded ml-1 ${gift.category === 'legendary' ? 'bg-yellow-600 text-black' : gift.category === 'rare' ? 'bg-purple-600 text-white' : gift.category === 'troll' ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'}`}>{gift.category}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {showModal && selectedGift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative z-60 bg-[#0B0A10] rounded-lg p-6 border border-purple-700/40 max-w-md w-full">
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
