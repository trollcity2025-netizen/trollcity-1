/**
 * StreamSwipePage - TikTok-style full-screen vertical swipe navigation for live streams
 * 
 * Features:
 * - Category tabs: Battle, Top Streamers, Podcast, Gaming
 * - Full-screen vertical swipe to navigate between streams
 * - Mute audio during swipe, unmute on settle
 * - Stream stack indicator showing current position
 * - Mobile only - redirects to ExploreFeed on desktop
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Stream } from '../types/broadcast';
import { toast } from 'sonner';
import { Loader2, X, Radio, Crown, Mic, Gamepad2, Flame } from 'lucide-react';
import { cn } from '../lib/utils';
import StreamSwipeCard from '../components/broadcast/StreamSwipeCard';
import BattleSwipeCard from '../components/broadcast/BattleSwipeCard';
import StreamStackIndicator from '../components/broadcast/StreamStackIndicator';

// Category types for the swipe interface
export type SwipeCategory = 'battle' | 'top' | 'podcast' | 'gaming';

interface StreamSwipePageProps {
  // Optional initial category from route
  initialCategory?: SwipeCategory;
}

// Category configuration
const CATEGORIES: { id: SwipeCategory; label: string; icon: React.ReactNode; query: string | null }[] = [
  { id: 'battle', label: 'Battle', icon: <Flame className="w-4 h-4" />, query: 'trollmers' },
  { id: 'top', label: 'Top Streamers', icon: <Crown className="w-4 h-4" />, query: null }, // All categories
  { id: 'podcast', label: 'Podcast', icon: <Mic className="w-4 h-4" />, query: 'podcast' },
  { id: 'gaming', label: 'Gaming', icon: <Gamepad2 className="w-4 h-4" />, query: 'gaming' },
];

// Extended stream type with profile data
interface StreamWithProfile extends Stream {
  broadcaster?: {
    username: string;
    avatar_url: string | null;
    level?: number;
  };
}

export default function StreamSwipePage({ initialCategory = 'top' }: StreamSwipePageProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [searchParams] = useSearchParams();
  
  // State
  const [activeCategory, setActiveCategory] = useState<SwipeCategory>(initialCategory);
  const [streams, setStreams] = useState<StreamWithProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);
  const isAnimating = useRef(false);
  
  // Check if desktop and redirect
  useEffect(() => {
    const checkDevice = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isMobileWidth = window.innerWidth < 768;
      const isMobileDevice = mobile || isMobileWidth;
      
      if (!isMobileDevice) {
        setIsDesktop(true);
        navigate('/explore', { replace: true });
      }
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, [navigate]);
  
  // Fetch streams based on category
  const fetchStreams = useCallback(async (category: SwipeCategory) => {
    setLoading(true);
    
    try {
      const categoryConfig = CATEGORIES.find(c => c.id === category);
      const categoryQuery = categoryConfig?.query;
      
      let query = supabase
        .from('streams')
        .select(`
          *,
          broadcaster:user_profiles!streams_user_id_fkey(
            username,
            avatar_url,
            level
          )
        `)
        .eq('is_live', true)
        .eq('status', 'live')
        .order('current_viewers', { ascending: false })
        .limit(50);
      
      // Apply category filter
      if (category === 'battle') {
        // Battle streams - is_battle = true or category = trollmers
        query = supabase
          .from('streams')
          .select(`
            *,
            broadcaster:user_profiles!streams_user_id_fkey(
              username,
              avatar_url,
              level
            )
          `)
          .eq('is_live', true)
          .eq('status', 'live')
          .or('is_battle.eq.true,category.eq.trollmers')
          .order('current_viewers', { ascending: false })
          .limit(50);
      } else if (categoryQuery) {
        // Specific category
        query = query.eq('category', categoryQuery);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Format streams with broadcaster data
      const formattedStreams: StreamWithProfile[] = (data || []).map(stream => ({
        ...stream,
        broadcaster: Array.isArray(stream.broadcaster) 
          ? stream.broadcaster[0] 
          : stream.broadcaster
      }));
      
      setStreams(formattedStreams);
      setCurrentIndex(0);
      
      // If no streams, try fetching from pod_rooms for podcast category
      if (category === 'podcast' && formattedStreams.length === 0) {
        const { data: podsData } = await supabase
          .from('pod_rooms')
          .select(`
            *,
            broadcaster:user_profiles!pod_rooms_host_id_fkey(
              username,
              avatar_url,
              level
            )
          `)
          .eq('is_live', true)
          .order('viewer_count', { ascending: false })
          .limit(50);
        
        if (podsData) {
          const podStreams: StreamWithProfile[] = podsData.map(pod => ({
            id: pod.id,
            user_id: pod.host_id,
            title: pod.title,
            category: 'podcast',
            status: 'live' as const,
            is_battle: false,
            viewer_count: pod.viewer_count || 0,
            current_viewers: pod.viewer_count || 0,
            box_count: 1,
            layout_mode: 'spotlight' as const,
            started_at: pod.started_at,
            ended_at: null,
            created_at: pod.created_at,
            seat_price: 0,
            are_seats_locked: false,
            has_rgb_effect: false,
            broadcaster: Array.isArray(pod.broadcaster)
              ? pod.broadcaster[0]
              : pod.broadcaster
          }));
          
          setStreams(podStreams);
        }
      }
      
    } catch (error) {
      console.error('Error fetching streams:', error);
      toast.error('Failed to load streams');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Initial load and category change
  useEffect(() => {
    fetchStreams(activeCategory);
  }, [activeCategory, fetchStreams]);
  
  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating.current || streams.length === 0) return;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
  }, [streams.length]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isAnimating.current || streams.length === 0) return;
    
    touchCurrentY.current = e.touches[0].clientY;
    const diff = touchStartY.current - touchCurrentY.current;
    
    // Check if we're at boundaries
    const atStart = currentIndex === 0 && diff < 0;
    const atEnd = currentIndex === streams.length - 1 && diff > 0;
    
    if (atStart || atEnd) {
      // Apply resistance at boundaries
      setSwipeOffset(diff * 0.3);
    } else {
      setSwipeOffset(diff);
    }
    
    // Mute audio when actively swiping
    if (Math.abs(diff) > 20 && !isMuted) {
      setIsMuted(true);
      setIsSwiping(true);
    }
  }, [currentIndex, streams.length, isMuted]);
  
  const handleTouchEnd = useCallback(() => {
    if (streams.length === 0) return;
    
    const diff = touchStartY.current - touchCurrentY.current;
    const threshold = 100; // Pixels to trigger swipe
    
    isAnimating.current = true;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentIndex < streams.length - 1) {
        // Swipe up - next stream
        setCurrentIndex(prev => prev + 1);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe down - previous stream
        setCurrentIndex(prev => prev - 1);
      }
    }
    
    // Reset swipe state
    setSwipeOffset(0);
    setIsSwiping(false);
    
    // Unmute after a short delay
    setTimeout(() => {
      setIsMuted(false);
      isAnimating.current = false;
    }, 300);
  }, [currentIndex, streams.length]);
  
  // Handle keyboard navigation (accessibility)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        setIsMuted(true);
        setTimeout(() => setIsMuted(false), 500);
      } else if (e.key === 'ArrowDown' && currentIndex < streams.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsMuted(true);
        setTimeout(() => setIsMuted(false), 500);
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, streams.length]);
  
  const handleClose = () => {
    navigate('/explore');
  };
  
  const handleCategoryChange = (category: SwipeCategory) => {
    setActiveCategory(category);
    setCurrentIndex(0);
    setIsMuted(false);
  };
  
  // Get current stream
  const currentStream = streams[currentIndex];
  const isBattleStream = currentStream?.is_battle || currentStream?.category === 'trollmers';
  
  // Loading state
  if (loading && streams.length === 0) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-white" />
          <p className="text-white/60 text-sm">Loading streams...</p>
        </div>
      </div>
    );
  }
  
  // Empty state
  if (!loading && streams.length === 0) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-8">
        <Radio className="w-16 h-16 text-white/30 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">No live streams</h2>
        <p className="text-white/50 text-center mb-6">
          There are no live {activeCategory === 'battle' ? 'battles' : activeCategory === 'podcast' ? 'podcasts' : activeCategory === 'gaming' ? 'gaming streams' : 'streams'} right now.
        </p>
        <button
          onClick={handleClose}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
        >
          Go to Explore
        </button>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-50 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-all"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <X className="w-5 h-5" />
      </button>
      
      {/* Category tabs */}
      <div 
        className="absolute top-0 left-0 right-0 z-40 flex justify-center gap-1 p-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 16px) + 8px)' }}
      >
        <div className="flex gap-1 bg-black/40 backdrop-blur-md rounded-full p-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
                activeCategory === cat.id
                  ? "bg-white text-black"
                  : "text-white/70 hover:text-white"
              )}
            >
              {cat.icon}
              <span className="hidden sm:inline">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Stream carousel */}
      <div 
        className="w-full h-full transition-transform duration-300 ease-out"
        style={{
          transform: `translateY(${-currentIndex * 100}%) translateY(${swipeOffset}px)`,
        }}
      >
        {streams.map((stream, index) => {
          const isActive = index === currentIndex;
          const isBattle = stream.is_battle || stream.category === 'trollmers';
          
          return (
            <div
              key={stream.id}
              className="w-full h-full absolute"
              style={{ top: `${index * 100}%` }}
            >
              {isBattle ? (
                <BattleSwipeCard
                  stream={stream}
                  isActive={isActive}
                  isMuted={isMuted && isActive}
                  onClose={handleClose}
                />
              ) : (
                <StreamSwipeCard
                  stream={stream}
                  isActive={isActive}
                  isMuted={isMuted && isActive}
                  onClose={handleClose}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Stream stack indicator */}
      <StreamStackIndicator
        totalStreams={streams.length}
        currentIndex={currentIndex}
        onDotClick={(index) => {
          setCurrentIndex(index);
          setIsMuted(true);
          setTimeout(() => setIsMuted(false), 500);
        }}
      />
      
      {/* Swipe hint for first time */}
      {currentIndex === 0 && !loading && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 animate-bounce">
          <div className="flex flex-col items-center gap-1 text-white/50">
            <span className="text-xs">Swipe up for more</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
