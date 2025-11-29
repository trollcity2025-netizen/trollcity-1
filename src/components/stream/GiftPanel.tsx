import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface GiftEvent {
  username: string;
  amount: number;
}

export default function GiftPanel({ streamId }: { streamId?: string }) {
  const [gifts, setGifts] = useState<GiftEvent[]>([]);

  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`gift_events_${streamId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'gifts',
          filter: `stream_id=eq.${streamId}`
        },
        async (payload) => {
          // Fetch username from user_profiles for the sender
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('id', payload.new.sender_id)
            .single();

          if (profile) {
            setGifts((prev) => [
              { username: profile.username, amount: payload.new.coins_spent || 0 },
              ...prev.slice(0, 3),
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  return (
    <div className="absolute right-6 bottom-[12%] space-y-3 z-20">
      {gifts.map((g, i) => (
        <div
          key={i}
          className="bg-purple-800/70 text-white px-6 py-3 rounded-xl border border-purple-400 shadow-lg drop-shadow-xl animate-popUp"
        >
          🎁 {g.username} sent <strong>{g.amount} GEMs</strong>
        </div>
      ))}
    </div>
  );
}

