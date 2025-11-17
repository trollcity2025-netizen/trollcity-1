
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Video, Mic, MicOff, VideoOff, Upload, Clock, Users, Grid3x3, Coins } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ChatBox from "../components/stream/ChatBox";
import EntranceEffect from "../components/stream/EntranceEffect";
import JoinRequests from "../components/stream/JoinRequests";
import GiftAnimation from "../components/stream/GiftAnimation";
import io from "socket.io-client";
import { safetyMonitor } from "@/utils/safetyMonitor";

const SIGNALING_SERVER = window.location.origin;

export default function GoLivePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const agoraClientRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const streamTimerRef = useRef(null);
  const viewerCountInterval = useRef(null);
  const shownEntrances = useRef(new Set());
  const isPlayingLocalVideoRef = useRef(false);

  const socketRef = useRef(null);
  const pcsRef = useRef({});
  const remoteStreamsRef = useRef({});
  const boxMediaRef = useRef({});

  const [step, setStep] = useState(1);
  const [streamConfig, setStreamConfig] = useState({
    title: "",
    category: "gaming",
    thumbnailUrl: "",
    streamMode: "solo",
    maxParticipants: 1,
  });

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'gaming', label: '🎮 Gaming' },
    { id: 'music', label: '🎵 Music' },
    { id: 'talk', label: '💬 Just Chatting' },
    { id: 'creative', label: '🎨 Creative' },
    { id: 'smoking', label: '🚬 Smoking' },
    { id: 'drinking', label: '🍺 Drinking' },
    { id: 'comedy', label: '😂 Comedy' },
    { id: 'dating', label: '💕 Dating' },
  ];
  const [isLive, setIsLive] = useState(false);
  const [currentStream, setCurrentStream] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [showBoxControls, setShowBoxControls] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [entranceUser, setEntranceUser] = useState(null);
  const [activeGiftAnimation, setActiveGiftAnimation] = useState(null);
  const lastGiftIdRef = useRef(null);
  const streamStartTime = useRef(null);

  // FIXED: Add zoom control state
  

  const [boxes, setBoxes] = useState(() => Array.from({ length: 4 }, (_, i) => ({
    id: i + 1,
    occupiedBy: null,
    stream: null,
    joining: false,
  })));

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => supabase.auth.me(),
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const { data: activeStreams = [] } = useQuery({
    queryKey: ['myActiveStreams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('streamer_id', user.id)
        .eq('is_live', true);
      if (error) { console.warn('fetch active streams error:', error.message); return []; }
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const { data: chatMessages = [] } = useQuery({
    queryKey: ['streamChat', currentStream?.id],
    queryFn: async () => {
      if (!currentStream?.id) return [];
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('stream_id', currentStream.id)
        .order('created_date', { ascending: false })
        .limit(100);
      if (error) { console.warn('fetch chat messages error:', error.message); return []; }
      return data || [];
    },
    initialData: [],
    refetchInterval: 3000,
    enabled: !!currentStream?.id && isLive,
    staleTime: 2000,
  });

  const { data: joinRequests = [] } = useQuery({
    queryKey: ['joinRequests', currentStream?.id],
    queryFn: async () => {
      if (!currentStream?.id) return [];
      const { data, error } = await supabase
        .from('join_requests')
        .select('*')
        .eq('stream_id', currentStream.id)
        .eq('status', 'pending')
        .order('created_date', { ascending: false });
      if (error) { console.warn('fetch join requests error:', error.message); return []; }
      return data || [];
    },
    initialData: [],
    refetchInterval: 5000,
    enabled: !!currentStream?.id && isLive,
    staleTime: 3000,
  });

  const { data: latestGifts = [] } = useQuery({
    queryKey: ['broadcasterGifts', currentStream?.id],
    queryFn: async () => {
      if (!currentStream?.id) return [];
      const { data, error } = await supabase
        .from('stream_gifts')
        .select('*')
        .eq('stream_id', currentStream.id)
        .order('created_date', { ascending: false })
        .limit(5);
      if (error) { console.warn('fetch gifts error:', error.message); return []; }
      return data || [];
    },
    enabled: !!currentStream?.id && isLive,
    refetchInterval: 3000,
    initialData: [],
    staleTime: 2000,
  });

  const { data: activeParticipants = [] } = useQuery({
    queryKey: ['streamParticipants', currentStream?.id],
    queryFn: async () => {
      if (!currentStream?.id) return [];
      const { data, error } = await supabase
        .from('stream_participants')
        .select('*')
        .eq('stream_id', currentStream.id);
      if (error) { console.warn('fetch participants error:', error.message); return []; }
      return data || [];
    },
    enabled: !!currentStream?.id && isLive && currentStream?.stream_mode === "multi",
    refetchInterval: 5000,
    initialData: [],
    staleTime: 3000,
  });

  useEffect(() => {
    const joinMessages = chatMessages.filter(m => m.message_type === "join" && !shownEntrances.current.has(m.id));
    if (joinMessages.length > 0) {
      const latestJoin = joinMessages[0];
      (async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', latestJoin.user_id)
            .limit(1);
          if (error) throw error;
          const userRow = Array.isArray(data) ? data[0] : null;
          if (userRow && userRow.active_entrance_effect) {
            setEntranceUser(userRow);
            shownEntrances.current.add(latestJoin.id);
            setTimeout(() => setEntranceUser(null), 4000);
          }
        } catch (e) {
          console.error('entrance effect lookup failed:', e);
        }
      })();
    }
  }, [chatMessages]);

  useEffect(() => {
    if (latestGifts.length > 0) {
      const newest = latestGifts[0];
      if (!lastGiftIdRef.current || newest.id !== lastGiftIdRef.current) {
        lastGiftIdRef.current = newest.id;
        setActiveGiftAnimation(newest);
      }
    }
  }, [latestGifts]);

  useEffect(() => {
    if (!socketRef.current) {
      const socket = io(SIGNALING_SERVER, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', () => console.log('🔌 socket connected', socketRef.current?.id));

      socket.on('room-state', (roomState) => {
        if (roomState && Array.isArray(roomState.boxes)) {
          setBoxes(prev => prev.map(b => {
            const remote = roomState.boxes.find(rb => rb.id === b.id);
            if (!remote) return b;
            if (b.occupiedBy && b.occupiedBy.id === user?.id) return b;
            return { ...b, occupiedBy: remote.occupiedBy || null };
          }));
        }
      });

      socket.on('box-joined', ({ boxId, user: joiningUser }) => {
        setBoxes(prev => prev.map(b => b.id === boxId ? { ...b, occupiedBy: joiningUser } : b));
      });

      socket.on('box-left', ({ boxId }) => {
        setBoxes(prev => prev.map(b => b.id === boxId ? { ...b, occupiedBy: null, stream: null } : b));
      });

      socket.on('signal-offer', async ({ fromSocketId, toSocketId, boxId, offer }) => {
        if (socketRef.current?.id !== toSocketId) return;
        await handleReceiveOffer(fromSocketId, boxId, offer);
      });

      socket.on('signal-answer', async ({ fromSocketId, toSocketId, boxId, answer }) => {
        if (socketRef.current?.id !== toSocketId) return;
        await handleReceiveAnswer(fromSocketId, answer);
      });

      socket.on('signal-ice', async ({ fromSocketId, toSocketId, candidate }) => {
        if (socketRef.current?.id !== toSocketId) return;
        const pc = pcsRef.current[fromSocketId];
        if (pc && candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e){ console.warn('ice add error', e); }
        }
      });
    }

    return () => {
      const s = socketRef.current;
      if (s) {
        s.off('connect');
        s.off('room-state');
        s.off('box-joined');
        s.off('box-left');
        s.off('signal-offer');
        s.off('signal-answer');
        s.off('signal-ice');
        try { s.disconnect(); } catch(e){ console.warn('socket disconnect error', e); }
      }

      Object.values(boxMediaRef.current || {}).forEach(stream => {
        try { stream.getTracks().forEach(t => t.stop()); } catch(e){}
      });
      boxMediaRef.current = {};

      Object.values(pcsRef.current || {}).forEach(pc => {
        try { pc.close(); } catch(e) {}
      });
      pcsRef.current = {};
    };
  }, [user?.id]);

  const createPeerConnectionFor = (remoteSocketId, boxId) => {
    if (!remoteSocketId) return null;
    if (pcsRef.current[remoteSocketId]) return pcsRef.current[remoteSocketId];

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit('signal-ice', { toSocketId: remoteSocketId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (!stream) return;
      setBoxes(prev => prev.map(b => b.id === boxId ? { ...b, stream } : b));
      remoteStreamsRef.current[remoteSocketId] = stream;
    };

    pcsRef.current[remoteSocketId] = pc;
    return pc;
  };

  const handleJoinBoxClick = async (boxId) => {
    if (!user) {
      toast.error('Please login to join');
      return;
    }

    const box = boxes.find(b => b.id === boxId);
    if (box?.occupiedBy) {
      toast.error('Box already taken');
      return;
    }

    setBoxes(prev => prev.map(b => b.id === boxId ? { ...b, joining: true } : b));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      boxMediaRef.current[boxId] = stream;

      setBoxes(prev => prev.map(b => b.id === boxId ? ({ ...b, occupiedBy: user, stream, joining: false }) : b));

      if (socketRef.current) {
        socketRef.current.emit('join-box', { boxId, user: { id: user.id, username: user.username, avatar: user.avatar }, toRoom: currentStream?.id || null });

        socketRef.current.emit('request-peers-for-box', { boxId }, async (peerSocketIds = []) => {
          for (const peerSocketId of peerSocketIds) {
            if (peerSocketId === socketRef.current.id) continue;
            const pc = createPeerConnectionFor(peerSocketId, boxId);
            if (!pc) continue;
            try {
              stream.getTracks().forEach(track => pc.addTrack(track, stream));
            } catch (e) { console.warn('addTrack failed', e); }

            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socketRef.current.emit('signal-offer', { toSocketId: peerSocketId, fromSocketId: socketRef.current.id, boxId, offer });
            } catch (e) { console.error('offer create/send failed', e); }
          }
        });
      }

      toast.success('You joined the box');

      if (currentStream?.id) {
        supabase
          .from('stream_participants')
          .insert({
            stream_id: currentStream.id,
            user_id: user.id,
            box_number: boxId,
            username: user.username || user.full_name,
            user_avatar: user.avatar,
            user_level: user.level || 1,
            role: boxId === 1 ? 'host' : 'co-host',
            is_publishing: true,
            joined_at: new Date().toISOString()
          })
          .catch(console.error);
      }

    } catch (err) {
      console.error('Failed to get media:', err);
      setBoxes(prev => prev.map(b => b.id === boxId ? ({ ...b, joining: false }) : b));
      toast.error('Camera / Microphone permission required');
    }
  };

  const handleReceiveOffer = async (fromSocketId, boxId, offer) => {
    try {
      const pc = createPeerConnectionFor(fromSocketId, boxId);
      if (!pc) return;

      const localStream = boxMediaRef.current[boxId];
      if (localStream) {
        try { localStream.getTracks().forEach(t => pc.addTrack(t, localStream)); } catch(e){ console.warn('add local tracks error', e); }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socketRef.current) {
        socketRef.current.emit('signal-answer', { toSocketId: fromSocketId, fromSocketId: socketRef.current.id, boxId, answer });
      }
    } catch (e) {
      console.error('Offer handling failed', e);
    }
  };

  const handleReceiveAnswer = async (fromSocketId, answer) => {
    try {
      const pc = pcsRef.current[fromSocketId];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      console.error('Answer handling failed', e);
    }
  };

  const handleBoxDowngrade = async (newBoxCount) => {
    if (!currentStream || !socketRef.current) return;
    
    const currentBoxCount = currentStream.max_participants;
    if (newBoxCount >= currentBoxCount) return;
    
    try {
      // Notify users in boxes that will be removed
      for (let i = newBoxCount + 1; i <= currentBoxCount; i++) {
        const box = boxes.find(b => b.id === i);
        if (box?.occupiedBy && box.occupiedBy.id !== user.id) {
          // Force users in removed boxes to leave
          socketRef.current.emit('force-leave-box', { boxId: i });
        }
      }
      
      // Update stream configuration
      const { error } = await supabase
        .from('streams')
        .update({ max_participants: newBoxCount })
        .eq('id', currentStream.id);
      
      if (error) throw error;
      
      // Update local state
      setCurrentStream(prev => ({ ...prev, max_participants: newBoxCount }));
      
      // Update boxes array
      setBoxes(prev => prev.slice(0, newBoxCount));
      
      // Clean up media for removed boxes
      for (let i = newBoxCount + 1; i <= currentBoxCount; i++) {
        if (boxMediaRef.current[i]) {
          boxMediaRef.current[i].getTracks().forEach(track => track.stop());
          delete boxMediaRef.current[i];
        }
      }
      
      toast.success(`Stream downgraded to ${newBoxCount} boxes`);
      setShowBoxControls(false);
      
    } catch (error) {
      console.error('Box downgrade error:', error);
      toast.error('Failed to downgrade boxes');
    }
  };

  const leaveBox = async (boxId) => {
    const stream = boxMediaRef.current[boxId];
    if (stream) {
      try { stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      delete boxMediaRef.current[boxId];
    }

    if (socketRef.current) {
      socketRef.current.emit('leave-box', { boxId });
    }

    setBoxes(prev => prev.map(b => b.id === boxId ? ({ id: b.id, occupiedBy: null, stream: null, joining: false }) : b));

    if (currentStream?.id) {
      try {
        const { data: parts = [] } = await supabase
          .from('stream_participants')
          .select('*')
          .eq('stream_id', currentStream.id)
          .eq('user_id', user.id)
          .eq('box_number', boxId);
        for (const p of parts) {
          await supabase
            .from('stream_participants')
            .delete()
            .eq('id', p.id)
            .catch(console.error);
        }
      } catch (e) {
        console.error('leaveBox cleanup failed', e);
      }
    }
  };

  const loadAgoraSDK = async () => {
    if (window.AgoraRTC) {
      console.log('✅ Agora SDK already loaded');
      return;
    }
    console.log('📦 Loading Agora SDK...');
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Use stable Agora Web SDK v4.20.0 (avoid sd-rtn config aborts seen on 4.21.0)
      script.src = 'https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js';
      script.onload = () => {
        if (window.AgoraRTC) {
          console.log('✅ Agora SDK loaded successfully');
          resolve();
        } else {
          reject(new Error('Agora SDK not found after load'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Agora SDK script'));
      document.head.appendChild(script);
    });
  };

  const setupAgora = async () => {
    try {
      setIsStartingStream(true);
      console.log('🎬 Starting Agora stream setup...');
      
      await loadAgoraSDK();
      // Guard against missing user while query loads
      const safeUserId = user?.id || 'anon';
      const channelName = `stream_${safeUserId}_${Date.now()}`;
      console.log('📡 Channel name:', channelName);

      // Removed loading messages for instant stream start
      let tokenData;
      try {
        const resp = await supabase.functions.invoke("generateagoratoken", {
          body: { channelName, role: 'publisher', uid: user?.id || 1 },
        });
        tokenData = resp?.data || resp;
      } catch (invokeErr) {
        console.warn('Supabase invoke failed, falling back to direct fetch:', invokeErr?.message || invokeErr);
        try {
          const { getAgoraToken } = await import('@/utils/agora');
          tokenData = await getAgoraToken(channelName, user?.id || 1);
        } catch (fallbackErr) {
          console.error('Fallback token fetch failed:', fallbackErr?.message || fallbackErr);
          tokenData = null;
        }
      }

      // Normalize common shapes returned by different implementations
      const appId = tokenData?.appId ?? tokenData?.agoraAppId ?? import.meta.env.VITE_AGORA_APP_ID;
      const tokenCandidates = [
        tokenData?.token,
        tokenData?.rtcToken,
        tokenData?.data?.token,
        tokenData?.data?.rtcToken,
        import.meta.env.VITE_AGORA_DEV_TOKEN || null,
      ];
      const token = tokenCandidates.find(Boolean) ?? null;
      const uid = tokenData?.uid ?? tokenData?.userId ?? tokenData?.data?.uid ?? (user?.id || 1);

      if (!token) {
        const allowNoToken = (import.meta.env.VITE_AGORA_ALLOW_NO_TOKEN ?? 'false') === 'true';
        if (!allowNoToken) {
          // Removed loading dismiss for instant stream start
          const keys = Object.keys(tokenData || {});
          toast.error(`Missing Agora token from server. Expected 'token' or 'rtcToken'. Received keys: ${JSON.stringify(keys)}`);
          setIsStartingStream(false);
          return;
        }
      }
      if (!appId) {
        toast.dismiss('stream-setup');
        toast.error('Missing Agora App ID. Set VITE_AGORA_APP_ID or return appId in token response.');
        setIsStartingStream(false);
        return;
      }

      console.log('✅ Token received:', { appId, uid });
      toast.dismiss('stream-setup');

      // Removed loading messages for instant stream start
      
      // FIXED: Better camera configuration for mobile
      let audioTrack, videoTrack;
      try {
        audioTrack = await window.AgoraRTC.createMicrophoneAudioTrack({ 
          encoderConfig: 'high_quality_stereo' 
        });
        videoTrack = await window.AgoraRTC.createCameraVideoTrack({ 
          encoderConfig: '720p_2',
          facingMode: 'user',
          optimizationMode: 'detail'
        });
      } catch (mediaErr) {
      // Removed loading dismiss for instant stream start
        const denied = mediaErr?.name === 'NotAllowedError' || /Permission denied/i.test(mediaErr?.message || '');
        if (denied) {
          toast.error('Camera/mic permission denied. Please allow access in your browser and try again.');
        } else {
          toast.error(mediaErr?.message || 'Failed to access camera/mic');
        }
        setIsStartingStream(false);
        throw mediaErr; // bubble to outer catch for cleanup
      }
      
      console.log('✅ Media tracks created');
      toast.dismiss('media-request');

      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      // Removed loading messages for instant stream start
      const client = window.AgoraRTC.createClient({ mode: 'live', codec: 'vp8', role: 'host' });
      client.enableDualStream();
      agoraClientRef.current = client;

      await client.join(appId, channelName, token, uid);
      console.log('✅ Joined Agora channel');
      
      await client.publish([audioTrack, videoTrack]);
      console.log('✅ Published tracks');
      // Removed loading dismiss for instant stream start

      // Removed loading messages for instant stream start
      // Guard against user becoming null unexpectedly (refetch race)
      if (!user || !user?.id) {
      // Removed loading dismiss for instant stream start
        toast.error('User info missing. Please sign in again and retry.');
        try { await client.leave(); } catch (_) {}
        setIsStartingStream(false);
        return;
      }
      const { data: streamRow, error: streamErr } = await supabase
        .from('streams')
        .insert({
        title: streamConfig.title,
        streamer_name: user?.username || user?.full_name || 'Anonymous',
        streamer_id: user?.id,
        streamer_avatar: user?.avatar || '',
        streamer_follower_count: user?.follower_count || 0,
        streamer_created_date: user?.created_date || new Date().toISOString(),
        category: streamConfig.category,
        stream_mode: streamConfig.streamMode,
        max_participants: streamConfig.maxParticipants,
        status: "live",
        streaming_backend: "agora",
        agora_channel_name: channelName,
        agora_token: token,
        agora_uid: String(uid),
        thumbnail: streamConfig.thumbnailUrl || '',
        peer_id: channelName,
        last_heartbeat: new Date().toISOString(),
        viewer_count: 0,
        is_live: true
      })
        .select('*')
        .single();
      if (streamErr) {
        console.error('Stream create error:', streamErr.message);
        toast.dismiss('create-stream');
        toast.error('Failed to create stream: ' + streamErr.message);
        try { await client.leave(); } catch (_) {}
        setIsStartingStream(false);
        return;
      }
      const stream = streamRow;
      console.log('✅ Stream record created:', stream.id);
      toast.dismiss('create-stream');

      setCurrentStream(stream);
      setIsLive(true);
      setIsStartingStream(false);
      // Notify followers that the stream is live
      try {
        const { data: followers = [] } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id);
        if (Array.isArray(followers) && followers.length > 0) {
          const notifRows = followers.map(f => ({
            user_id: f.follower_id,
            type: 'stream_live',
            title: 'Stream Live',
            message: `${user.username || user.full_name} is live: ${stream.title}`,
            link_url: `${createPageUrl('StreamViewer')}?id=${stream.id}`,
            is_read: false,
            created_date: new Date().toISOString(),
          }));
          await supabase.from('notifications').insert(notifRows).catch(() => {});
        }
      } catch (_) {}
      
      setTimeout(() => {
        const localPlayer = document.getElementById('local-player');
        if (localPlayer && videoTrack && !isPlayingLocalVideoRef.current) {
          isPlayingLocalVideoRef.current = true;
          try {
            videoTrack.play(localPlayer, { fit: "contain" }); // FIXED: Use "contain" instead of "cover" to prevent internal zoom
            console.log('✅ Local video playing');
          } catch (playError) {
            console.warn('Local video play warning:', playError);
            isPlayingLocalVideoRef.current = false;
          }
        }
      }, 1000);
      
      toast.success("🔴 You're LIVE!");

      if (socketRef.current) socketRef.current.emit('join-stream-room', { streamId: stream.id });

    } catch (error) {
      console.error('❌ Agora setup error:', error);
      setIsStartingStream(false);
      isPlayingLocalVideoRef.current = false;
      // Removed loading dismiss for instant stream start
      const denied = error?.name === 'NotAllowedError' || /Permission denied/i.test(error?.message || '');
      if (denied) {
        toast.error('Camera/mic permission denied. Please allow access and retry.');
      } else {
        const abortedConfig = /sd-rtn\.com/i.test(error?.stack || '') || /sd-rtn\.com/i.test(error?.message || '') || /config/i.test(error?.message || '');
        if (abortedConfig) {
          toast.error('Agora config endpoint blocked. Disable ad-blocker/VPN/firewall and allow https://cds-web-2.ap.sd-rtn.com.');
        } else {
          toast.error('Failed to start stream: ' + (error?.message || 'Unknown error'));
        }
      }
    }
  };

  const handleStartStream = async () => {
    // Require authentication before going live
    if (!user || !user?.id) {
      toast.error('Please sign in to go live');
      try { navigate('/login'); } catch (_) {}
      return;
    }
    if (!streamConfig.title.trim()) { 
      toast.error('Please enter a stream title'); 
      return; 
    }

    if (streamConfig.streamMode === 'solo') {
      await setupAgora();
    } else {
      setIsStartingStream(true);
      try {
        const channelName = `multi_${user.id}_${Date.now()}`;
        
        const { data: streamRow, error: streamErr } = await supabase
          .from('streams')
          .insert({
          title: streamConfig.title,
          streamer_name: user.username || user.full_name,
          streamer_id: user.id,
          streamer_avatar: user.avatar,
          streamer_follower_count: user.follower_count || 0,
          streamer_created_date: user.created_date,
          category: streamConfig.category,
          stream_mode: 'multi',
          max_participants: streamConfig.maxParticipants,
          status: 'live',
          streaming_backend: 'webrtc-mesh',
          agora_channel_name: channelName,
          thumbnail: streamConfig.thumbnailUrl || '',
          peer_id: null,
          last_heartbeat: new Date().toISOString(),
          viewer_count: 0,
          is_live: true
        })
          .select('*')
          .single();
        if (streamErr) throw streamErr;
        const stream = streamRow;

        setCurrentStream(stream);
        setIsLive(true);
        setIsStartingStream(false);
        // Notify followers in multi stream too
        try {
          const { data: followers = [] } = await supabase
            .from('follows')
            .select('follower_id')
            .eq('following_id', user.id);
          if (Array.isArray(followers) && followers.length > 0) {
            const notifRows = followers.map(f => ({
              user_id: f.follower_id,
              type: 'stream_live',
              title: 'Stream Live',
              message: `${user.username || user.full_name} is live: ${stream.title}`,
              link_url: `${createPageUrl('StreamViewer')}?id=${stream.id}`,
              is_read: false,
              created_date: new Date().toISOString(),
            }));
            await supabase.from('notifications').insert(notifRows).catch(() => {});
          }
        } catch (_) {}

        if (socketRef.current) socketRef.current.emit('join-stream-room', { streamId: stream.id, maxParticipants: streamConfig.maxParticipants });

        setBoxes(Array.from({ length: streamConfig.maxParticipants }, (_, i) => ({ id: i+1, occupiedBy: null, stream: null, joining: false })));

        toast.success('Multi-beam room created');

        setTimeout(async () => {
          try {
            const broadcasterStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            boxMediaRef.current[1] = broadcasterStream;

            setBoxes(prev => prev.map(b => b.id === 1 ? ({ ...b, occupiedBy: user, stream: broadcasterStream, joining: false }) : b));

            if (socketRef.current) {
              socketRef.current.emit('join-box', {
                boxId: 1,
                user: { id: user.id, username: user.username, avatar: user.avatar },
                toRoom: stream.id
              });
            }

            await supabase
              .from('stream_participants')
              .insert({
                stream_id: stream.id,
                user_id: user.id,
                box_number: 1,
                username: user.username || user.full_name,
                user_avatar: user.avatar,
                user_level: user.level || 1,
                role: 'host',
                is_publishing: true,
                joined_at: new Date().toISOString()
              });

            toast.success('You joined Box 1 as broadcaster');
          } catch (err) {
            console.error('Failed to auto-join broadcaster:', err);
            toast.error('Could not start camera/mic. Please join manually.');
          }
        }, 500);

      } catch (e) {
        console.error('Create multi stream error', e);
        setIsStartingStream(false);
        toast.error('Failed to create multi-beam stream: ' + e.message);
      }
    }
  };

  const toggleMute = () => {
    const newMuted = !isMicMuted;
    setIsMicMuted(newMuted);
    
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.setEnabled(!newMuted);
    } else if (boxMediaRef.current[1]) {
      boxMediaRef.current[1].getAudioTracks().forEach(t => t.enabled = !newMuted);
    }
    
    toast.success(newMuted ? "🔇 Microphone muted" : "🎤 Microphone unmuted");
  };

  const toggleCamera = () => {
    const newCameraOff = !isCameraOff;
    setIsCameraOff(newCameraOff);
    
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.setEnabled(!newCameraOff);
    } else if (boxMediaRef.current[1]) {
      boxMediaRef.current[1].getVideoTracks().forEach(t => t.enabled = !newCameraOff);
    }
    
    toast.success(newCameraOff ? "📹 Camera off" : "📹 Camera on");
  };

  // FIXED: Add zoom control function
  

  const endStream = async () => {
    if (!currentStream) return;
    try {
      isPlayingLocalVideoRef.current = false;
      
      await supabase
        .from('streams')
        .update({ status: 'ended', is_live: false, ended_date: new Date().toISOString() })
        .eq('id', currentStream.id);

      Object.values(boxMediaRef.current || {}).forEach(s => { try { s.getTracks().forEach(t => t.stop()); } catch(e){} });
      boxMediaRef.current = {};

      Object.values(pcsRef.current || {}).forEach(pc => { try { pc.close(); } catch(e){} });
      pcsRef.current = {};

      if (localAudioTrackRef.current) {
        try { 
          localAudioTrackRef.current.stop();
          localAudioTrackRef.current.close(); 
        } catch(e){}
      }
      if (localVideoTrackRef.current) {
        try { 
          localVideoTrackRef.current.stop();
          localVideoTrackRef.current.close(); 
        } catch(e){}
      }
      if (agoraClientRef.current) try { await agoraClientRef.current.leave(); } catch(e){}
      agoraClientRef.current = null;

      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      if (viewerCountInterval.current) clearInterval(viewerCountInterval.current);

      setIsLive(false);
      setCurrentStream(null);
      setViewerCount(0);
      setStreamDuration(0);
      setStep(1);
      setStreamConfig({ title: '', category: 'gaming', thumbnailUrl: '', streamMode: 'solo', maxParticipants: 1 });
      setThumbnailPreview('');
      setIsMicMuted(false);
      setIsCameraOff(false);
      setIsStartingStream(false);
      

      queryClient.invalidateQueries(['myActiveStreams']);
      queryClient.invalidateQueries(['streams']);

      toast.success('Stream ended');

      navigate(createPageUrl('Home'));
    } catch (e) {
      console.error('End stream error', e);
      navigate(createPageUrl('Home'));
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const getTimeRemaining = () => {
    if ((user?.level || 1) >= 20) return '∞ Unlimited';
    const remaining = 7200 - streamDuration;
    if (remaining <= 0) return "Time's up!";
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}m ${secs}s left`;
  };

  // Enhanced user activity monitoring - kicks inactive users but not too strict
  const checkUserEngagement = async (viewerId, streamId) => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      
      // Check for recent chat activity
      const { data: chatActivity } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('user_id', viewerId)
        .eq('stream_id', streamId)
        .eq('message_type', 'chat')
        .gte('created_date', fifteenMinutesAgo)
        .limit(1);
      
      if (chatActivity && chatActivity.length > 0) return true;
      
      // Check for recent likes
      const { data: likeActivity } = await supabase
        .from('stream_likes')
        .select('id')
        .eq('user_id', viewerId)
        .eq('stream_id', streamId)
        .gte('created_date', fifteenMinutesAgo)
        .limit(1);
      
      if (likeActivity && likeActivity.length > 0) return true;
      
      // Check for recent gifts
      const { data: giftActivity } = await supabase
        .from('stream_gifts')
        .select('id')
        .eq('sender_id', viewerId)
        .eq('stream_id', streamId)
        .gte('created_date', fifteenMinutesAgo)
        .limit(1);
      
      if (giftActivity && giftActivity.length > 0) return true;
      
      return false;
    } catch (error) {
      console.warn('Error checking user engagement:', error);
      return true; // Default to active if check fails
    }
  };

  useEffect(() => {
    if (isLive && currentStream) {
      viewerCountInterval.current = setInterval(async () => {
        try {
          const { data: viewers = [], error } = await supabase
            .from('stream_viewers')
            .select('*')
            .eq('stream_id', currentStream.id);
          if (error) { console.warn('viewer fetch error:', error.message); return; }
          const now = Date.now();
          const activeViewers = viewers.filter(v => v.last_heartbeat && (now - new Date(v.last_heartbeat).getTime()) < 30000);
          setViewerCount(activeViewers.length);
          await supabase
            .from('streams')
            .update({ viewer_count: activeViewers.length, last_heartbeat: new Date().toISOString() })
            .eq('id', currentStream.id);

          // Remove stale viewers (no heartbeat for 60+ seconds)
          const staleViewers = viewers.filter(v => !v.last_heartbeat || (now - new Date(v.last_heartbeat).getTime()) > 60000);
          for (const stale of staleViewers) {
            await supabase
              .from('stream_viewers')
              .delete()
              .eq('id', stale.id)
              .catch(console.error);
          }

          // Enhanced activity monitoring - kick inactive users but not too strict
          // Check viewers who have been quiet for 10+ minutes but still have recent heartbeats
          const quietViewers = viewers.filter(v => {
            const heartbeatAge = now - new Date(v.last_heartbeat).getTime();
            return heartbeatAge < 30000 && heartbeatAge > 600000; // Active heartbeat but watching for 10+ minutes
          });

          for (const viewer of quietViewers) {
            const isEngaged = await checkUserEngagement(viewer.user_id, currentStream.id);
            if (!isEngaged) {
              console.log(`Kicking inactive viewer: ${viewer.user_id} - no activity for 15+ minutes`);
              await supabase
                .from('stream_viewers')
                .delete()
                .eq('id', viewer.id)
                .catch(console.error);
            }
          }
        } catch (e) { console.error(e); }
      }, 3000);

      return () => { if (viewerCountInterval.current) clearInterval(viewerCountInterval.current); };
    }
  }, [isLive, currentStream]);

  useEffect(() => {
    if (isLive) {
      streamStartTime.current = Date.now();
      streamTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - streamStartTime.current) / 1000);
        setStreamDuration(elapsed);
        if ((user?.level || 1) < 20 && elapsed >= 7200) {
          toast.warning('2 hour limit reached — ending stream');
          endStream();
        }
      }, 1000);

      return () => { if (streamTimerRef.current) clearInterval(streamTimerRef.current); };
    }
  }, [isLive, user?.level]);

  // Close box controls when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showBoxControls && !event.target.closest('.box-controls-container')) {
        setShowBoxControls(false);
      }
    };

    if (showBoxControls) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showBoxControls]);

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-purple-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Please login to stream</h2>
          <Button type="button" onClick={() => supabase.auth.redirectToLogin()}>Login</Button>
        </Card>
      </div>
    );
  }

  if (isLive && currentStream) {
    const isMultiBeam = currentStream.stream_mode === 'multi';

    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        {entranceUser && (<div style={{ position:'fixed', inset:0, zIndex:999999, pointerEvents:'none' }}><EntranceEffect username={entranceUser.username || entranceUser.email} onComplete={() => setEntranceUser(null)} /></div>)}

        <GiftAnimation gift={activeGiftAnimation} onComplete={() => setActiveGiftAnimation(null)} />

        <div className="border-b border-[#2a2a3a] bg-[#1a1a24]/80">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <Badge className="bg-red-500 text-white px-4 py-2"><div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />LIVE</Badge>
                <div>
                  <h2 className="text-white font-bold">{currentStream.title}</h2>
                  <p className="text-gray-400 text-sm">{currentStream.category}</p>
                </div>
                {isMultiBeam && (<Badge className="bg-purple-500 text-white"><Grid3x3 className="w-4 h-4 mr-1" />{currentStream.max_participants} Boxes</Badge>)}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="bg-blue-500/20 px-4 py-2"><Clock className="w-4 h-4 mr-2" />{formatTime(streamDuration)}</Badge>
                {(user?.level || 1) < 20 && (<Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 px-4 py-2">⏱️ {getTimeRemaining()}</Badge>)}
                <Badge variant="outline" className="bg-purple-500/20 px-4 py-2"><Eye className="w-4 h-4 mr-2" />{viewerCount}</Badge>
                <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 px-4 py-2"><Coins className="w-4 h-4 mr-2" />{(user?.coins||0).toLocaleString()}</Badge>
                
                {isMultiBeam && (
                  <div className="relative box-controls-container">
                    <Button 
                      type="button" 
                      onClick={() => setShowBoxControls(!showBoxControls)} 
                      variant="outline" 
                      className="bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/30"
                    >
                      <Grid3x3 className="w-4 h-4 mr-2" />
                      Boxes: {currentStream.max_participants}
                    </Button>
                    
                    {showBoxControls && (
                      <div className="absolute top-full left-0 mt-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-4 shadow-lg z-50 min-w-[200px]">
                        <h3 className="text-white font-semibold mb-3">Change Box Count</h3>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {Array.from({length: 13}, (_, i) => i + 1).map(num => (
                            <Button
                              key={num}
                              type="button"
                              onClick={() => handleBoxDowngrade(num)}
                              disabled={num >= currentStream.max_participants}
                              variant="outline"
                              size="sm"
                              className={`${
                                num === currentStream.max_participants 
                                  ? 'bg-purple-500 text-white border-purple-500' 
                                  : num < currentStream.max_participants
                                  ? 'bg-red-500/20 border-red-500 text-red-300 hover:bg-red-500/30'
                                  : 'bg-gray-700/20 border-gray-600 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              {num}
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mb-3">
                          ⚠️ Downgrading will remove users from higher-numbered boxes
                        </p>
                        <Button
                          type="button"
                          onClick={() => setShowBoxControls(false)}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          Close
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                
                <Button type="button" onClick={toggleMute} variant="outline" size="icon" className={isMicMuted ? 'border-red-500 text-red-400' : 'border-green-500 text-green-400'}>{isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</Button>
                <Button type="button" onClick={toggleCamera} variant="outline" size="icon" className={isCameraOff ? 'border-red-500 text-red-400' : 'border-green-500 text-green-400'}>{isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}</Button>
                <Button type="button" onClick={() => endStream()} className="bg-red-600 hover:bg-red-700">End Stream</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {isMultiBeam && joinRequests.length > 0 && (<JoinRequests stream={currentStream} user={user} isStreamer={true} />)}

              <Card className="bg-[#1a1a24] border-[#2a2a3a] overflow-hidden">
                {!isMultiBeam && (
                  <div className="relative aspect-video bg-black overflow-hidden"> {/* Added overflow-hidden here */}
                    <div
                      id="local-player"
                      className="w-full h-full"
                      ref={(el) => {
                        if (el && localVideoTrackRef.current && !isPlayingLocalVideoRef.current) {
                          isPlayingLocalVideoRef.current = true;
                          try {
                            localVideoTrackRef.current.play(el, { fit: "cover" });
                          } catch (playError) {
                            console.warn('Local video play warning:', playError);
                            isPlayingLocalVideoRef.current = false;
                          }
                        }
                      }}
                    />
                    <Badge className="absolute top-4 left-4 bg-green-500 text-white z-10">
                      You (Broadcasting)
                    </Badge>
                    
                  </div>
                )}

                {isMultiBeam && (
                  <div className="relative aspect-video bg-black p-2">
                    <div
                      className="grid gap-2 h-full"
                      style={{
                        gridTemplateColumns: `repeat(${currentStream.max_participants <= 1 ? 1 : currentStream.max_participants <= 4 ? 2 : currentStream.max_participants <= 9 ? 3 : 4}, 1fr)`,
                        gridTemplateRows: `repeat(${Math.ceil(currentStream.max_participants / (currentStream.max_participants <= 1 ? 1 : currentStream.max_participants <= 4 ? 2 : currentStream.max_participants <= 9 ? 3 : 4))}, 1fr)`
                      }}
                    >
                      {boxes.slice(0, currentStream.max_participants).map(b => (
                        <div 
                          key={`box-${b.id}-${currentStream.max_participants}`} 
                          className={`relative bg-[#0a0a0f] rounded-lg border-2 ${b.stream ? 'border-green-500' : 'border-dashed border-gray-700'} flex items-center justify-center transition-all duration-300`}
                          style={{ minHeight: '120px' }}
                        >
                          {b.stream ? (
                            <div className="w-full h-full relative">
                              <video
                                autoPlay
                                playsInline
                                ref={(el) => { if (el && b.stream) el.srcObject = b.stream; }}
                                muted={b.occupiedBy?.id === user.id}
                                className="w-full h-full object-cover rounded-lg"
                              />
                              <Badge className="absolute top-2 left-2 bg-green-500 text-white text-xs z-10">
                                {b.occupiedBy?.id === user.id ? 'You' : b.occupiedBy?.username}
                              </Badge>
                              {b.occupiedBy?.id === user.id && (
                                <Button type="button" onClick={() => leaveBox(b.id)} variant="outline" size="sm" className="absolute top-2 right-2">
                                  Leave
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="text-center p-4 w-full h-full flex flex-col items-center justify-center">
                              <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                              <p className="text-gray-300 text-sm font-semibold">Box {b.id}</p>
                              <p className="text-gray-500 text-xs">{b.occupiedBy ? b.occupiedBy.username : 'Empty'}</p>
                              {!b.occupiedBy && b.id !== 1 && (
                                <Button
                                  type="button"
                                  disabled={b.joining}
                                  onClick={() => handleJoinBoxClick(b.id)}
                                  className="mt-3 bg-purple-600 hover:bg-purple-700"
                                  size="sm"
                                >
                                  {b.joining ? 'Joining...' : 'Join'}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="bg-[#1a1a24] border-[#2a2a3a] min-h-[300px] h-[55svh] md:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-8rem)] flex flex-col overflow-hidden">
                <ChatBox stream={currentStream} user={user} canModerate={true} />
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Go Live</h1>
          <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2">Powered by Agora.io</Badge>
        </div>

        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-2xl font-bold text-white mb-6">Stream Details</h2>
                <div className="space-y-6">
                  <div>
                    <label className="text-white font-medium mb-2 block">Title *</label>
                    <Input value={streamConfig.title} onChange={(e) => setStreamConfig({ ...streamConfig, title: e.target.value })} placeholder="What are you streaming?" className="bg-[#0a0a0f] border-[#2a2a3a] text-white" maxLength={100} />
                  </div>

                  <div>
                    <label className="text-white font-medium mb-2 block">Category *</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {categories.filter(c => c.id !== 'all').map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setStreamConfig({ ...streamConfig, category: c.id })}
                          className={`px-3 py-2 rounded-xl transition-all duration-150 text-sm font-medium ${streamConfig.category === c.id ? 'bg-purple-500 text-white' : 'bg-black text-gray-300 hover:bg-purple-500/10'}`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    <Select value={streamConfig.category} onValueChange={(value) => setStreamConfig({ ...streamConfig, category: value })}>
                      <SelectTrigger className="bg-[#0a0a0f] border-[#2a2a3a] text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gaming">🎮 Gaming</SelectItem>
                        <SelectItem value="music">🎵 Music</SelectItem>
                        <SelectItem value="talk">💬 Just Chatting</SelectItem>
                        <SelectItem value="creative">🎨 Creative</SelectItem>
                        <SelectItem value="smoking">🚬 Smoking</SelectItem>
                        <SelectItem value="drinking">🍺 Drinking</SelectItem>
                        <SelectItem value="comedy">😂 Comedy</SelectItem>
                        <SelectItem value="dating">💕 Dating</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-white font-medium mb-2 block">Stream Mode *</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setStreamConfig({ ...streamConfig, streamMode: 'solo', maxParticipants: 1 })}
                        className={`px-3 py-2 rounded-xl transition-all duration-150 text-sm font-medium ${streamConfig.streamMode === 'solo' ? 'bg-purple-500 text-white' : 'bg-black text-gray-300 hover:bg-purple-500/10'}`}
                      >
                        👤 Solo Stream
                      </button>
                      <button
                        type="button"
                        onClick={() => setStreamConfig({ ...streamConfig, streamMode: 'multi', maxParticipants: Math.max(streamConfig.maxParticipants || 4, 4) })}
                        className={`px-3 py-2 rounded-xl transition-all duration-150 text-sm font-medium ${streamConfig.streamMode === 'multi' ? 'bg-purple-500 text-white' : 'bg-black text-gray-300 hover:bg-purple-500/10'}`}
                      >
                        👥 Multi-Beam (Boxes)
                      </button>
                    </div>
                    <Select value={streamConfig.streamMode} onValueChange={(value) => setStreamConfig({ ...streamConfig, streamMode: value, maxParticipants: value === 'solo' ? 1 : 4 })}>
                      <SelectTrigger className="bg-[#0a0a0f] border-[#2a2a3a] text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo">👤 Solo Stream</SelectItem>
                        <SelectItem value="multi">👥 Multi-Beam (Boxes)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {streamConfig.streamMode === 'multi' && (
                    <div>
                      <label className="text-white font-medium mb-2 block">Number of Boxes *</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setStreamConfig({ ...streamConfig, maxParticipants: n })}
                            className={`px-3 py-2 rounded-xl transition-all duration-150 text-sm font-medium ${streamConfig.maxParticipants === n ? 'bg-purple-500 text-white' : 'bg-black text-gray-300 hover:bg-purple-500/10'}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <Select value={streamConfig.maxParticipants.toString()} onValueChange={(value) => setStreamConfig({ ...streamConfig, maxParticipants: parseInt(value) })}>
                        <SelectTrigger className="bg-[#0a0a0f] border-[#2a2a3a] text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({length: 13}, (_, i) => i + 1).map(n => (
                            <SelectItem key={n} value={n.toString()}>{n} Box{n === 1 ? '' : 'es'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-400 mt-1"><Grid3x3 className="w-3 h-3 inline mr-1" />Others can request to join your boxes</p>
                    </div>
                  )}

                  <div>
                    <label className="text-white font-medium mb-2 block">Thumbnail (Optional)</label>
                    <div className="flex gap-3">
                      <input ref={thumbnailInputRef} type="file" accept="image/*" onChange={async (e) => {
                        const file = e.target.files?.[0]; 
                        if (!file) return; 
                        if (!file.type.startsWith('image/')) { 
                          toast.error('Please upload an image file'); 
                          return; 
                        } 
                        if (file.size > 5*1024*1024) { 
                          toast.error('Max 5MB'); 
                          return; 
                        }
                        try { 
                          setIsUploadingThumbnail(true); 
                          const reader = new FileReader(); 
                          reader.onloadend = () => setThumbnailPreview(reader.result); 
                          reader.readAsDataURL(file); 
                          const { file_url } = await supabase.integrations.Core.UploadFile({ file, bucket: 'avatars', pathPrefix: 'streams' }); 
                          setStreamConfig({ ...streamConfig, thumbnailUrl: file_url }); 
                          toast.success('Thumbnail uploaded'); 
                        } catch(e) { 
                          console.error(e); 
                          toast.error('Failed to upload'); 
                        } finally { 
                          setIsUploadingThumbnail(false); 
                        }
                      }} className="hidden" />

                      <Button type="button" onClick={() => thumbnailInputRef.current?.click()} disabled={isUploadingThumbnail} variant="outline" className="flex-1 border-[#2a2a3a]">
                        {isUploadingThumbnail ? 'Uploading...' : (<><Upload className="w-4 h-4 mr-2" />Upload Thumbnail</>)}
                      </Button>
                      {thumbnailPreview && (<div className="w-32 h-20 rounded overflow-hidden border border-green-500"><img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" /></div>)}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Or auto-capture from camera when going live</p>
                  </div>

                  {(user?.level || 1) < 20 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-yellow-300">
                        <Clock className="w-5 h-5" />
                        <p className="font-semibold">⏱️ 2 Hour Stream Limit</p>
                      </div>
                      <p className="text-yellow-200 text-sm mt-2">Your stream will automatically end after 2 hours. Reach Level 20 for unlimited streaming!</p>
                    </div>
                  )}

                  <Button type="button" onClick={() => setStep(2)} disabled={!streamConfig.title.trim()} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-6">Next</Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-2xl font-bold text-white mb-6">Review & Go Live</h2>
                <div className="space-y-4 mb-6">
                  <div className="bg-[#0a0a0f] rounded-lg p-4"><p className="text-gray-400 text-sm">Title</p><p className="text-white font-semibold">{streamConfig.title}</p></div>
                  <div className="bg-[#0a0a0f] rounded-lg p-4"><p className="text-gray-400 text-sm">Category</p><p className="text-white font-semibold">{streamConfig.category}</p></div>
                  <div className="bg-[#0a0a0f] rounded-lg p-4"><p className="text-gray-400 text-sm">Mode</p><p className="text-white font-semibold">{streamConfig.streamMode === 'solo' ? '👤 Solo Stream' : `👥 Multi-Beam (${streamConfig.maxParticipants} boxes)`}</p></div>
                  {thumbnailPreview && (<div className="bg-[#0a0a0f] rounded-lg p-4"><p className="text-gray-400 text-sm mb-2">Thumbnail</p><img src={thumbnailPreview} alt="Thumbnail" className="w-full h-32 object-cover rounded" /></div>)}
                </div>
                <div className="flex gap-3">
                  <Button type="button" onClick={() => setStep(1)} variant="outline" className="flex-1" disabled={isStartingStream}>Back</Button>
                  <Button type="button" onClick={handleStartStream} disabled={isStartingStream} className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 py-6">{isStartingStream ? 'Starting...' : '🔴 Go Live'}</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  );
}
