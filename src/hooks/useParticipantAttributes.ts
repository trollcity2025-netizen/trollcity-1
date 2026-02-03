import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isPerkActive, PerkKey } from '../lib/perkSystem';

export interface ParticipantAttributes {
  username: string;
  avatar_url?: string;
  troll_role?: string;
  troll_coins?: number;
  created_at?: string;
  activePerks: PerkKey[];
  giftCount: number;
}

export function useParticipantAttributes(participantIds: string[], streamId: string) {
  const [attributes, setAttributes] = useState<Record<string, ParticipantAttributes>>({});

  useEffect(() => {
    if (participantIds.length === 0) return;

    const fetchData = async () => {
      // 1. Fetch Profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, troll_role, troll_coins, created_at')
        .in('id', participantIds);

      // 2. Fetch Active Perks
      // We'll just fetch all active perks for these users
      const { data: perks } = await supabase
        .from('user_perks')
        .select('user_id, perk_id')
        .in('user_id', participantIds)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      // 3. Fetch Gift Counts for this stream
      // We can't easily group by in a single simple query without RPC, 
      // but for small N (max 6 participants), we can just count.
      // Or select all gifts for this stream and aggregate client side.
      const { data: gifts } = await supabase
        .from('stream_gifts')
        .select('recipient_id')
        .eq('stream_id', streamId)
        .in('recipient_id', participantIds);

      const newAttrs: Record<string, ParticipantAttributes> = {};

      profiles?.forEach(p => {
        const userPerks = perks
          ?.filter(perk => perk.user_id === p.id)
          .map(perk => perk.perk_id as PerkKey) || [];

        const giftCount = gifts?.filter(g => g.recipient_id === p.id).length || 0;

        newAttrs[p.id] = {
          username: p.username || 'Unknown',
          avatar_url: p.avatar_url,
          troll_role: p.troll_role,
          troll_coins: p.troll_coins || 0,
          created_at: p.created_at,
          activePerks: userPerks,
          giftCount
        };
      });

      setAttributes(newAttrs);
    };

    fetchData();

    // Subscribe to changes
    // 1. Gift changes
    const giftChannel = supabase.channel(`attrs_gifts:${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'stream_gifts',
        filter: `stream_id=eq.${streamId}`
      }, (payload) => {
        const newGift = payload.new as any;
        setAttributes(prev => {
           const targetId = newGift.recipient_id;
           if (!prev[targetId]) return prev;
           return {
             ...prev,
             [targetId]: {
               ...prev[targetId],
               giftCount: prev[targetId].giftCount + 1
             }
           };
        });
      })
      .subscribe();

    // 2. Perk changes
    const perkChannel = supabase.channel(`attrs_perks`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_perks'
      }, () => {
         // Simple re-fetch for now as mapping partial updates is complex
         fetchData();
      })
      .subscribe();
      
    // 3. Profile changes (Coins, Role, etc.)
    const profileChannel = supabase.channel(`attrs_profiles_group`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_profiles'
      }, (payload) => {
         const newProfile = payload.new as any;
         if (participantIds.includes(newProfile.id)) {
             setAttributes(prev => {
                 if (!prev[newProfile.id]) return prev;
                 return {
                     ...prev,
                     [newProfile.id]: {
                         ...prev[newProfile.id],
                         username: newProfile.username,
                         avatar_url: newProfile.avatar_url,
                         troll_role: newProfile.troll_role,
                         troll_coins: newProfile.troll_coins
                     }
                 };
             });
         }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(giftChannel);
      supabase.removeChannel(perkChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [JSON.stringify(participantIds), streamId]);

  return attributes;
}
