import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Swords, Coins } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useGiftSystem, GiftItem } from '../../hooks/useGiftSystem';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface BattleGiftPanelProps {
  streamId: string;
  battleId: string;
  challengerStreamId: string;
  opponentStreamId: string;
  challengerHostId: string;
  opponentHostId: string;
  challengerTitle?: string;
  opponentTitle?: string;
  onGiftSent?: (gift: GiftItem, side: 'A' | 'B') => void;
}

export default function BattleGiftPanel({
  streamId,
  battleId,
  challengerStreamId,
  opponentStreamId,
  challengerHostId,
  opponentHostId,
  challengerTitle = 'Side A',
  opponentTitle = 'Side B',
  onGiftSent,
}: BattleGiftPanelProps) {
  const { user, profile } = useAuthStore();
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [selectedSide, setSelectedSide] = useState<'A' | 'B'>('A');
  const [isLoading, setIsLoading] = useState(true);
  const [sendingGiftId, setSendingGiftId] = useState<string | null>(null);

  const recipientId = selectedSide === 'A' ? challengerHostId : opponentHostId;
  const targetStreamId = selectedSide === 'A' ? challengerStreamId : opponentStreamId;

  const { sendGift, isSending } = useGiftSystem(recipientId, targetStreamId, battleId);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const { data, error } = await supabase
          .from('gifts')
          .select('id, name, icon_url, cost, animation_type, gift_slug')
          .eq('is_active', true)
          .order('cost', { ascending: true })
          .limit(12);

        if (error) throw error;

        const transformed: GiftItem[] = (data || []).map((g: any) => ({
          id: g.id,
          name: g.name,
          icon: g.icon_url || '🎁',
          coinCost: g.cost || 0,
          type: g.cost > 0 ? 'paid' : 'free',
          slug: g.gift_slug || g.name.toLowerCase().replace(/\s+/g, '-'),
          animationType: g.animation_type || undefined,
        }));

        setGifts(transformed);
      } catch (err) {
        console.error('[BattleGiftPanel] Error fetching gifts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGifts();
  }, []);

  const handleSendGift = useCallback(async (gift: GiftItem) => {
    if (!user) {
      toast.error('Log in to send gifts');
      return;
    }
    if (isSending || sendingGiftId) return;

    setSendingGiftId(gift.id);
    try {
      const success = await sendGift(gift, recipientId, 1);
      if (success) {
        onGiftSent?.(gift, selectedSide);
      }
    } catch (err) {
      console.error('[BattleGiftPanel] Gift send error:', err);
    } finally {
      setSendingGiftId(null);
    }
  }, [user, isSending, sendingGiftId, sendGift, recipientId, selectedSide, onGiftSent]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-white/20 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-2 gap-2">
      {/* Side selector */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setSelectedSide('A')}
          className={cn(
            "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
            selectedSide === 'A'
              ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30'
              : 'bg-white/5 text-white/50 hover:bg-white/10'
          )}
        >
          <Swords size={10} className="inline mr-1" />
          {challengerTitle || 'Side A'}
        </button>
        <button
          onClick={() => setSelectedSide('B')}
          className={cn(
            "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
            selectedSide === 'B'
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/30'
              : 'bg-white/5 text-white/50 hover:bg-white/10'
          )}
        >
          <Swords size={10} className="inline mr-1" />
          {opponentTitle || 'Side B'}
        </button>
      </div>

      {/* Gift grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <div className="grid grid-cols-4 gap-1.5">
          {gifts.map((gift) => (
            <button
              key={gift.id}
              onClick={() => handleSendGift(gift)}
              disabled={isSending || sendingGiftId === gift.id}
              className={cn(
                "relative flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all active:scale-95",
                selectedSide === 'A'
                  ? 'border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/15 hover:border-purple-500/40'
                  : 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500/40',
                (isSending || sendingGiftId === gift.id) && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className="text-lg leading-none">{gift.icon}</span>
              <span className="text-[8px] text-white/60 mt-0.5 truncate w-full text-center">
                {gift.name}
              </span>
              {gift.coinCost > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <Coins size={8} className="text-yellow-400" />
                  <span className="text-[8px] text-yellow-400 font-bold">{gift.coinCost}</span>
                </div>
              )}
              {sendingGiftId === gift.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Gift button label */}
      <div className={cn(
        "text-center text-[9px] font-bold uppercase tracking-wider py-1 rounded-lg",
        selectedSide === 'A'
          ? 'text-purple-400 bg-purple-500/10'
          : 'text-emerald-400 bg-emerald-500/10'
      )}>
        <Gift size={10} className="inline mr-1" />
        Gifting to {selectedSide === 'A' ? (challengerTitle || 'Side A') : (opponentTitle || 'Side B')}
      </div>
    </div>
  );
}
