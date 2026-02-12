import React, { useEffect, useState } from 'react';
import { X, Coins, Loader2, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useGiftSystem, GiftItem } from '../../lib/hooks/useGiftSystem';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

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
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const { sendGift, isSending } = useGiftSystem(recipientId, streamId, battleId, recipientId);
  const { profile } = useAuthStore();
  const [sendingToAll, setSendingToAll] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        let mappedGifts: GiftItem[] = [];

        // Prefer gift_items to align with send_gift RPC expectations
        const { data: giftItems, error: giftItemsError } = await supabase
          .from('gift_items')
          .select('*')
          .order('value', { ascending: true });

        if (giftItemsError) {
          throw giftItemsError;
        }

        if (giftItems && giftItems.length > 0) {
          mappedGifts = giftItems.map((g: any) => ({
            id: g.id,
            name: g.name,
            icon: g.icon || '🎁',
            coinCost: g.value || 0,
            type: 'paid' as const,
            slug: g.gift_slug || g.name,
            category: 'gift',
            subcategory: g.category || 'Misc'
          }));
        } else {
          // Fallback to purchasable_items if gift_items is empty
          const { data: purchasableItems } = await supabase
            .from('purchasable_items')
            .select('*')
            .eq('category', 'gift')
            .eq('is_active', true)
            .order('coin_price', { ascending: true });

          if (purchasableItems && purchasableItems.length > 0) {
            mappedGifts = purchasableItems.map((g: any) => ({
              id: g.id,
              name: g.display_name,
              icon: g.metadata?.icon || '🎁',
              coinCost: g.coin_price || 0,
              type: 'paid' as const,
              slug: g.item_key,
              category: g.category,
              subcategory: g.metadata?.subcategory || 'Misc'
            }));
          }
        }

        setGifts(mappedGifts);
        
        if (mappedGifts.length > 0) {
          const firstCat = mappedGifts[0].subcategory;
          if (firstCat && firstCat !== 'Misc') {
            setActiveCategory('All');
          }
        }
      } catch (e) {
        console.error(e);
        // Fallback if error occurs
        const { data: giftItems } = await supabase
          .from('gift_items')
          .select('*')
          .order('value', { ascending: true });
        
        if (giftItems && giftItems.length > 0) {
          const mappedGifts = giftItems.map((g: any) => ({
            id: g.id,
            name: g.name,
            icon: g.icon || '🎁',
            coinCost: g.value || 0,
            type: 'paid' as const,
            slug: g.gift_slug || g.name,
            category: 'gift',
            subcategory: g.category || 'Misc'
          }));
          setGifts(mappedGifts);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchGifts();
  }, []);

  const categories = React.useMemo(() => {
    const cats = Array.from(new Set(gifts.map(g => g.subcategory).filter(Boolean) as string[]));
    const order = [
      'Court & Government',
      'Podcast & Media', 
      'Homes & Real Estate',
      'Vehicles & Transport',
      'Money & Flex',
      'Battle & Chaos',
      'Luxury / Rare'
    ];
    
    return ['All', ...cats.sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    })];
  }, [gifts]);

  const filteredGifts = React.useMemo(() => {
    if (activeCategory === 'All') return gifts;
    return gifts.filter(g => g.subcategory === activeCategory);
  }, [gifts, activeCategory]);

  const handleSend = async (gift: GiftItem) => {
    if (allRecipients && allRecipients.length > 0) {
      setSendingToAll(true);
      try {
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
      setSelectedGift(gift);
      // Close after a short delay to show animation
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const canAfford = (cost: number) => {
    return (profile?.troll_coins || 0) >= cost;
  };

  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl border-t border-white/10 p-4 rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Coins className="text-yellow-400" size={20} />
            {allRecipients ? "Gift Everyone" : "Send Gift"}
          </h3>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Coin Balance */}
          <div className="text-yellow-400 font-mono text-sm bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20 flex items-center gap-1">
            <Coins size={14} />
            {profile?.troll_coins?.toLocaleString() || 0}
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <ChevronDown size={20} />
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      {!loading && gifts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat 
                  ? 'bg-yellow-400 text-black' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Gift Grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-white" />
        </div>
      ) : gifts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No gifts available.
        </div>
      ) : filteredGifts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No gifts match this category.
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 overflow-y-auto max-h-64 custom-scrollbar">
          {filteredGifts.map((gift) => {
            const isHighValue = gift.coinCost >= 1000;
            const isLegendary = gift.coinCost >= 5000;
            const affordable = canAfford(gift.coinCost);
            
            return (
              <button
                key={gift.id}
                disabled={isSending || !affordable}
                onClick={() => handleSend(gift)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl transition-all group relative border",
                  isHighValue 
                    ? 'border-yellow-400/30 bg-yellow-400/5' 
                    : 'border-transparent hover:border-white/10 hover:bg-white/10',
                  !affordable && 'opacity-50',
                  selectedGift?.id === gift.id && 'ring-2 ring-yellow-400 animate-pulse'
                )}
              >
                {/* Gift Icon */}
                <div className={cn(
                  "text-3xl transform group-hover:scale-110 transition-transform duration-200",
                  isLegendary && 'animate-bounce'
                )}>
                  {gift.icon || '🎁'}
                </div>
                
                {/* Gift Name */}
                <div className={cn(
                  "text-[10px] font-medium truncate w-full text-center",
                  isHighValue ? 'text-yellow-200' : 'text-gray-300'
                )}>
                  {gift.name}
                </div>
                
                {/* Coin Cost - Prominent Display */}
                <div className={cn(
                  "text-[11px] font-mono font-bold flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded-full",
                  affordable 
                    ? 'bg-yellow-400/20 text-yellow-400' 
                    : 'bg-red-500/20 text-red-400'
                )}>
                  <Coins size={10} />
                  {gift.coinCost.toLocaleString()}
                </div>
                
                {/* Hover Glow Effect */}
                {affordable && (
                  <div className="absolute inset-0 bg-yellow-400/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Footer Info */}
      {!loading && gifts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-[10px] text-gray-500 text-center">
            Tap a gift to send • Coins are deducted instantly
          </p>
        </div>
      )}
    </div>
  );
}
