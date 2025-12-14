import React, { useState, useEffect } from 'react';
import { Clock, Gift, Trophy, Zap, Crown, Flame, X } from 'lucide-react';
import { useAuthStore } from '../lib/store';

interface GlobalEvent {
  id: string;
  title: string;
  description: string;
  type: 'double_gift' | 'court_night' | 'family_war_finale' | 'bonus_hour' | 'special_event';
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  multiplier?: number;
}

const GlobalEventsBanner: React.FC = () => {
  const { user } = useAuthStore();
  const [currentEvent, setCurrentEvent] = useState<GlobalEvent | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Mock occasional, system-generated events (not every hour)
    const now = Date.now();
    const randomHours = 3 + Math.floor(Math.random() * 5); // 3-7 hours from now
    const start = now + randomHours * 60 * 60 * 1000;
    const end = start + 60 * 60 * 1000; // 1 hour window

    const mockEvents: GlobalEvent[] = [
      {
        id: 'system-double-gift',
        title: 'Double Gift Blast',
        description: 'System-triggered bonus gift window. Watch for surprise drops.',
        type: 'double_gift',
        startTime: new Date(start),
        endTime: new Date(end),
        isActive: false,
        multiplier: 2,
      },
    ];

    // Find the next upcoming event
    const nextEvent = mockEvents
      .filter((event) => event.startTime > new Date())
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];

    if (nextEvent) {
      setCurrentEvent(nextEvent);
    }

    // Check for active events
    const activeEvent = mockEvents.find(
      (event) => event.startTime <= new Date() && event.endTime > new Date()
    );

    if (activeEvent) {
      setCurrentEvent({ ...activeEvent, isActive: true });
    }
  }, []);

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

  // Show only once per login session (not on page refresh) unless dismissed
  useEffect(() => {
    if (!user?.id || !currentEvent) {
      setIsVisible(false);
      return;
    }

    const dismissedKey = `global-event-banner-dismissed-${user.id}`;
    const shownKey = `global-event-banner-shown-${user.id}`;
    const isDismissed = sessionStorage.getItem(dismissedKey) === 'true';
    const alreadyShown = sessionStorage.getItem(shownKey) === 'true';

    if (isDismissed || alreadyShown) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    sessionStorage.setItem(shownKey, 'true');
  }, [user?.id, currentEvent?.id]);

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
    const dismissedKey = `global-event-banner-dismissed-${user.id}`;
    sessionStorage.setItem(dismissedKey, 'true');
    setIsVisible(false);
  };

  if (!currentEvent || !isVisible) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 bg-gradient-to-r ${getEventColors(
        currentEvent.type
      )} border-b-2 shadow-lg`}
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
