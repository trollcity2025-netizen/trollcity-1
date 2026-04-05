
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ActivityEvent {
  id: string;
  type: 'live' | 'gift' | 'battle' | 'system' | 'tcnn_breaking' | 'tcnn_live' | 'tcnn_article';
  message: string;
  priority: 'high' | 'medium' | 'low' | 'breaking';
  created_at: string;
  metadata?: {
    category?: string;
    url?: string;
    author?: string;
  };
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

    // TCNN Breaking News Handler
    const handleTCNNBreakingNews = async (payload: any) => {
      const ticker = payload.new as any;
      // Handle both breaking (priority 3) and standard (priority 1) ticker messages
      if (ticker.status === 'active' || ticker.status === 'approved') {
        const event: ActivityEvent = {
          id: ticker.id,
          type: ticker.priority >= 3 ? 'tcnn_breaking' : 'tcnn_live',
          message: ticker.priority >= 3 
            ? `🚨 BREAKING: ${ticker.message}` 
            : `📰 ${ticker.message}`,
          priority: ticker.priority >= 3 ? 'breaking' : 'medium',
          created_at: ticker.created_at,
          metadata: {
            category: ticker.priority >= 3 ? 'breaking_news' : 'ticker_message'
          }
        };
        setEvents((prevEvents) => {
          const filtered = prevEvents.filter(e => e.id !== ticker.id);
          return [event, ...filtered].slice(0, 50);
        });
      }
    };

    // TCNN Live Broadcast Handler
    const handleTCNNLiveBroadcast = async (payload: any) => {
      const broadcast = payload.new as any;
      if (broadcast.category === 'tcnn' && (broadcast.is_live || broadcast.status === 'live')) {
        const username = await fetchUsername(broadcast.user_id);
        const event: ActivityEvent = {
          id: broadcast.id,
          type: 'tcnn_live',
          message: `📺 TCNN LIVE: ${username} is broadcasting news now`,
          priority: 'high',
          created_at: broadcast.created_at,
          metadata: {
            category: 'tcnn_broadcast',
            url: `/tcnn`
          }
        };
        setEvents((prevEvents) => {
          const filtered = prevEvents.filter(e => !(e.id === broadcast.id && e.type === 'tcnn_live'));
          return [event, ...filtered].slice(0, 50);
        });
      }
    };

    // TCNN Published Article Handler
    const handleTCNNArticlePublished = async (payload: any) => {
      const article = payload.new as any;
      if (article.status === 'published') {
        const authorName = await fetchUsername(article.author_id);
        const event: ActivityEvent = {
          id: article.id,
          type: 'tcnn_article',
          message: `📰 TCNN: "${article.title.substring(0, 50)}${article.title.length > 50 ? '...' : ''}" by ${authorName}`,
          priority: 'medium',
          created_at: article.published_at || article.created_at,
          metadata: {
            category: 'tcnn_article',
            author: authorName,
            url: `/tcnn/article/${article.id}`
          }
        };
        setEvents((prevEvents) => {
          const filtered = prevEvents.filter(e => !(e.id === article.id && e.type === 'tcnn_article'));
          return [event, ...filtered].slice(0, 50);
        });
      }
    };

    // TCNN Ticker Queue Broadcast (primary method for instant display)
    const tickerBroadcastSubscription = supabase
      .channel('ticker-broadcast')
      .on('broadcast', { event: 'ticker-message' }, (payload) => {
        console.log('[GlobalTicker] Broadcast ticker received:', payload);
        const ticker = payload.payload as ActivityEvent;
        setEvents((prevEvents) => {
          const filtered = prevEvents.filter(e => e.id !== ticker.id);
          return [ticker, ...filtered].slice(0, 50);
        });
      })
      .on('broadcast', { event: 'ticker-clear' }, (payload) => {
        console.log('[GlobalTicker] Clear ticker received:', payload);
        const { id } = payload.payload as { id: string };
        setEvents((prevEvents) => prevEvents.filter(e => e.id !== id));
      })
      .subscribe((status) => {
        console.log('[GlobalTicker] Broadcast subscription status:', status);
      });

    // TCNN Ticker Queue Subscription (fallback for database changes)
    const tcnnTickerSubscription = supabase
      .channel('tcnn-ticker-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tcnn_ticker_queue' }, handleTCNNBreakingNews)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tcnn_ticker_queue' }, handleTCNNBreakingNews)
      .subscribe((status) => {
        console.log('[GlobalTicker] TCNN ticker subscription status:', status);
      });

    // TCNN Stream/Category Subscription
    const tcnnStreamSubscription = supabase
      .channel('tcnn-stream-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'streams' }, handleTCNNLiveBroadcast)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams' }, handleTCNNLiveBroadcast)
      .subscribe((status) => {
        console.log('[GlobalTicker] TCNN stream subscription status:', status);
      });

    // TCNN Articles Subscription
    const tcnnArticlesSubscription = supabase
      .channel('tcnn-articles-activity')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tcnn_articles' }, handleTCNNArticlePublished)
      .subscribe((status) => {
        console.log('[GlobalTicker] TCNN articles subscription status:', status);
      });

    return () => {
      streamsSubscription.unsubscribe();
      coinTransactionsSubscription.unsubscribe();
      trollBattlesSubscription.unsubscribe();
      tickerBroadcastSubscription.unsubscribe();
      tcnnTickerSubscription.unsubscribe();
      tcnnStreamSubscription.unsubscribe();
      tcnnArticlesSubscription.unsubscribe();
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
