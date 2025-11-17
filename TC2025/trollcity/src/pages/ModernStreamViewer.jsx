import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Heart, MessageCircle, Share2, Flag, ArrowLeft, Gift, Send, X } from 'lucide-react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { getAgoraToken } from '@/utils/agora';

// Modern TikTok-style Stream Viewer
const ModernStreamViewer = () => {
  const navigate = useNavigate();
  const { streamId } = useParams();
  const queryClient = useQueryClient();
  
  // Refs
  const videoContainerRef = useRef(null);
  const agoraClientRef = useRef(null);
  const remoteVideoTrackRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStreamEnded, setIsStreamEnded] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [incomingGifts, setIncomingGifts] = useState([]);
  const [likeAnimations, setLikeAnimations] = useState([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [coinCount, setCoinCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [videoQuality, setVideoQuality] = useState('auto');
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [showBroadcasterPanel, setShowBroadcasterPanel] = useState(false);
  const [broadcasterMessage, setBroadcasterMessage] = useState('');

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      return profile;
    },
    staleTime: 30000,
  });

  // Fetch stream data
  const { data: stream, isLoading: streamLoading } = useQuery({
    queryKey: ['stream', streamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streams')
        .select(`
          *,
          streamer:profiles!streamer_id(username, full_name, avatar, is_verified)
        `)
        .eq('id', streamId)
        .eq('status', 'live')
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!streamId,
    refetchInterval: 5000,
  });

  // Check if current user is the broadcaster
  useEffect(() => {
    if (currentUser && stream) {
      setIsBroadcaster(currentUser.id === stream.streamer_id);
    }
  }, [currentUser, stream]);

  // Fetch stream stats
  const { data: streamStats } = useQuery({
    queryKey: ['streamStats', streamId],
    queryFn: async () => {
      const [{ data: viewers }, { data: likes }, { data: gifts }] = await Promise.all([
        supabase
          .from('stream_viewers')
          .select('id', { count: 'exact' })
          .eq('stream_id', streamId),
        supabase
          .from('stream_likes')
          .select('id', { count: 'exact' })
          .eq('stream_id', streamId),
        supabase
          .from('stream_gifts')
          .select('coin_value', { count: 'exact' })
          .eq('stream_id', streamId)
      ]);

      return {
        viewerCount: viewers?.length || 0,
        likeCount: likes?.length || 0,
        totalCoins: gifts?.reduce((sum, gift) => sum + (gift.coin_value || 0), 0) || 0
      };
    },
    enabled: !!streamId && !!stream,
    refetchInterval: 3000,
  });

  // Update stats when data changes
  useEffect(() => {
    if (streamStats) {
      setViewerCount(streamStats.viewerCount);
      setLikeCount(streamStats.likeCount);
      setCoinCount(streamStats.totalCoins);
    }
  }, [streamStats]);

  // Check follow status
  const { data: followStatus } = useQuery({
    queryKey: ['followStatus', currentUser?.id, stream?.streamer_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', stream.streamer_id)
        .single();
      
      return !!data;
    },
    enabled: !!currentUser?.id && !!stream?.streamer_id,
  });

  useEffect(() => {
    setIsFollowing(followStatus || false);
  }, [followStatus]);

  // Track stream viewer (join/leave)
  const trackStreamViewer = useCallback(async (action) => {
    if (!streamId || !currentUser?.id) return;
    
    try {
      const response = await fetch('/api/track-stream-viewer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          streamId,
          userId: currentUser.id,
          action
        })
      });
      
      const result = await response.json();
      if (!response.ok) {
        console.error('Failed to track stream viewer:', result.error);
      } else {
        console.log(`Stream viewer ${action}:`, result.message);
      }
    } catch (error) {
      console.error('Error tracking stream viewer:', error);
    }
  }, [streamId, currentUser?.id]);

  // Agora connection
  const connectToStream = useCallback(async () => {
    if (!stream || isConnecting) return;
    
    setIsConnecting(true);
    
    try {
      // Track viewer joining
      await trackStreamViewer('join');

      // Get Agora token
      const tokenData = await getAgoraToken(stream.channel_name, currentUser?.id || 0);

      if (!tokenData?.token) {
        throw new Error('Failed to get stream token');
      }

      // Create Agora client
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      agoraClientRef.current = client;

      // Set up event handlers
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        
        if (mediaType === 'video') {
          const remoteVideoTrack = user.videoTrack;
          
          // Create a dedicated container for this user
          const userContainer = document.createElement('div');
          userContainer.id = `remote-${user.uid}`;
          userContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
          `;
          
          if (videoContainerRef.current) {
            videoContainerRef.current.appendChild(userContainer);
            remoteVideoTrack.play(userContainer, {
              fit: 'cover',
              mirror: false
            });
          }
        }
        
        if (mediaType === 'audio') {
          const remoteAudioTrack = user.audioTrack;
          remoteAudioTrack.play();
        }
      });

      client.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'video') {
          // Remove only this user's video container
          const userContainer = document.getElementById(`remote-${user.uid}`);
          if (userContainer) {
            userContainer.remove();
          }
        }
      });

      client.on('stream-ended', () => {
        setIsStreamEnded(true);
        toast.info('Stream has ended');
      });

      // Join channel
      await client.join(tokenData.appId, stream.channel_name, tokenData.token, currentUser?.id || 0);
      
      setIsConnecting(false);
      setIsLoading(false);
      
      // Start heartbeat to keep viewer active (every 15 seconds)
      const heartbeatInterval = setInterval(() => {
        trackStreamViewer('heartbeat');
      }, 15000);
      
      // Store interval for cleanup
      heartbeatIntervalRef.current = heartbeatInterval;
      
    } catch (error) {
      console.error('Failed to connect to stream:', error);
      toast.error('Failed to connect to stream');
      setIsConnecting(false);
      setIsLoading(false);
    }
  }, [stream, currentUser, isConnecting]);

  // Connect to stream when ready
  useEffect(() => {
    if (stream && !isConnecting) {
      connectToStream();
    }
  }, [stream, connectToStream]);

  // Handle stream ended
  useEffect(() => {
    if (isStreamEnded) {
      setTimeout(() => {
        navigate('/');
      }, 3000);
    }
  }, [isStreamEnded, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      // Track viewer leaving if still connected
      if (agoraClientRef.current && streamId && currentUser?.id) {
        trackStreamViewer('leave');
      }
      
      // Leave Agora channel
      if (agoraClientRef.current) {
        agoraClientRef.current.leave();
      }
    };
  }, []);

  // Chat functionality
  const { data: chatMessages = [] } = useQuery({
    queryKey: ['chatMessages', streamId, isBroadcaster],
    queryFn: async () => {
      const messageTypes = isBroadcaster ? ['text', 'system', 'broadcaster'] : ['text', 'system'];
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          user:profiles!user_id(username, full_name, avatar, is_verified)
        `)
        .eq('stream_id', streamId)
        .in('message_type', messageTypes)
        .order('created_date', { ascending: true })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!streamId,
    refetchInterval: 1000,
  });

  // Send chat message
  const sendMessageMutation = useMutation({
    mutationFn: async (message) => {
      if (!currentUser || !stream) return;
      
      await supabase.from('chat_messages').insert({
        stream_id: streamId,
        user_id: currentUser.id,
        username: currentUser.username || currentUser.full_name,
        message: message.trim(),
        message_type: 'text',
        created_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      setChatMessage('');
    },
    onError: (error) => {
      toast.error('Failed to send message');
    }
  });

  // Send broadcaster message (only for broadcaster)
  const sendBroadcasterMessageMutation = useMutation({
    mutationFn: async (message) => {
      if (!currentUser || !stream || !isBroadcaster) return;
      
      await supabase.from('chat_messages').insert({
        stream_id: streamId,
        user_id: currentUser.id,
        username: currentUser.username || currentUser.full_name,
        message: message.trim(),
        message_type: 'broadcaster',
        created_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      setBroadcasterMessage('');
    },
    onError: (error) => {
      toast.error('Failed to send broadcaster message');
    }
  });

  // Like functionality
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser || !stream) return;
      
      // Check if user already liked
      const { data: existingLike } = await supabase
        .from('stream_likes')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('stream_id', streamId)
        .single();

      if (existingLike) {
        // Unlike
        await supabase
          .from('stream_likes')
          .delete()
          .eq('id', existingLike.id);
      } else {
        // Like
        await supabase.from('stream_likes').insert({
          user_id: currentUser.id,
          stream_id: streamId,
          created_date: new Date().toISOString()
        });

        // Add like animation
        const animationId = Date.now();
        setLikeAnimations(prev => [...prev, { id: animationId, x: Math.random() * 100 }]);
        setTimeout(() => {
          setLikeAnimations(prev => prev.filter(anim => anim.id !== animationId));
        }, 2000);
      }
    }
  });

  // Follow functionality
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser || !stream) return;
      
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', stream.streamer_id);
      } else {
        await supabase.from('follows').insert({
          follower_id: currentUser.id,
          following_id: stream.streamer_id,
          created_at: new Date().toISOString()
        });
      }
      
      queryClient.invalidateQueries(['followStatus']);
    }
  });

  // Gift functionality
  const sendGiftMutation = useMutation({
    mutationFn: async ({ giftId, giftName, coinValue }) => {
      if (!currentUser || !stream) return;
      
      // Check if user has enough coins
      if (currentUser.coins < coinValue) {
        toast.error('Insufficient coins');
        return;
      }

      // Deduct coins
      await supabase.rpc('decrement_user_coins', {
        user_id: currentUser.id,
        amount: coinValue
      });

      // Send gift
      await supabase.from('stream_gifts').insert({
        sender_id: currentUser.id,
        recipient_id: stream.streamer_id,
        stream_id: streamId,
        gift_id: giftId,
        gift_name: giftName,
        coin_value: coinValue,
        created_date: new Date().toISOString()
      });

      // Add gift animation
      setIncomingGifts(prev => [...prev, {
        id: Date.now(),
        giftName,
        senderName: currentUser.username || currentUser.full_name,
        coinValue
      }]);

      setTimeout(() => {
        setIncomingGifts(prev => prev.filter(gift => gift.id !== Date.now()));
      }, 3000);

      toast.success(`Sent ${giftName}!`);
    }
  });

  // Handle send message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatMessage.trim() && currentUser) {
      sendMessageMutation.mutate(chatMessage);
    }
  };

  // Handle send broadcaster message
  const handleSendBroadcasterMessage = (e) => {
    e.preventDefault();
    if (broadcasterMessage.trim() && currentUser && isBroadcaster) {
      sendBroadcasterMessageMutation.mutate(broadcasterMessage);
    }
  };

  // Handle like
  const handleLike = () => {
    likeMutation.mutate();
  };

  // Handle follow
  const handleFollow = () => {
    followMutation.mutate();
  };

  // Handle share
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${stream?.streamer?.full_name} is live on TrollCity`,
          text: `Watch ${stream?.streamer?.full_name}'s live stream`,
          url: window.location.href
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  // Handle report
  const handleReport = () => {
    toast.info('Report feature coming soon');
  };

  // Handle leave stream
  const handleLeaveStream = () => {
    // Clear heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    // Track viewer leaving
    trackStreamViewer('leave');
    
    // Leave the Agora channel
    if (agoraClientRef.current) {
      agoraClientRef.current.leave();
      agoraClientRef.current = null;
    }
    
    // Stop any remote video tracks
    if (remoteVideoTrackRef.current) {
      remoteVideoTrackRef.current.stop();
      remoteVideoTrackRef.current = null;
    }
    
    // Clear video container
    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = '';
    }
    
    // Navigate home
    navigate('/');
  };

  // Loading states
  if (isLoading || streamLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading stream...</p>
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Stream not found or has ended</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (isStreamEnded) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Stream has ended</p>
          <p className="text-gray-400 mb-4">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black relative overflow-hidden">
      {/* Video Container - Full Screen */}
      <div className="absolute inset-0 z-0">
        <div 
          ref={videoContainerRef}
          className="w-full h-full bg-black relative"
        >
          {isConnecting && (
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p>Connecting to stream...</p>
            </div>
          )}
        </div>
      </div>

      {/* Dark Overlay for UI */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 z-10"></div>

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={handleLeaveStream}
            className="bg-red-600/80 hover:bg-red-700 text-white p-2 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleShare}
              className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button 
              onClick={handleReport}
              className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
            >
              <Flag className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Side Controls */}
      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 z-20 p-4">
        <div className="flex flex-col space-y-4">
          {/* Profile */}
          <div className="text-center">
            <div className="relative mb-2">
              <img 
                src={stream.streamer?.avatar || '/default-avatar.png'}
                alt={stream.streamer?.full_name}
                className="w-16 h-16 rounded-full border-2 border-white object-cover"
              />
              {stream.streamer?.is_verified && (
                <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </div>
            <p className="text-white text-sm font-semibold truncate max-w-20">
              {stream.streamer?.full_name}
            </p>
            <button 
              onClick={handleFollow}
              className={`mt-2 px-4 py-1 rounded-full text-xs font-semibold transition-colors ${
                isFollowing 
                  ? 'bg-gray-600 text-white' 
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>

          {/* Like Button */}
          <button 
            onClick={handleLike}
            className="bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors group"
          >
            <Heart className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <p className="text-xs mt-1">{likeCount}</p>
          </button>

          {/* Comments Button */}
          <button 
            onClick={() => setShowChat(!showChat)}
            className="bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
          >
            <MessageCircle className="w-6 h-6" />
            <p className="text-xs mt-1">Chat</p>
          </button>

          {/* Gift Button */}
          <button 
            onClick={() => setShowGiftPanel(!showGiftPanel)}
            className="bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
          >
            <Gift className="w-6 h-6" />
            <p className="text-xs mt-1">Gift</p>
          </button>
        </div>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center space-x-2 mb-2">
          <div className="bg-red-600 px-2 py-1 rounded text-white text-xs font-bold">
            LIVE
          </div>
          <div className="text-white text-sm">
            {viewerCount} viewers
          </div>
          <div className="text-yellow-400 text-sm">
            ⭐ {coinCount} coins
          </div>
        </div>
        
        {stream.title && (
          <p className="text-white text-lg font-semibold mb-2">
            {stream.title}
          </p>
        )}
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className={`absolute bottom-20 right-4 ${isBroadcaster ? 'w-[600px]' : 'w-80'} h-96 bg-black/80 backdrop-blur-sm rounded-lg z-30`}>
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-white font-semibold">
              {isBroadcaster ? 'Broadcaster Dashboard' : 'Live Chat'}
            </h3>
            <div className="flex items-center space-x-2">
              {isBroadcaster && (
                <button 
                  onClick={() => setShowBroadcasterPanel(!showBroadcasterPanel)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  {showBroadcasterPanel ? 'Hide Panel' : 'Show Panel'}
                </button>
              )}
              <button 
                onClick={() => setShowChat(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className={`flex ${isBroadcaster && showBroadcasterPanel ? 'flex-row' : 'flex-col'} h-[calc(100%-60px)]`}>
            {/* Regular Chat Section */}
            <div className={`${isBroadcaster && showBroadcasterPanel ? 'w-1/2 border-r border-gray-700' : 'w-full'} flex flex-col`}>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {chatMessages.filter(msg => msg.message_type !== 'broadcaster').map((message) => (
                  <div key={message.id} className={`flex items-start space-x-2 ${message.message_type === 'system' ? 'opacity-75' : ''}`}>
                    {message.message_type === 'system' ? (
                      <div className="flex-1 text-center">
                        <p className="text-gray-400 text-xs italic">
                          {message.message}
                        </p>
                      </div>
                    ) : (
                      <>
                        <img 
                          src={message.user?.avatar || '/default-avatar.png'}
                          alt={message.user?.username}
                          className="w-6 h-6 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1">
                          <p className="text-white text-sm">
                            <span className="font-semibold">{message.username}</span>
                            <span className="ml-2">{message.message}</span>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={!currentUser}
                  />
                  <button
                    type="submit"
                    disabled={!chatMessage.trim() || !currentUser}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white p-2 rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>

            {/* Broadcaster Panel Section */}
            {isBroadcaster && showBroadcasterPanel && (
              <div className="w-1/2 flex flex-col">
                <div className="p-4 border-b border-gray-700">
                  <h4 className="text-white font-semibold text-sm">Broadcaster Messages</h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {chatMessages.filter(msg => msg.message_type === 'broadcaster').map((message) => (
                    <div key={message.id} className="flex items-start space-x-2">
                      <img 
                        src={message.user?.avatar || '/default-avatar.png'}
                        alt={message.user?.username}
                        className="w-6 h-6 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1">
                        <p className="text-yellow-400 text-sm">
                          <span className="font-semibold">{message.username} (Broadcaster)</span>
                          <span className="ml-2">{message.message}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                  {chatMessages.filter(msg => msg.message_type === 'broadcaster').length === 0 && (
                    <p className="text-gray-500 text-xs text-center py-4">No broadcaster messages yet</p>
                  )}
                </div>
                
                <form onSubmit={handleSendBroadcasterMessage} className="p-4 border-t border-gray-700">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={broadcasterMessage}
                      onChange={(e) => setBroadcasterMessage(e.target.value)}
                      placeholder="Broadcast message..."
                      className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <button
                      type="submit"
                      disabled={!broadcasterMessage.trim()}
                      className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white p-2 rounded-lg transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gift Panel */}
      {showGiftPanel && (
        <div className="absolute bottom-20 right-4 w-80 bg-black/90 backdrop-blur-sm rounded-lg z-30">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-white font-semibold">Send Gift</h3>
            <button 
              onClick={() => setShowGiftPanel(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3">
              {/* Sample gifts - you can make this dynamic */}
              {[
                { id: 1, name: 'Rose', coins: 10, emoji: '🌹' },
                { id: 2, name: 'Heart', coins: 50, emoji: '❤️' },
                { id: 3, name: 'Star', coins: 100, emoji: '⭐' },
                { id: 4, name: 'Crown', coins: 500, emoji: '👑' },
                { id: 5, name: 'Diamond', coins: 1000, emoji: '💎' },
                { id: 6, name: 'Rocket', coins: 5000, emoji: '🚀' }
              ].map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => sendGiftMutation.mutate({
                    giftId: gift.id,
                    giftName: gift.name,
                    coinValue: gift.coins
                  })}
                  disabled={!currentUser || currentUser.coins < gift.coins}
                  className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:opacity-50 text-white p-3 rounded-lg transition-colors text-center"
                >
                  <div className="text-2xl mb-1">{gift.emoji}</div>
                  <div className="text-xs font-semibold">{gift.name}</div>
                  <div className="text-xs text-yellow-400">{gift.coins}💰</div>
                </button>
              ))}
            </div>
            
            {currentUser && (
              <div className="mt-4 text-center">
                <p className="text-white text-sm">
                  Your coins: <span className="text-yellow-400 font-semibold">{currentUser.coins}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gift Animations */}
      <div className="absolute inset-0 pointer-events-none z-40">
        {incomingGifts.map((gift) => (
          <div key={gift.id} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full text-lg font-bold animate-bounce">
              🎁 {gift.senderName} sent {gift.giftName}! ({gift.coinValue} coins)
            </div>
          </div>
        ))}
      </div>

      {/* Like Animations */}
      <div className="absolute inset-0 pointer-events-none z-40">
        {likeAnimations.map((anim) => (
          <div 
            key={anim.id} 
            className="absolute bottom-20 animate-ping"
            style={{ left: `${anim.x}%` }}
          >
            <div className="text-4xl animate-bounce">🤡</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModernStreamViewer;