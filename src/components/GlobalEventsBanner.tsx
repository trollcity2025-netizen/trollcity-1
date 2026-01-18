import React, { useState, useEffect } from 'react';
import { Clock, Gift, Trophy, Zap, Crown, Flame, X } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface GlobalEvent {
  id: string;
  title: string;
  description: string;
  type: 'double_gift' | 'court_night' | 'family_war_finale' | 'bonus_hour' | 'special_event';
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  multiplier?: number;
  linkPath?: string;
}

interface VoteEventRow {
  id: string;
  event_type: string;
  created_at: string;
}

const mapVoteEventToGlobal = (row: VoteEventRow): GlobalEvent => {
  const baseStart = row.created_at ? new Date(row.created_at) : new Date();
  const baseEnd = new Date(baseStart.getTime() + 60 * 60 * 1000);

  if (row.event_type === 'trollg_fee_paid') {
    return {
      id: row.id,
      title: 'New TrollG Creator',
      description: 'A new TrollG creator has unlocked access. Watch for their gift and vote.',
      type: 'special_event',
      startTime: baseStart,
      endTime: baseEnd,
      isActive: true,
    };
  }

  if (row.event_type === 'gift_submitted') {
    return {
      id: row.id,
      title: 'New TrollG Gift',
      description: 'A new TrollG gift has been submitted — vote now.',
      type: 'special_event',
      startTime: baseStart,
      endTime: baseEnd,
      isActive: true,
    };
  }

  if (row.event_type === 'officer_cycle_started') {
    return {
      id: row.id,
      title: 'Vote: Troll Officer of the Week',
      description: 'Support your favorite broadcaster and cast your vote.',
      type: 'special_event',
      startTime: baseStart,
      endTime: baseEnd,
      isActive: true,
      linkPath: '/officer/vote',
    };
  }

  if (row.event_type === 'officer_cycle_winner') {
    return {
      id: row.id,
      title: 'Troll Officer of the Week Selected',
      description: 'A new Troll Officer has been chosen by the community.',
      type: 'special_event',
      startTime: baseStart,
      endTime: baseEnd,
      isActive: true,
      linkPath: '/officer/vote',
    };
  }

  return {
    id: row.id,
    title: 'Troll City Event',
    description: 'A new city event just dropped. Jump in and participate.',
    type: 'special_event',
    startTime: baseStart,
    endTime: baseEnd,
    isActive: true,
  };
};

const GlobalEventsBanner: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [currentEvent, setCurrentEvent] = useState<GlobalEvent | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setCurrentEvent(null);
      setIsVisible(false);
      return;
    }

    let cancelled = false;

    const loadEvents = async () => {
      const { data: events, error } = await supabase
        .from('vote_events')
        .select('id, event_type, created_at, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error || !events || events.length === 0 || cancelled) {
        setCurrentEvent(null);
        setIsVisible(false);
        return;
      }

      const eventIds = events.map((e) => e.id);

      const { data: dismissals } = await supabase
        .from('user_event_dismissals')
        .select('event_id')
        .eq('user_id', user.id)
        .in('event_id', eventIds);

      const dismissedIds = new Set((dismissals || []).map((d: any) => d.event_id));
      const next = events.find((e) => !dismissedIds.has(e.id));

      if (!next || cancelled) {
        setCurrentEvent(null);
        setIsVisible(false);
        return;
      }

      setCurrentEvent(mapVoteEventToGlobal(next as VoteEventRow));
    };

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!currentEvent) return;

    const updateTimer = () => {
      const now = new Date();
      const targetTime = currentEvent.isActive ? currentEvent.endTime : currentEvent.startTime;
      const diff = targetTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentEvent]);

  useEffect(() => {
    if (!user?.id || !currentEvent) {
      setIsVisible(false);
      return;
    }

    const dismissedKey = `global-event-banner-dismissed-${user.id}-${currentEvent.id}`;
    const shownKey = `global-event-banner-shown-${user.id}-${currentEvent.id}`;
    const isDismissed = sessionStorage.getItem(dismissedKey) === 'true';
    const alreadyShown = sessionStorage.getItem(shownKey) === 'true';

    if (isDismissed || alreadyShown) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    sessionStorage.setItem(shownKey, 'true');
  }, [user?.id, currentEvent]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'double_gift':
        return <Gift className="w-5 h-5 text-yellow-400" />;
      case 'court_night':
        return <Crown className="w-5 h-5 text-purple-400" />;
      case 'family_war_finale':
        return <Trophy className="w-5 h-5 text-orange-400" />;
      case 'bonus_hour':
        return <Zap className="w-5 h-5 text-blue-400" />;
      default:
        return <Flame className="w-5 h-5 text-red-400" />;
    }
  };

  const getEventColors = (type: string) => {
    switch (type) {
      case 'double_gift':
        return 'from-yellow-600 to-orange-600 border-yellow-500';
      case 'court_night':
        return 'from-purple-600 to-pink-600 border-purple-500';
      case 'family_war_finale':
        return 'from-orange-600 to-red-600 border-orange-500';
      case 'bonus_hour':
        return 'from-blue-600 to-cyan-600 border-blue-500';
      default:
        return 'from-red-600 to-pink-600 border-red-500';
    }
  };

  const handleDismiss = () => {
    if (!user?.id) return;
    if (!currentEvent) {
      setIsVisible(false);
      return;
    }
    const dismissedKey = `global-event-banner-dismissed-${user.id}-${currentEvent.id}`;
    sessionStorage.setItem(dismissedKey, 'true');
    setIsVisible(false);
    void (async () => {
      try {
        await supabase
          .from('user_event_dismissals')
          .insert({ event_id: currentEvent.id, user_id: user.id });
      } catch {
      }
    })();
  };

  if (!currentEvent || !isVisible) return null;

  const handleClick = () => {
    if (currentEvent.linkPath) {
      navigate(currentEvent.linkPath);
    }
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 bg-gradient-to-r ${getEventColors(
        currentEvent.type
      )} border-b-2 shadow-lg ${currentEvent.linkPath ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="animate-bounce">{getEventIcon(currentEvent.type)}</div>
            <div>
              <h3 className="text-white font-bold text-lg">
                {currentEvent.isActive ? 'LIVE: ' : 'COMING UP: '}
                {currentEvent.title}
              </h3>
              <p className="text-white/90 text-sm">{currentEvent.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {timeLeft && (
              <div className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-1">
                <Clock className="w-4 h-4 text-white" />
                <span className="text-white font-mono font-bold">
                  {currentEvent.isActive ? `ENDS IN: ${timeLeft}` : `STARTS IN: ${timeLeft}`}
                </span>
              </div>
            )}

            {currentEvent.multiplier && (
              <div className="bg-white/20 rounded-lg px-3 py-1">
                <span className="text-white font-bold">{currentEvent.multiplier}x MULTIPLIER</span>
              </div>
            )}

            <button
              onClick={handleDismiss}
              className="ml-2 inline-flex items-center justify-center rounded-full bg-black/20 hover:bg-black/30 text-white p-2 transition"
              aria-label="Dismiss event banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalEventsBanner;
