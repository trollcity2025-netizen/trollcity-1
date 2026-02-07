import React, { useEffect, useState } from 'react';
import { X, Coins, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useGiftSystem, GiftItem } from '../../lib/hooks/useGiftSystem';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';

interface GiftTrayProps {
  recipientId: string;
  streamId: string;
  onClose: () => void;
  battleId?: string | null;
  allRecipients?: string[];
}

export default function GiftTray({ recipientId, streamId, onClose, battleId, allRecipients }: GiftTrayProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { sendGift, isSending } = useGiftSystem(recipientId, streamId, battleId, recipientId);
  const { profile } = useAuthStore();
  // const [sendingToAll, setSendingToAll] = useState(false);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
          // TRAE: Updated to use centralized purchasable_items table
          const { data, error } = await supabase
            .from('purchasable_items')
            .select('*')
            .eq('category', 'gift')
            .eq('is_active', true)
            .order('coin_price', { ascending: true });

          if (error) {
            console.error('Error fetching gifts:', error);
          } else {
            // Map DB gifts to GiftItem interface
            const mappedGifts: GiftItem[] = data.map((g: any) => ({
              id: g.id,
              name: g.display_name,
              icon: g.metadata?.icon || '🎁', // Use metadata icon or fallback
              coinCost: g.coin_price || 0,
              type: 'paid',
              slug: g.item_key,
              category: g.category
            }));
            setGifts(mappedGifts);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
    };

    fetchGifts();
  }, []);

  const handleSend = async (gift: GiftItem) => {
    if (allRecipients && allRecipients.length > 0) {
        setSendingToAll(true);
        try {
            // Send to each recipient
            // We do this sequentially to avoid overwhelming the client/server, but parallel could be faster.
            // Parallel with Promise.all is better for UX.
            const promises = allRecipients.map(recipientId => 
                sendGift(gift, recipientId).catch(e => console.error(`Failed to send to ${recipientId}`, e))
            );
            
            await Promise.all(promises);
            toast.success(`Gift sent to ${allRecipients.length} users!`);
            
        } catch (e) {
            console.error(e);
            toast.error("Failed to send some gifts");
        }
        setSendingToAll(false);
        onClose();
        return;
    }

    const success = await sendGift(gift);
    if (success) {
      // Optional: Close tray or keep open for combo
      // onClose(); 
    }
  };

  return (
    <div className="absolute bottom-0 left-0 w-full bg-zinc-900/95 backdrop-blur-xl border-t border-white/10 p-4 rounded-t-3xl shadow-2xl z-50 animate-in slide-in-from-bottom-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Coins className="text-yellow-400" size={20} />
            {allRecipients ? "Gift Everyone" : "Send Gift"}
        </h3>
        <div className="flex items-center gap-4">
            <div className="text-yellow-400 font-mono text-sm bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                {profile?.troll_coins?.toLocaleString() || 0} Coins
            </div>
            <button 
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            >
                <X size={24} />
            </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-white" />
        </div>
      ) : (
        <div className="grid grid-cols-4 md:grid-cols-5 gap-3 overflow-y-auto max-h-60 custom-scrollbar p-1">
            {gifts.map((gift) => (
                <button
                    key={gift.id}
                    disabled={isSending}
                    onClick={() => handleSend(gift)}
                    className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-white/10 transition-colors group relative border border-transparent hover:border-white/10"
                >
                    <div className="text-3xl transform group-hover:scale-110 transition-transform duration-200">
                        {gift.icon || '🎁'}
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-gray-300 font-medium truncate w-full">{gift.name}</div>
                        <div className="text-[10px] text-yellow-400 font-mono">{gift.coinCost}</div>
                    </div>
                    
                    {/* Hover Effect Glow */}
                    <div className="absolute inset-0 bg-yellow-400/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity pointer-events-none" />
                </button>
            ))}
        </div>
      )}
    </div>
  );
}
