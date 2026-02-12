import React, { useState, useEffect } from 'react';
import { Clock, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

const EventCountdown: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  } | null>(null);
  const [eventActive, setEventActive] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      // Fetch the event data using the RPC
      const { data: eventData } = await supabase.rpc('get_active_event');
      const event = eventData?.[0];

      if (event) {
        const updateTimer = () => {
          const startTime = new Date(event.start_time).getTime();
          const durationMs = event.duration_hours * 60 * 60 * 1000;
          const endTime = startTime + durationMs;
          const now = Date.now();
          
          const diff = endTime - now;

          if (diff > 0) {
            const totalSeconds = Math.floor(diff / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            setTimeLeft({ hours, minutes, seconds, totalSeconds });
            setEventActive(true);
          } else {
            setTimeLeft(null);
            setEventActive(false);
          }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
      }
    };

    fetchEvent();
  }, []);

  if (!eventActive || !timeLeft) return null;

  return (
    <div className="w-full bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 border-b border-white/10 overflow-hidden relative group">
      {/* Animated background pulse */}
      <div className="absolute inset-0 bg-white/5 animate-pulse" />
      
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Sparkles className="w-5 h-5 text-purple-400 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm sm:text-base leading-tight">
              Troll City is OPEN for Public!
            </h3>
            <p className="text-purple-200/70 text-xs">
              Limited time event: Preview broadcasts and join the movement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/5">
            <Clock className="w-4 h-4 text-purple-400" />
            <div className="flex gap-1.5 font-mono text-lg font-black text-white">
              <span className="w-8 text-center">{timeLeft.hours.toString().padStart(2, '0')}</span>
              <span className="text-purple-500/50">:</span>
              <span className="w-8 text-center">{timeLeft.minutes.toString().padStart(2, '0')}</span>
              <span className="text-purple-500/50">:</span>
              <span className="w-8 text-center">{timeLeft.seconds.toString().padStart(2, '0')}</span>
            </div>
          </div>

          <Link
            to="/auth?signup=true"
            className="px-6 py-2 bg-white text-purple-900 font-bold rounded-full text-sm hover:bg-purple-100 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            JOIN NOW
          </Link>
        </div>
      </div>

      <style>
        {`
          @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin-slow {
            animation: spin-slow 8s linear infinite;
          }
        `}
      </style>
    </div>
  );
};

export default EventCountdown;
