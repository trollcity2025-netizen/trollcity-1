import React, { useState, useEffect } from 'react';
import { Clock, Gift, Trophy, Zap, Crown, Flame } from 'lucide-react';

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
  const [currentEvent, setCurrentEvent] = useState<GlobalEvent | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    // Mock upcoming events - in real app this would come from database
    const mockEvents: GlobalEvent[] = [
      {
        id: '1',
        title: 'Double Gift Hour',
        description: 'All gifts are worth DOUBLE for the next hour!',
        type: 'double_gift',
        startTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        endTime: new Date(Date.now() + 90 * 60 * 1000), // 90 minutes from now
        isActive: false,
        multiplier: 2
      },
      {
        id: '2',
        title: 'Court Night',
        description: 'Official rulings and justice served tonight',
        type: 'court_night',
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        isActive: false
      }
    ];

    // Find the next upcoming event
    const nextEvent = mockEvents
      .filter(event => event.startTime > new Date())
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];

    if (nextEvent) {
      setCurrentEvent(nextEvent);
    }

    // Check for active events
    const activeEvent = mockEvents.find(event =>
      event.startTime <= new Date() && event.endTime > new Date()
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

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'double_gift': return <Gift className="w-5 h-5 text-yellow-400" />;
      case 'court_night': return <Crown className="w-5 h-5 text-purple-400" />;
      case 'family_war_finale': return <Trophy className="w-5 h-5 text-orange-400" />;
      case 'bonus_hour': return <Zap className="w-5 h-5 text-blue-400" />;
      default: return <Flame className="w-5 h-5 text-red-400" />;
    }
  };

  const getEventColors = (type: string) => {
    switch (type) {
      case 'double_gift': return 'from-yellow-600 to-orange-600 border-yellow-500';
      case 'court_night': return 'from-purple-600 to-pink-600 border-purple-500';
      case 'family_war_finale': return 'from-orange-600 to-red-600 border-orange-500';
      case 'bonus_hour': return 'from-blue-600 to-cyan-600 border-blue-500';
      default: return 'from-red-600 to-pink-600 border-red-500';
    }
  };

  if (!currentEvent) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 bg-gradient-to-r ${getEventColors(currentEvent.type)} border-b-2 shadow-lg`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="animate-bounce">
              {getEventIcon(currentEvent.type)}
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">
                {currentEvent.isActive ? '🔥 LIVE: ' : '⏰ COMING UP: '}
                {currentEvent.title}
              </h3>
              <p className="text-white/90 text-sm">
                {currentEvent.description}
              </p>
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
                <span className="text-white font-bold">
                  {currentEvent.multiplier}x MULTIPLIER
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalEventsBanner;