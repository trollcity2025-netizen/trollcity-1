import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { usePresenceStore } from '../../lib/presenceStore';
import { useChatStore } from '../../lib/chatStore';
import { Users, Tv, Globe, GripHorizontal, Minimize2, Maximize2, Headphones, ExternalLink, RefreshCw, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';

interface UserLocation {
  user_id: string;
  username: string;
  avatar_url?: string;
  location_type: 'stream' | 'pod' | 'browsing' | 'online';
  location_name?: string;
  location_id?: string;
  joined_at?: string;
}

export default function GlobalUserCounter() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { onlineCount, onlineUserIds } = usePresenceStore(); // Read from store instead of channel
  const { openChatBubble } = useChatStore();
  const [inStreamCount, setInStreamCount] = useState(0);
  const [inPodCount, setInPodCount] = useState(0);
  
  // Interactive State
  const [activeCategory, setActiveCategory] = useState<'online' | 'stream' | 'pods' | 'browsing' | null>(null);
  const [categoryUsers, setCategoryUsers] = useState<UserLocation[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // Draggable state
  const [position, setPosition] = useState({ x: window.innerWidth - 220, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(position); // Keep track of latest position to sync with state on drag end

  // Sync ref with state when state updates (e.g. initial render or resize)
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

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
      profile?.role === 'lead_troll_officer'
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

  // Stream & Pod Stats Polling
  const fetchStats = async () => {
    try {
      // 1. Stream Stats (Viewers + Broadcasters)
      const { data: streams, error: streamError } = await supabase
        .from('streams')
        .select('current_viewers, user_id')
        .eq('is_live', true);

      if (!streamError && streams) {
        const viewers = streams.reduce((acc, curr) => acc + (curr.current_viewers || 0), 0);
        const broadcasters = streams.length;
        setInStreamCount(viewers + broadcasters);
      }

      // 2. Pod Stats
      const { data: podRooms, error: podRoomsError } = await supabase
        .from('pod_rooms')
        .select('id')
        .eq('is_live', true);

      if (!podRoomsError && podRooms) {
        if (podRooms.length === 0) {
          setInPodCount(0);
        } else {
          const roomIds = podRooms.map(r => r.id);
          const { count, error: countError } = await supabase
            .from('pod_room_participants')
            .select('*', { count: 'exact', head: true })
            .in('room_id', roomIds);
          
          if (!countError) {
            setInPodCount(count || 0);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    if (!isStaff) return;
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [isStaff]);

  const handleCategoryClick = async (category: 'online' | 'stream' | 'pods' | 'browsing') => {
    if (!isStaff) return;
    setActiveCategory(category);
    setIsLoadingDetails(true);
    setCategoryUsers([]);

    try {
        const users: UserLocation[] = [];

        // Fetch Data Helpers
        const fetchStreamUsers = async () => {
            const streamUsers: UserLocation[] = [];
            
            // Get live streams
            const { data: streams } = await supabase
                .from('streams')
                .select('id, title, user_id, user_profiles!streams_user_id_fkey(username, avatar_url)')
                .eq('is_live', true);
            
            if (streams) {
                // Add broadcasters
                streams.forEach(s => {
                    if (s.user_profiles) {
                        streamUsers.push({
                            user_id: s.user_id,
                            username: (s.user_profiles as any).username,
                            avatar_url: (s.user_profiles as any).avatar_url,
                            location_type: 'stream',
                            location_name: `Broadcasting: ${s.title}`,
                            location_id: s.id
                        });
                    }
                });

                // Get viewers
                const streamIds = streams.map(s => s.id);
                if (streamIds.length > 0) {
                    const { data: viewers } = await supabase
                        .from('stream_viewers')
                        .select('user_id, stream_id, user_profiles(username, avatar_url)')
                        .in('stream_id', streamIds);
                    
                    if (viewers) {
                        viewers.forEach(v => {
                            const stream = streams.find(s => s.id === v.stream_id);
                            if (v.user_profiles) {
                                streamUsers.push({
                                    user_id: v.user_id,
                                    username: (v.user_profiles as any).username,
                                    avatar_url: (v.user_profiles as any).avatar_url,
                                    location_type: 'stream',
                                    location_name: `Watching: ${stream?.title || 'Unknown Stream'}`,
                                    location_id: v.stream_id
                                });
                            }
                        });
                    }
                }
            }
            return streamUsers;
        };

        const fetchPodUsers = async () => {
            const podUsers: UserLocation[] = [];
            const { data: participants } = await supabase
                .from('pod_room_participants')
                .select('user_id, room_id, user_profiles(username, avatar_url), pod_rooms(title)')
                .eq('is_active', true); // Assuming is_active flag or just existence

            if (participants) {
                participants.forEach(p => {
                    if (p.user_profiles) {
                        podUsers.push({
                            user_id: p.user_id,
                            username: (p.user_profiles as any).username,
                            avatar_url: (p.user_profiles as any).avatar_url,
                            location_type: 'pod',
                            location_name: `In Pod: ${(p.pod_rooms as any)?.title || 'Unknown Pod'}`,
                            location_id: p.room_id
                        });
                    }
                });
            }
            return podUsers;
        };

        if (category === 'online') {
            // Just fetch all online profiles
            if (onlineUserIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('user_profiles')
                    .select('id, username, avatar_url')
                    .in('id', onlineUserIds);
                
                if (profiles) {
                    profiles.forEach(p => {
                        users.push({
                            user_id: p.id,
                            username: p.username,
                            avatar_url: p.avatar_url,
                            location_type: 'online',
                            location_name: 'Online'
                        });
                    });
                }
            }
        } else if (category === 'stream') {
            const sUsers = await fetchStreamUsers();
            users.push(...sUsers);
        } else if (category === 'pods') {
            const pUsers = await fetchPodUsers();
            users.push(...pUsers);
        } else if (category === 'browsing') {
            // Browsing = Online - (Stream + Pods)
            const [sUsers, pUsers] = await Promise.all([fetchStreamUsers(), fetchPodUsers()]);
            const busyUserIds = new Set([...sUsers, ...pUsers].map(u => u.user_id));
            
            // Get all online
            if (onlineUserIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('user_profiles')
                    .select('id, username, avatar_url')
                    .in('id', onlineUserIds);
                
                if (profiles) {
                    profiles.forEach(p => {
                        if (!busyUserIds.has(p.id)) {
                            users.push({
                                user_id: p.id,
                                username: p.username,
                                avatar_url: p.avatar_url,
                                location_type: 'browsing',
                                location_name: 'Browsing Platform'
                            });
                        }
                    });
                }
            }
        }

        setCategoryUsers(users);
    } catch (error) {
        console.error('Error fetching details:', error);
    } finally {
        setIsLoadingDetails(false);
    }
  };

  const handleAction = (user: UserLocation) => {
      // Navigate to location if applicable
      if (user.location_type === 'stream' && user.location_id) {
          navigate(`/stream/${user.location_id}`);
          setActiveCategory(null);
      } else if (user.location_type === 'pod' && user.location_id) {
          navigate(`/pods/${user.location_id}`);
          setActiveCategory(null);
      } else {
          // View profile or other action
          navigate(`/profile/${user.username}`);
          setActiveCategory(null);
      }
  };

  // Dragging Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't drag if clicking buttons
    if ((e.target as HTMLElement).closest('button')) return;

    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y
    };
  };

  useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;

      positionRef.current = { x: newX, y: newY };

      // Use requestAnimationFrame for smoother visual updates
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.style.left = `${newX}px`;
          containerRef.current.style.top = `${newY}px`;
        }
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      cancelAnimationFrame(animationFrameId);
      setPosition(positionRef.current); // Sync state on drop
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDragging]);

  if (!isStaff) return null;

  const browsingCount = Math.max(0, onlineCount - inStreamCount - inPodCount);

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
      ref={containerRef}
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
            <div className="p-3 space-y-1">
                {/* Online */}
                <div 
                    onClick={() => handleCategoryClick('online')}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-white/10 cursor-pointer transition-colors group"
                >
                    <div className="flex items-center gap-2 text-yellow-100/80 group-hover:text-white">
                        <Users size={14} className="text-yellow-500" />
                        <span className="text-xs font-medium">Online</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-yellow-400">{onlineCount}</span>
                </div>

                {/* In Stream */}
                <div 
                    onClick={() => handleCategoryClick('stream')}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-white/10 cursor-pointer transition-colors group"
                >
                    <div className="flex items-center gap-2 text-yellow-100/80 group-hover:text-white">
                        <Tv size={14} className="text-orange-400" />
                        <span className="text-xs font-medium">In Stream</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-orange-400">{inStreamCount}</span>
                </div>

                {/* In Pods */}
                <div 
                    onClick={() => handleCategoryClick('pods')}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-white/10 cursor-pointer transition-colors group"
                >
                    <div className="flex items-center gap-2 text-yellow-100/80 group-hover:text-white">
                        <Headphones size={14} className="text-purple-400" />
                        <span className="text-xs font-medium">In Pods</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-purple-400">{inPodCount}</span>
                </div>

                {/* Browsing */}
                <div 
                    onClick={() => handleCategoryClick('browsing')}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-white/10 cursor-pointer transition-colors group"
                >
                    <div className="flex items-center gap-2 text-yellow-100/80 group-hover:text-white">
                        <Globe size={14} className="text-blue-400" />
                        <span className="text-xs font-medium">Browsing</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-blue-400">{browsingCount}</span>
                </div>
            </div>
        </div>
        
        <Dialog open={!!activeCategory} onOpenChange={(open) => !open && setActiveCategory(null)}>
            <DialogContent className="max-w-md bg-black/95 border border-yellow-500/20 text-white backdrop-blur-xl">
                <DialogHeader className="border-b border-white/10 pb-4">
                    <DialogTitle className="text-yellow-500 flex items-center justify-between uppercase tracking-widest text-sm font-bold">
                        <span className="flex items-center gap-2">
                           {activeCategory === 'online' && <Users className="w-4 h-4" />}
                           {activeCategory === 'stream' && <Tv className="w-4 h-4" />}
                           {activeCategory === 'pods' && <Headphones className="w-4 h-4" />}
                           {activeCategory === 'browsing' && <Globe className="w-4 h-4" />}
                           {activeCategory} Users ({categoryUsers.length})
                        </span>
                        {isLoadingDetails && <RefreshCw className="animate-spin w-4 h-4" />}
                    </DialogTitle>
                </DialogHeader>
                
                <ScrollArea className="h-[50vh] pr-4 mt-2">
                    {categoryUsers.length === 0 && !isLoadingDetails ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                            <Users className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">No users found in this category</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {categoryUsers.map((u) => (
                                <div 
                                    key={`${u.user_id}-${u.location_id || 'loc'}`}
                                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden border border-white/10">
                                            {u.avatar_url ? (
                                                <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                                                    {u.username?.[0]?.toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white">{u.username}</div>
                                            <div className="text-xs text-gray-400 flex items-center gap-1">
                                                {u.location_type !== 'online' && u.location_type !== 'browsing' && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                                )}
                                                {u.location_name}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                        {(u.location_type === 'stream' || u.location_type === 'pod') && (
                                            <button 
                                                onClick={() => handleAction(u)}
                                                className="p-2 hover:bg-yellow-500/20 text-gray-400 hover:text-yellow-500 rounded-md transition-colors"
                                                title="Go to Room"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => {
                                                openChatBubble(u.user_id, u.username, u.avatar_url || null);
                                                setActiveCategory(null);
                                            }}
                                            className="p-2 hover:bg-purple-500/20 text-gray-400 hover:text-purple-500 rounded-md transition-colors"
                                            title="Send Message"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                navigate(`/profile/${u.username}`);
                                                setActiveCategory(null);
                                            }}
                                            className="p-2 hover:bg-blue-500/20 text-gray-400 hover:text-blue-500 rounded-md transition-colors"
                                            title="View Profile"
                                        >
                                            <Users className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    </div>
  );
}
