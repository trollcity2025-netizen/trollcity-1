import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { usePresenceStore } from '../../lib/presenceStore';
import { Users, Tv, Globe, GripHorizontal, X, ChevronUp, ChevronDown, Minimize2, Maximize2 } from 'lucide-react';

export default function GlobalUserCounter() {
  const { user, profile } = useAuthStore();
  const { onlineCount } = usePresenceStore(); // Read from store instead of channel
  const [inStreamCount, setInStreamCount] = useState(0);
  
  // Draggable state
  const [position, setPosition] = useState({ x: window.innerWidth - 220, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Minimized State
  const [isMinimized, setIsMinimized] = useState(false);

  // Check for ANY staff role
  const isStaff = user && (
      profile?.is_admin || 
      profile?.role === 'admin' || 
      profile?.troll_role === 'admin' ||
      profile?.role === 'troll_officer' ||
      profile?.is_troll_officer ||
      profile?.role === 'secretary' ||
      profile?.role === 'lead_troll_officer' ||
      profile?.role === 'pastor' // Including Pastor as potential staff if needed, but sticking to core for now
  );

  // Handle Window Resize for initial positioning safety
  useEffect(() => {
    const handleResize = () => {
      if (position.x > window.innerWidth - 220) {
        setPosition(prev => ({ ...prev, x: window.innerWidth - 220 }));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position.x]);

  // Stream Stats Polling (In Stream Count)
  useEffect(() => {
    if (!isStaff) return;

    const fetchStreamStats = async () => {
      try {
        const { data, error } = await supabase
          .from('streams')
          .select('current_viewers')
          .eq('is_live', true);

        if (!error && data) {
          // Total Viewers + Total Broadcasters (rows)
          const viewers = data.reduce((acc, curr) => acc + (curr.current_viewers || 0), 0);
          const broadcasters = data.length;
          setInStreamCount(viewers + broadcasters);
        }
      } catch (err) {
        console.error('Error fetching stream stats:', err);
      }
    };

    fetchStreamStats();
    const interval = setInterval(fetchStreamStats, 10000); // Poll every 10s

    return () => clearInterval(interval);
  }, [isStaff]);

  // Dragging Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't drag if clicking buttons
    if ((e.target as HTMLElement).closest('button')) return;

    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isStaff) return null;

  const browsingCount = Math.max(0, onlineCount - inStreamCount);

  if (isMinimized) {
      return (
        <div 
            style={{ left: position.x, top: position.y }}
            className="fixed z-[9999] shadow-xl animate-in fade-in zoom-in duration-300"
        >
             <div 
                className="bg-black/90 backdrop-blur-md border border-yellow-500/50 rounded-full p-2 cursor-move shadow-[0_0_10px_rgba(234,179,8,0.2)] flex items-center gap-2"
                onMouseDown={handleMouseDown}
            >
                <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                </div>
                <button 
                    onClick={() => setIsMinimized(false)}
                    className="text-yellow-500 hover:text-yellow-300 transition-colors"
                >
                    <Maximize2 size={16} />
                </button>
            </div>
        </div>
      );
  }

  return (
    <div 
      style={{ left: position.x, top: position.y }}
      className="fixed z-[9999] shadow-2xl animate-in fade-in zoom-in duration-300"
    >
        <div className="bg-black/90 backdrop-blur-md border border-yellow-500/50 rounded-xl overflow-hidden min-w-[200px] shadow-[0_0_15px_rgba(234,179,8,0.2)]">
            {/* Header / Drag Handle */}
            <div 
                onMouseDown={handleMouseDown}
                className="bg-gradient-to-r from-yellow-900/40 to-black p-2 border-b border-yellow-500/20 cursor-move flex items-center justify-between group select-none"
            >
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                    </span>
                    <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">Ops Counter</span>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setIsMinimized(true)}
                        className="text-yellow-500/50 hover:text-yellow-400 transition-colors p-1"
                    >
                        <Minimize2 size={14} />
                    </button>
                    <GripHorizontal size={14} className="text-yellow-500/50 group-hover:text-yellow-400 transition-colors" />
                </div>
            </div>

            {/* Counters */}
            <div className="p-3 space-y-3">
                {/* Online */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-yellow-100/80">
                        <Users size={14} className="text-yellow-500" />
                        <span className="text-xs font-medium">Online</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-yellow-400">{onlineCount}</span>
                </div>

                {/* In Stream */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-yellow-100/80">
                        <Tv size={14} className="text-orange-400" />
                        <span className="text-xs font-medium">In Stream</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-orange-400">{inStreamCount}</span>
                </div>

                {/* Browsing */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-yellow-100/80">
                        <Globe size={14} className="text-blue-400" />
                        <span className="text-xs font-medium">Browsing</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-blue-400">{browsingCount}</span>
                </div>
            </div>
        </div>
    </div>
  );
}
