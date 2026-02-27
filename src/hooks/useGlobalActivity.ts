
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ActivityEvent {
  id: string;
  type: 'live' | 'gift' | 'battle' | 'system';
  message: string;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
}

const useGlobalActivity = () => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const fetchUsername = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', userId)
      .single();
    return data?.username || 'Someone';
  };

  useEffect(() => {
    const handleStreamInsert = async (payload: any) => {
      console.log('[GlobalTicker] Stream INSERT event received:', payload);
      const stream = payload.new as any;
      console.log('[GlobalTicker] Stream data:', stream);
      const userId = stream.user_id || stream.broadcaster_id;
      console.log('[GlobalTicker] User ID to fetch:', userId);
      const username = await fetchUsername(userId);
      console.log('[GlobalTicker] Fetched username:', username);
      
      const event: ActivityEvent = {
        id: stream.id,
        type: 'live',
        message: `🔴 ${username} is now LIVE`,
        priority: 'high',
        created_at: stream.created_at,
      };
      setEvents((prevEvents) => {
        // Filter out any existing live event for this stream to prevent duplicates
        const filtered = prevEvents.filter(e => !(e.id === stream.id && e.type === 'live'));
        return [event, ...filtered].slice(0, 50);
      });
    };

    const handleCoinTransactionInsert = async (payload: any) => {
      const transaction = payload.new as any;
      if (transaction.type === 'gift') {
        const senderUsername = await fetchUsername(transaction.user_id);
        const recipientUsername = await fetchUsername(transaction.metadata?.recipient_id);
        const event: ActivityEvent = {
          id: transaction.id,
          type: 'gift',
          message: `🎁 ${senderUsername} sent a gift to ${recipientUsername}`,
          priority: transaction.amount > 1000 ? 'high' : 'medium',
          created_at: transaction.created_at,
        };
        setEvents((prevEvents) => {
          // Filter out duplicate gift events
          const filtered = prevEvents.filter(e => !(e.id === transaction.id && e.type === 'gift'));
          return [event, ...filtered].slice(0, 50);
        });
      }
    };

    const handleTrollBattleInsert = async (payload: any) => {
      const battle = payload.new as any;
      const challengerUsername = await fetchUsername(battle.challenger_id);
      const opponentUsername = await fetchUsername(battle.opponent_id);
      const event: ActivityEvent = {
        id: battle.id,
        type: 'battle',
        message: `⚔️ ${challengerUsername} started a battle with ${opponentUsername}`,
        priority: 'high',
        created_at: battle.created_at,
      };
      setEvents((prevEvents) => {
        // Filter out duplicate battle events
        const filtered = prevEvents.filter(e => !(e.id === battle.id && e.type === 'battle'));
        return [event, ...filtered].slice(0, 50);
      });
    };

    const streamsSubscription = supabase
      .channel('streams-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'streams' }, handleStreamInsert)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams' }, (payload: any) => {
        const stream = payload.new as any;
        // Only trigger for streams going live
        if (stream.is_live === true || stream.status === 'live') {
          handleStreamInsert(payload);
        }
      })
      .subscribe((status) => {
        console.log('[GlobalTicker] Streams subscription status:', status);
      });

    const coinTransactionsSubscription = supabase
      .channel('coin-transactions-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coin_transactions' }, handleCoinTransactionInsert)
      .subscribe((status) => {
        console.log('[GlobalTicker] Coin transactions subscription status:', status);
      });

    const trollBattlesSubscription = supabase
      .channel('troll-battles-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'troll_battles' }, handleTrollBattleInsert)
      .subscribe((status) => {
        console.log('[GlobalTicker] Battles subscription status:', status);
      });

    return () => {
      streamsSubscription.unsubscribe();
      coinTransactionsSubscription.unsubscribe();
      trollBattlesSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (events.length === 0) {
      const systemMessages: ActivityEvent[] = [
        {
          id: '1',
          type: 'system',
          message: 'Welcome to Troll City',
          priority: 'low',
          created_at: new Date().toISOString(),
        },
        {
          id: '3',
          type: 'system',
          message: 'Explore live streams now',
          priority: 'low',
          created_at: new Date().toISOString(),
        },
      ];
      setEvents(systemMessages);
    }
  }, [events.length]);

  return events;
};

export default useGlobalActivity;
