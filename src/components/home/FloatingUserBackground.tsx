import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';

export interface FloatingUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  isLive: boolean;
  streamId?: string;
}

interface Bubble {
  id: string;
  user: FloatingUser;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hovered: boolean;
}

interface FloatingUserBackgroundProps {
  maxUsers?: number;
  rotationInterval?: number;
  className?: string;
}

const BUBBLE_SIZE = 56;
const MIN_SPEED = 0.4;
const MAX_SPEED = 1.5;
const BOUNCE_DAMPING = 0.9;
const FRICTION = 0.998;

export const FloatingUserBackground: React.FC<FloatingUserBackgroundProps> = ({
  maxUsers = 15,
  rotationInterval = 15000,
  className = ''
}) => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [allUsers, setAllUsers] = useState<FloatingUser[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const dimensionsRef = useRef({ width: 1200, height: 800 });

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      dimensionsRef.current = {
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      };
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data: liveUsers, error: liveError } = await supabase
        .from('streams')
        .select('id, user_id')
        .eq('is_live', true)
        .limit(50);

      if (liveError) throw liveError;

      const liveUserIds = (liveUsers || []).map((l: any) => l.user_id).filter(Boolean);

      const { data: liveProfiles, error: profilesError } = liveUserIds.length > 0
        ? await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', liveUserIds)
        : { data: [], error: null };

      if (profilesError && liveUserIds.length > 0) throw profilesError;

      const liveMap = new Map((liveUsers || []).map((l: any) => [
        l.user_id,
        { isLive: true, streamId: l.id }
      ]));

      const liveProfileMap = new Map((liveProfiles || []).map((p: any) => [
        p.id,
        p
      ]));

      const combinedUsers: FloatingUser[] = [];

      (liveUsers || []).forEach((stream: any) => {
        const profile = liveProfileMap.get(stream.user_id);
        if (profile) {
          combinedUsers.push({
            id: stream.user_id,
            username: profile.username || 'Unknown',
            avatarUrl: profile.avatar_url,
            isLive: true,
            streamId: stream.id
          });
        }
      });

      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .not('avatar_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (profileError) throw profileError;

      const seenIds = new Set(combinedUsers.map(u => u.id));

      (profiles || []).forEach((profile) => {
        if (!seenIds.has(profile.id)) {
          seenIds.add(profile.id);
          const liveInfo = liveMap.get(profile.id);
          combinedUsers.push({
            id: profile.id,
            username: profile.username || 'Unknown',
            avatarUrl: profile.avatar_url,
            isLive: liveInfo?.isLive || false,
            streamId: liveInfo?.streamId
          });
        }
      });

      const filtered = combinedUsers.filter(u => u.id !== currentUser?.id);
      setAllUsers(filtered);
    } catch (err) {
      console.error('Error fetching users for background:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  const initializeBubbles = useCallback((users: FloatingUser[]) => {
    const { width, height } = dimensionsRef.current;
    
    if (width <= 0 || height <= 0 || users.length === 0) return;

    const centerX = width * 0.5;
    const sideMargin = width * 0.25;
    const topMargin = 100;

    const newBubbles: Bubble[] = users.slice(0, maxUsers).map((user, index) => {
      const isLeft = index % 2 === 0;
      const baseX = isLeft ? sideMargin * 0.3 : width - sideMargin * 0.3;
      const spreadY = height - topMargin - 120;
      
      const angle = Math.random() * Math.PI * 0.5 - Math.PI * 0.25;
      const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);

      return {
        id: `${user.id}-${Date.now()}-${index}`,
        user,
        x: baseX + (Math.random() - 0.5) * 60,
        y: topMargin + (index / maxUsers) * spreadY + Math.random() * 40,
        vx: isLeft ? Math.cos(angle) * speed : -Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        radius: BUBBLE_SIZE / 2,
        hovered: false,
      };
    });

    bubblesRef.current = newBubbles;
    setBubbles(newBubbles);
  }, [maxUsers]);

  useEffect(() => {
    if (allUsers.length === 0 || dimensionsRef.current.width <= 0) return;
    
    initializeBubbles(allUsers);
    
    const rotationTimer = setInterval(() => {
      if (allUsers.length > maxUsers) {
        initializeBubbles(allUsers);
      }
    }, rotationInterval);
    return () => clearInterval(rotationTimer);
  }, [allUsers, maxUsers, rotationInterval, initializeBubbles]);

  useEffect(() => {
    updateDimensions();
    const handleResize = () => {
      updateDimensions();
      if (bubblesRef.current.length === 0 && allUsers.length > 0) {
        initializeBubbles(allUsers);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateDimensions, allUsers, initializeBubbles]);

  useEffect(() => {
    const animate = () => {
      const { width, height } = dimensionsRef.current;
      
      if (width <= 0 || height <= 0 || bubblesRef.current.length === 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const centerX = width * 0.5;
      const sideMargin = width * 0.25;
      const topMargin = 100;
      const bottomMargin = 120;
      const bubbleRadius = BUBBLE_SIZE / 2;

      let updatedBubbles = bubblesRef.current.map(bubble => ({ ...bubble }));

      for (let i = 0; i < updatedBubbles.length; i++) {
        for (let j = i + 1; j < updatedBubbles.length; j++) {
          const b1 = updatedBubbles[i];
          const b2 = updatedBubbles[j];

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = b1.radius + b2.radius + 8;

          if (dist < minDist && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;

            const overlap = minDist - dist;
            const totalMass = b1.radius + b2.radius;
            const ratio1 = b2.radius / totalMass;
            const ratio2 = b1.radius / totalMass;

            b1.x -= nx * overlap * ratio1;
            b1.y -= ny * overlap * ratio1;
            b2.x += nx * overlap * ratio2;
            b2.y += ny * overlap * ratio2;

            const dvx = b1.vx - b2.vx;
            const dvy = b1.vy - b2.vy;
            const dvn = dvx * nx + dvy * ny;

            if (dvn > 0) {
              const impulse = dvn * BOUNCE_DAMPING;
              b1.vx -= impulse * nx;
              b1.vy -= impulse * ny;
              b2.vx += impulse * nx;
              b2.vy += impulse * ny;
            }
          }
        }
      }

      updatedBubbles = updatedBubbles.map(bubble => {
        let { x, y, vx, vy, radius } = bubble;

        x += vx;
        y += vy;

        vx *= FRICTION;
        vy *= FRICTION;

        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed < MIN_SPEED * 0.5) {
          const angle = Math.random() * Math.PI * 2;
          vx = Math.cos(angle) * MIN_SPEED;
          vy = Math.sin(angle) * MIN_SPEED;
        }

        const isLeftSide = x < centerX;
        
        const leftMinX = sideMargin * 0.1;
        const leftMaxX = sideMargin * 0.85;
        const rightMinX = width - sideMargin * 0.85;
        const rightMaxX = width - sideMargin * 0.1;

        const boundaryMinX = isLeftSide ? leftMinX : rightMinX;
        const boundaryMaxX = isLeftSide ? leftMaxX : rightMaxX;

        if (x - radius < boundaryMinX) {
          x = boundaryMinX + radius;
          vx = Math.abs(vx) * BOUNCE_DAMPING;
        }
        if (x + radius > boundaryMaxX) {
          x = boundaryMaxX - radius;
          vx = -Math.abs(vx) * BOUNCE_DAMPING;
        }

        if (y - radius < topMargin) {
          y = topMargin + radius;
          vy = Math.abs(vy) * BOUNCE_DAMPING;
        }
        if (y + radius > height - bottomMargin) {
          y = height - bottomMargin - radius;
          vy = -Math.abs(vy) * BOUNCE_DAMPING;
        }

        return { ...bubble, x, y, vx, vy };
      });

      bubblesRef.current = updatedBubbles;
      setBubbles([...updatedBubbles]);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleUserClick = useCallback((user: FloatingUser) => {
    if (user.isLive && user.streamId) {
      navigate(`/watch/${user.streamId}`);
    } else {
      navigate(`/profile/${user.id}`);
    }
  }, [navigate]);

  const handleHover = useCallback((bubbleId: string, hovered: boolean) => {
    bubblesRef.current = bubblesRef.current.map(b => 
      b.id === bubbleId ? { ...b, hovered } : b
    );
    setBubbles([...bubblesRef.current]);
  }, []);

  const globalStyles = `
    @keyframes live-glow {
      0%, 100% { box-shadow: 0 0 12px rgba(239, 68, 153, 0.4), 0 0 24px rgba(239, 68, 153, 0.2); }
      50% { box-shadow: 0 0 16px rgba(239, 68, 153, 0.6), 0 0 32px rgba(239, 68, 153, 0.3); }
    }
    .animate-live-glow {
      animation: live-glow 2s ease-in-out infinite;
    }
    .bubble-transition {
      transition: transform 0.15s ease-out, box-shadow 0.2s ease-out;
    }
  `;

  if (isLoading && allUsers.length === 0) {
    return null;
  }

  return (
    <>
      <style>{globalStyles}</style>
      <div ref={containerRef} className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/40 via-transparent to-slate-950/40 pointer-events-none" />
        
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-[5%] w-64 h-64 bg-purple-600/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-[5%] w-56 h-56 bg-pink-600/25 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className="absolute bubble-transition"
            style={{
              left: bubble.x - bubble.radius,
              top: bubble.y - bubble.radius,
              width: BUBBLE_SIZE,
              height: BUBBLE_SIZE,
              pointerEvents: 'auto',
              transform: bubble.hovered ? 'scale(1.15)' : 'scale(1)',
              zIndex: bubble.hovered ? 100 : 10,
            }}
            onMouseEnter={() => handleHover(bubble.id, true)}
            onMouseLeave={() => handleHover(bubble.id, false)}
            onClick={() => handleUserClick(bubble.user)}
          >
            <div
              className={`
                w-full h-full rounded-full overflow-hidden
                border-2 ${bubble.user.isLive 
                  ? 'border-red-500 animate-live-glow' 
                  : 'border-white/30 hover:border-purple-400/70'
                }
                bg-slate-800
                cursor-pointer
              `}
            >
              {bubble.user.avatarUrl ? (
                <img
                  src={bubble.user.avatarUrl}
                  alt={bubble.user.username}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(bubble.user.username || 'User')}&background=6b21a8&color=fff&size=64`}
                  alt={bubble.user.username}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {bubble.user.isLive && (
              <div className="absolute -bottom-0.5 -right-0.5 flex items-center gap-0.5 px-1 py-0.5 bg-red-600 rounded-full">
                <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
              </div>
            )}

            <div 
              className={`
                absolute left-1/2 -translate-x-1/2 top-full mt-1.5 
                opacity-0 ${bubble.hovered ? 'opacity-100' : ''} 
                transition-opacity duration-150 
                pointer-events-none whitespace-nowrap z-20
              `}
            >
              <div className="bg-slate-950/95 backdrop-blur-sm border border-white/10 rounded-lg px-2 py-1 shadow-lg">
                <p className="text-xs font-medium text-white">{bubble.user.username}</p>
                {bubble.user.isLive && (
                  <p className="text-[10px] text-red-400 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                    Live
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default FloatingUserBackground;
