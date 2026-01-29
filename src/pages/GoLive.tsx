import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_ENDPOINTS } from '../lib/api';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../lib/store';
import { useCoins } from '../lib/hooks/useCoins';
import { useBroadcastLockdown } from '../lib/hooks/useBroadcastLockdown';
import { Video } from 'lucide-react';
import BroadcastThemePicker from '../components/broadcast/BroadcastThemePicker';
import { toast } from 'sonner';
import { useLiveKit } from '../hooks/useLiveKit';
import { LIVEKIT_URL } from '../lib/LiveKitConfig';
import { deductCoins } from '../lib/coinTransactions';
import { sendNotification } from '../lib/sendNotification';

const PRIVATE_STREAM_COST = 500;
type StreamQuality = 'STANDARD' | 'HD_BOOST' | 'HIGHEST';

const GoLive: React.FC = () => {
  const { profile, refreshProfile } = useAuthStore(); // Using getState() instead for async operations
  const { refreshCoins } = useCoins();
  const { settings: lockdownSettings } = useBroadcastLockdown();

  const [streamTitle, setStreamTitle] = useState('');
  const [isStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [category, setCategory] = useState<string>('Chat');
  const [isPrivateStream, setIsPrivateStream] = useState<boolean>(false);
  const [privateStreamPassword, setPrivateStreamPassword] = useState<string>('');
  const [boxPriceAmount, setBoxPriceAmount] = useState<number>(0);
  const [boxPriceType, setBoxPriceType] = useState<'per_minute' | 'flat'>('per_minute');
  const [themes, setThemes] = useState<any[]>([]);
  const [ownedThemeIds, setOwnedThemeIds] = useState<Set<string>>(new Set());
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [themesLoading, setThemesLoading] = useState(false);
  const [themePurchaseId, setThemePurchaseId] = useState<string | null>(null);
  const [streamerEntitlements, setStreamerEntitlements] = useState<any>(null);
  const [requestedQuality, setRequestedQuality] = useState<StreamQuality>('HIGHEST');
  const idempotencyKeyRef = useRef<string | null>(null);

  const navigate = useNavigate();
  const liveKit = useLiveKit();
  const liveRestriction = useMemo(() => {
    if (!profile?.live_restricted_until) {
      return { isRestricted: false, message: '' };
    }
    const until = Date.parse(profile.live_restricted_until);
    if (Number.isNaN(until) || until <= Date.now()) {
      return { isRestricted: false, message: '' };
    }
    return {
      isRestricted: true,
      message: `You cannot go live until ${new Date(until).toLocaleString()}`,
    };
  }, [profile?.live_restricted_until]);

  const isAdmin = useMemo(() => {
    return profile?.is_admin || profile?.role === 'admin';
  }, [profile?.is_admin, profile?.role]);

  const isPrivileged = useMemo(() => {
    const role = String(profile?.role || '').toLowerCase();
    if (role.includes('admin') || role.includes('secretary') || role.includes('officer')) return true;
    if (profile?.is_admin || profile?.is_lead_officer || profile?.is_troll_officer) return true;
    return false;
  }, [profile?.role, profile?.is_admin, profile?.is_lead_officer, profile?.is_troll_officer]);

  // Note: Camera/mic permissions will be requested when joining seats in broadcast
  // No camera preview needed in setup



  // Note: All camera/mic functionality moved to seat joining in broadcast page
 
  useEffect(() => {
    const loadThemes = async () => {
      const { user } = useAuthStore.getState();
      if (!user?.id) return;
      setThemesLoading(true);
      try {
        const { data: catalog } = await supabase
          .from('broadcast_background_themes')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        const { data: owned } = await supabase
          .from('user_broadcast_theme_purchases')
          .select('theme_id')
          .eq('user_id', user.id);

        const { data: state } = await supabase
          .from('user_broadcast_theme_state')
          .select('active_theme_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: entitlements } = await supabase
          .from('user_streamer_entitlements')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        setThemes(catalog || []);
        setOwnedThemeIds(new Set((owned || []).map((row: any) => row.theme_id)));
        setActiveThemeId(state?.active_theme_id || null);
        setStreamerEntitlements(entitlements || null);
        setSelectedThemeId(state?.active_theme_id || null);
      } catch (err) {
        console.error('Failed to load broadcast themes', err);
      } finally {
        setThemesLoading(false);
      }
    };

    loadThemes();
  }, []);

  useEffect(() => {
    if (selectedThemeId === null && activeThemeId) {
      setSelectedThemeId(activeThemeId);
    }
  }, [activeThemeId, selectedThemeId]);

  useEffect(() => {
    if (!isPrivateStream) {
      setPrivateStreamPassword('');
    }
  }, [isPrivateStream]);

  const formatCountdown = (targetDate?: string | null) => {
    if (!targetDate) return null;
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) return '0h';
    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  };

  const getEligibility = (theme: any) => {
    const now = Date.now();
    const startsAt = theme?.starts_at ? new Date(theme.starts_at).getTime() : null;
    const endsAt = theme?.ends_at ? new Date(theme.ends_at).getTime() : null;
    const limitedActive = !theme?.is_limited || ((startsAt ? now >= startsAt : true) && (endsAt ? now <= endsAt : true));
    const seasonalState = theme?.is_limited
      ? startsAt && now < startsAt
        ? `Starts in ${formatCountdown(theme.starts_at)}`
        : endsAt && now > endsAt
          ? 'Season ended'
          : endsAt
            ? `Ends in ${formatCountdown(theme.ends_at)}`
            : null
      : null;

    const entitlements = streamerEntitlements || {};
    const streamLevel = entitlements.streamer_level ?? profile?.level ?? 0;
    const followersCount = entitlements.followers_count ?? 0;
    const hoursStreamed = entitlements.total_hours_streamed ?? 0;
    const minLevel = theme?.min_stream_level ?? null;
    const minFollowers = theme?.min_followers ?? null;
    const minHours = theme?.min_total_hours_streamed ?? null;
    const requiresStreamer = Boolean(theme?.is_streamer_exclusive || minLevel || minFollowers || minHours);
    const meetsStreamer =
      (!minLevel || streamLevel >= minLevel) &&
      (!minFollowers || followersCount >= minFollowers) &&
      (!minHours || hoursStreamed >= minHours);

    return {
      limitedActive,
      seasonalState,
      requiresStreamer,
      meetsStreamer,
      isEligible: limitedActive && (!requiresStreamer || meetsStreamer),
      minLevel,
      minFollowers,
      minHours,
    };
  };

  const handleSelectTheme = async (themeId: string | null) => {
    const { user } = useAuthStore.getState();
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.rpc('set_active_broadcast_theme', {
        p_user_id: user.id,
        p_theme_id: themeId
      });
      if (error || data?.success === false) {
        throw new Error(data?.error || error?.message || 'Failed to set theme');
      }
      setActiveThemeId(themeId);
    } catch (err: any) {
      console.error('Theme selection failed', err);
      toast.error(err?.message || 'Failed to set theme');
    }
  };

  const handleBuyTheme = async (themeId: string) => {
    const { user } = useAuthStore.getState();
    if (!user?.id) return;
    setThemePurchaseId(themeId);
    try {
      const { data, error } = await supabase.rpc('purchase_broadcast_theme', {
        p_theme_id: themeId,
        p_set_active: true
      });
      if (error || data?.success === false) {
        throw new Error(data?.error || error?.message || 'Purchase failed');
      }
      setOwnedThemeIds((prev) => new Set([...Array.from(prev), themeId]));
      setActiveThemeId(themeId);
      if (refreshCoins) {
        await refreshCoins();
      }
      if (refreshProfile) {
        await refreshProfile();
      }
      toast.success('Theme purchased and applied');
    } catch (err: any) {
      console.error('Theme purchase failed', err);
      toast.error(err?.message || 'Unable to purchase theme');
    } finally {
      setThemePurchaseId(null);
    }
  };

  // -------------------------------
  // START STREAM
  // -------------------------------
  const handleStartStream = async (manualBattleData?: { battleId: string, opponent: any }) => {
    const { profile, user } = useAuthStore.getState();
    // Battle data is now handled within the broadcast view
    const effectiveBattleData = manualBattleData; 

    if (category === 'Troll Battles' && !effectiveBattleData) {
      toast.error('You must find an opponent first!');
      return;
    }

    if (!user || !profile) {
      toast.error('You must be logged in.');
      return;
    }

    if (!profile.full_name) {
      toast.error('Please complete your profile (add your full name) before going live.');
      return;
    }

    if (liveRestriction.isRestricted) {
      toast.error(liveRestriction.message);
      return;
    }

    // Check broadcast lockdown - only admin can broadcast when enabled
    if (lockdownSettings.enabled && !isAdmin) {
      toast.error('🔴 Broadcasts are currently locked. Only the admin can broadcast right now. Try again later or join the admin\'s broadcast!');
      return;
    }

    // Backend enforcement: double-check with database RPC
    try {
      const { data: canBroadcast, error: broadcastError } = await supabase.rpc('can_start_broadcast');
      if (broadcastError) {
        console.warn('Could not verify broadcast permission with backend:', broadcastError);
        // Fall back to frontend check only if RPC fails
      } else if (!canBroadcast) {
        toast.error('🔴 Broadcasts are currently locked by admin. Please try again later.');
        return;
      }
    } catch (rpcError) {
      console.warn('RPC call failed, using frontend check only:', rpcError);
    }

    const availableCoins = Number(profile.troll_coins || 0);
    if (!isPrivileged && availableCoins < 500) {
      toast.error('You need at least 500 coins to go live. Go make friends and gain more followers to go live.');
      return;
    }

    // All users are now approved to broadcast - no restrictions
    // if (!profile.is_broadcaster) {
    //   toast.error('🚫 You must be an approved broadcaster to go live.');
    //   return;
    // }

    // Immediate Go Live flow requires camera/mic and LiveKit connection before navigation

    if (!streamTitle.trim()) {
      toast.error('Enter a stream title.');
      return;
    }

    // Check for Private Stream cost
    if (isPrivateStream) {
      if (!privateStreamPassword.trim()) {
        toast.error('Set a password for the private stream so viewers can join');
        return;
      }
      const userLevel = profile.level || 0;
      if (userLevel < 40) {
        // Need to pay 1000 coins
        const currentCoins = profile.troll_coins || 0;
        const COST = PRIVATE_STREAM_COST;
        
        if (currentCoins < COST) {
           toast.error(`Private streams cost ${COST} troll_coins. You only have ${currentCoins}.`);
           return;
        }

        // Deduct coins
        try {
          const deduction = await deductCoins({
            userId: user.id,
            amount: COST,
            type: 'perk_purchase', 
            description: 'Private Stream Setup Fee',
            supabaseClient: supabase
          });

          if (!deduction.success) {
            toast.error('Failed to deduct coins for private stream: ' + (deduction.error || 'Unknown error'));
            return;
          }
        } catch (err: any) {
          console.error('Error deducting coins:', err);
          toast.error('Failed to process private stream fee.');
          return;
        }
      }
    }

    setIsConnecting(true);
    
    // Reset connecting state on function exit to prevent getting stuck
    const cleanup = () => {
      try {
        setIsConnecting(false);
      } catch {}
    };

    let sessionId: string | null = null;
    let publishConfig: any = null;
    let livekitToken: string | null = null;
    let hdPaid = false;

    try {
      const idempotencyKey = idempotencyKeyRef.current || crypto.randomUUID();
      idempotencyKeyRef.current = idempotencyKey;

      const prepareResponse = await api.request(API_ENDPOINTS.stream.prepare, {
        method: 'POST',
        body: JSON.stringify({
          requestedQuality,
          idempotencyKey,
        })
      });

      if (!prepareResponse.success || prepareResponse.error) {
        const errorCode = prepareResponse.error || prepareResponse.message;
        console.error('[GoLive] prepare-session error:', errorCode);
        
        if (errorCode?.includes('No active session') || errorCode?.includes('authenticat')) {
          toast.error('Authentication error: Your session may have expired. Please try again.');
          cleanup();
          return;
        }

        throw new Error(errorCode || 'Failed to prepare session');
      }

      sessionId = prepareResponse.sessionId;
      publishConfig = prepareResponse.publishConfig;
      livekitToken = prepareResponse.livekitToken;
      // Support both top-level and nested response shapes
      hdPaid = Boolean((prepareResponse as any).hdPaid ?? (prepareResponse as any)?.data?.hdPaid);
      setRequestedQuality('HIGHEST');

      const streamId = sessionId;
      const roomName = sessionId; // Use sessionId as LiveKit room name

      // 1. Request camera and microphone access FIRST (preflight stream)
      // This ensures we don't create a stream entry if the user denies permissions
      let preflightStream: MediaStream | null = null;
      try {
        const capture = publishConfig?.captureConstraints || {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30 },
          facingMode: 'user'
        };
        preflightStream = await navigator.mediaDevices.getUserMedia({
          video: capture,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log('[GoLive] ✅ Camera & mic granted');
      } catch (permErr: any) {
        console.error('[GoLive] Camera/mic permission failed:', permErr);
        toast.error('Camera/microphone access denied. Please allow permissions.');
        if (hdPaid && sessionId) {
          await api.request(API_ENDPOINTS.stream.refundHDBoost, {
            method: 'POST',
            body: JSON.stringify({ sessionId, reason: 'permission_denied' })
          });
        }
        cleanup();
        return;
      }

      // Optimized stream creation with retry logic and better error handling
      console.log('[GoLive] Starting optimized stream creation...', { streamId, broadcasterId: profile.id });

      // Session verification: prefer cached session from auth store, fall back to Supabase
      let sessionAccessToken: string | null = useAuthStore.getState().session?.access_token ?? null;
      let sessionError: any = null;

      if (!sessionAccessToken) {
        const { data, error } = await supabase.auth.getSession();
        sessionAccessToken = data?.session?.access_token ?? null;
        sessionError = error;
      }

      if (sessionError || !sessionAccessToken) {
        console.error('[GoLive] Session verification failed:', sessionError);
        toast.error('Session expired. Please sign in again.');
        preflightStream?.getTracks().forEach(t => t.stop());
        cleanup();
        return;
      }
      console.log('[GoLive] Session verified');

      // Prepare stream data
      // IMPORTANT: Set is_live to FALSE initially so it doesn't show up on homepage
      // until we have successfully connected to LiveKit
      const streamData = {
        id: streamId,
        broadcaster_id: profile.id,
        title: streamTitle,
        category: category,
        is_live: false, // Hidden initially
        status: 'preparing', // Status preparing
        is_private: isPrivateStream,
        box_price_amount: boxPriceAmount,
        box_price_type: boxPriceType,
        start_time: new Date().toISOString(),
        thumbnail_url: null,
        current_viewers: 0,
        total_gifts_coins: 0,
        total_unique_gifters: 0,
        popularity: 0,
        room_name: roomName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Optimized stream creation with better error handling
      console.log('[GoLive] Attempting stream creation with optimized timeout...');
      
      let insertResult: any = null;
      let lastError: any = null;
      
      try {
        const insertOperation = supabase
          .from('streams')
          .insert(streamData)
          .select()
          .single();

        // Use enhanced timeout - increased for database operations
        insertResult = await Promise.race([
          insertOperation,
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Stream creation timed out')), 25000)
          )
        ]);
        
        if (insertResult.error) {
          throw insertResult.error;
        }
        
        console.log('[GoLive] Stream created successfully (preparing state)');
        
      } catch (err: any) {
        console.error('[GoLive] Stream creation failed:', err);
        lastError = err;
      }
      
      if (!insertResult || insertResult.error) {
        console.error('[GoLive] All insert attempts failed:', { lastError, insertResult });
        
        let errorMessage = 'Failed to create stream.';
        if (lastError?.code === '23505') {
          errorMessage = 'Stream ID conflict. Please try again.';
        } else if (lastError?.message?.includes('permission')) {
          errorMessage = 'Permission denied: You may not have broadcaster privileges.';
        } else if (lastError?.message?.includes('timeout')) {
          errorMessage = 'Stream creation timed out. Please check your connection and try again.';
        } else if (lastError?.message) {
          errorMessage = `Database error: ${lastError.message}`;
        }
        
        toast.error(errorMessage);
        preflightStream?.getTracks().forEach(t => t.stop());
        cleanup();
        return;
      }

      const insertedStream = insertResult.data;
      const createdId = insertedStream?.id;
      
      if (!createdId) {
        console.error('[GoLive] Stream insert did not return an id');
        toast.error('Failed to create stream (no ID returned).');
        preflightStream?.getTracks().forEach(t => t.stop());
        cleanup();
        return;
      }
      
      if (isPrivateStream) {
        try {
          const trimmedPassword = privateStreamPassword.trim();
          const { error: passwordError } = await supabase.rpc('set_stream_password', {
            p_stream_id: createdId,
            p_password: trimmedPassword,
          });
          if (passwordError) {
            throw passwordError;
          }
          if (typeof window !== 'undefined' && trimmedPassword) {
            localStorage.setItem(`private-stream-password:${createdId}`, trimmedPassword);
          }

          try {
            const { data: following, error: followingError } = await supabase
              .from('user_follows')
              .select('following_id')
              .eq('follower_id', user.id);

            if (followingError) {
              throw followingError;
            }

            const targets = (following || []).map((row: any) => row.following_id).filter(Boolean);

            for (const targetId of targets) {
              await sendNotification(
                targetId,
                'stream_live',
                'Private Stream Invite',
                `${profile.username} started a private stream. Password: ${trimmedPassword}`,
                {
                  stream_id: createdId,
                  is_private: true,
                  password: trimmedPassword,
                  broadcaster_id: user.id,
                  broadcaster_username: profile.username,
                }
              );
            }
          } catch (notifyErr) {
            console.error('[GoLive] Failed to send private stream notifications:', notifyErr);
          }
        } catch (passwordErr: any) {
          console.error('[GoLive] Failed to set private stream password:', passwordErr);
          toast.error('Failed to enable the private password. Please try again.');
          preflightStream?.getTracks().forEach(t => t.stop());
          await supabase.from('streams').delete().eq('id', createdId);
          cleanup();
          return;
        }
      }
      
      console.log('[GoLive] Stream created successfully:', createdId);

      // OPTIMIZATION: Connect immediately so user is live when they land on the page
      console.log('[GoLive] 🚀 Starting LiveKit connection (pre-navigation)...');
      let isConnectedNow = false;

      try {
        const tracks = preflightStream ? preflightStream.getTracks() : [];
        const videoTrack = tracks.find(t => t.kind === 'video');
        const audioTrack = tracks.find(t => t.kind === 'audio');

        // Connect using the same service instance that LivePage will use
        const connectedService: any = await liveKit.connect(
          roomName,
          {
            id: user.id,
            identity: profile.username || user.id,
            name: profile.full_name || profile.username,
          },
          {
            tokenOverride: livekitToken || undefined,
            url: LIVEKIT_URL,
            allowPublish: true,
            autoPublish: false, // Manual publish to use existing tracks
            preflightStream: preflightStream || undefined
          }
        );

        if (connectedService) {
          console.log('[GoLive] Connected. Publishing tracks...');
          
          // Publish video
          if (videoTrack) {
             if (connectedService.publishVideoTrack) {
               await connectedService.publishVideoTrack(videoTrack);
             } else {
               console.warn('[GoLive] Service missing publishVideoTrack');
             }
          }

          // Publish audio
          if (audioTrack) {
             if (connectedService.publishAudioTrack) {
               await connectedService.publishAudioTrack(audioTrack);
             } else {
               console.warn('[GoLive] Service missing publishAudioTrack');
             }
          }
          console.log('[GoLive] ✅ Connected and published!');
          isConnectedNow = true;
          
          // Update stream to live immediately (non-blocking)
          Promise.resolve(supabase
            .from('streams')
            .update({ 
              is_live: true, 
              status: 'live' 
            })
            .eq('id', createdId))
            .then(() => {
              console.log('[GoLive] Stream marked live');
              // Notify followers
              supabase.functions.invoke('send-push-notification', {
                body: {
                  broadcast_followers_id: profile.id,
                  title: 'Live Stream',
                  body: `${profile.username} is live! ${streamTitle}`,
                  url: `/broadcast/${createdId}`,
                  create_db_notification: true,
                  type: 'stream_live'
                }
              }).catch(err => console.warn('Broadcast push failed', err));
            })
            .catch(err => console.error('[GoLive] Failed to mark stream live:', err));
        }
      } catch (err) {
        console.error('[GoLive] Pre-connection failed (will retry on LivePage):', err);
        // Do not return, allow navigation to proceed so LivePage can try
      }
      
      // If not connected yet, update stream to starting status
      // Fire and forget (don't await) to speed up navigation
      if (!isConnectedNow) {
        supabase
          .from('streams')
          .update({ 
            is_live: false, 
            status: 'starting' 
          })
          .eq('id', createdId)
          .then(() => console.log('[GoLive] Stream status updated (background)'));
      }

      if (sessionId) {
        // Fire and forget
        api.request(API_ENDPOINTS.stream.markLive, {
          method: 'POST',
          body: JSON.stringify({ sessionId, status: isConnectedNow ? 'live' : 'starting', streamId: createdId })
        });
      }

      // Navigate immediately without waiting for database updates
      console.log('[GoLive] ✅ preparing immediate navigation');
      
      // ✅ Pass stream data directly via navigation state to avoid database query
      // This eliminates replication delay issues
      const streamDataForNavigation = {
        id: insertedStream.id,
        broadcaster_id: insertedStream.broadcaster_id || profile.id,
        title: insertedStream.title || streamTitle,
        category: insertedStream.category || category,
        status: isConnectedNow ? 'live' : 'starting',
        is_live: isConnectedNow,
        start_time: insertedStream.start_time || new Date().toISOString(),
        current_viewers: insertedStream.current_viewers || 0,
        total_gifts_coins: insertedStream.total_gifts_coins || 0,
        total_unique_gifters: insertedStream.total_unique_gifters || 0,
        thumbnail_url: insertedStream.thumbnail_url || null,
        created_at: insertedStream.created_at || new Date().toISOString(),
        updated_at: insertedStream.updated_at || new Date().toISOString(),
        livekit_room_name: roomName,
      };
      
      try {
        navigate(`/live/${createdId}`, { 
          state: { 
            streamData: streamDataForNavigation, 
            isBroadcaster: true, 
            roomName,
            battle: effectiveBattleData
          } 
        });
        console.log('[GoLive] ✅ Navigation called successfully - already publishing');
        toast.success('You are live!');
      } catch (navErr: any) {
        console.error('[GoLive] ❌ Navigation error', navErr);
        toast.error('Stream created but navigation failed. Please navigate manually.');
        cleanup();
        // Don't return here, let it fall through to finally block
      }
    } catch (err: any) {
      if (hdPaid && sessionId) {
        try {
          await api.request(API_ENDPOINTS.stream.refundHDBoost, {
            method: 'POST',
            body: JSON.stringify({ sessionId, reason: 'start_stream_failed' })
          });
        } catch {}
      }
      console.error('[GoLive] Error starting stream:', {
        error: err,
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
        cause: err?.cause
      });
      
      // Provide specific error messages based on error type
      if (err?.message === 'timeout') {
        toast.error('Stream creation timed out. This usually takes 10-30 seconds on slower connections. Please try again.');
      } else if (err?.message?.includes('fetch')) {
        toast.error('Network connection issue. Please check your internet connection and try again.');
      } else if (err?.message?.includes('permission') || err?.message?.includes('unauthorized')) {
        toast.error('Permission denied: You may not have the required broadcaster privileges.');
      } else if (err?.message?.includes('JWT')) {
        toast.error('Authentication error: Please log out and log back in.');
      } else if (err?.message) {
        toast.error(`Stream startup failed: ${err.message}`);
      } else {
        toast.error('Error starting stream. Please try again.');
      }
    } finally {
      cleanup();
    }
  };







  return (
    <div className="max-w-6xl mx-auto space-y-6 go-live-wrapper bg-gradient-to-br from-[#1a003a] via-[#0fffc1] to-[#1a003a] p-1 rounded-2xl shadow-[0_0_32px_4px_rgba(0,255,255,0.15)]">

      <h1 className="text-4xl font-extrabold flex items-center gap-3 neon-text drop-shadow-[0_0_8px_#0fffc1]" style={{textShadow:'0 0 16px #0fffc1, 0 0 32px #ff00ea'}}>
        <Video className="w-10 h-10 text-[#0fffc1] animate-pulse drop-shadow-[0_0_8px_#0fffc1]" />
        <span className="bg-gradient-to-r from-[#0fffc1] via-[#ff00ea] to-[#00b3ff] bg-clip-text text-transparent">Go Live</span>
      </h1>
      
      {/* Broadcast Lockdown Alert */}
      {lockdownSettings.enabled && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-red-200 flex items-start gap-3">
          <span className="text-lg">🔴</span>
          <div>
            <p className="font-semibold">Broadcast Lockdown Active</p>
            <p className="text-sm mt-1">Only the admin can create new broadcasts right now. You can still join and participate in the admin's broadcast!</p>
          </div>
        </div>
      )}

      {liveRestriction.isRestricted && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {liveRestriction.message}
        </div>
      )}

      <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-xl p-8 border border-purple-700/30">
        <div className="text-center text-gray-300">
          <Video className="w-16 h-16 mx-auto mb-3 text-purple-400" />
          <h3 className="text-lg font-semibold text-white mb-2">Ready to Go Live!</h3>
          <p className="text-sm text-gray-300 max-w-sm mx-auto">
            Configure your stream settings and click "Go Live Now!" to start broadcasting.
          </p>
        </div>
      </div>

      {!isStreaming ? (
        <div className="bg-[#0E0A1A] border border-purple-700/40 p-6 rounded-xl space-y-6">
          <div>
            <label className="text-gray-300">Stream Title *</label>
            <input
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              className="w-full bg-[#0e0020] border-2 border-[#0fffc1]/60 focus:border-[#ff00ea] text-white rounded-lg px-4 py-3 neon-input focus:shadow-[0_0_8px_#0fffc1]"
              placeholder="Enter your stream title..."
              style={{boxShadow:'0 0 8px #0fffc1'}}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-300">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#0e0020] border-2 border-[#ff00ea]/60 focus:border-[#0fffc1] text-white rounded-lg px-4 py-3 neon-input"
                style={{boxShadow:'0 0 8px #ff00ea'}}
              >
                <option>Chat</option>
                <option>Gaming</option>
                <option>Music</option>
                <option>IRL</option>
                <option>Officer</option>
              </select>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-gray-300">Options</label>
              <div className="flex items-center gap-3">
                <input id="private" type="checkbox" checked={isPrivateStream} onChange={() => setIsPrivateStream((v) => !v)} />
                <label htmlFor="private" className="text-sm text-gray-300">
                  Private Stream 
                  {/* Level 40+ bypass logic would be checked here for display, but logic is in start stream */}
                  {(profile?.level || 0) >= 40 ? (
                    <span className="text-xs text-green-400 ml-2">(Free for Lvl 40+)</span>
                  ) : (
                    <span className="text-xs text-purple-300 ml-2">({PRIVATE_STREAM_COST.toLocaleString()} troll coins)</span>
                  )}
                </label>
              </div>
              {isPrivateStream && (
                <div className="space-y-1 mt-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-[#0fffc1] drop-shadow-[0_0_4px_#0fffc1]">
                    Invite Password
                  </label>
                  <input
                    type="password"
                    value={privateStreamPassword}
                    onChange={(e) => setPrivateStreamPassword(e.target.value)}
                    placeholder="Enter a password for invited viewers"
                    className="w-full bg-[#0e0020] border-2 border-[#ff00ea]/60 focus:border-[#0fffc1] rounded-lg px-3 py-2 text-sm text-white neon-input focus:shadow-[0_0_8px_#ff00ea]"
                  />
                  <p className="text-xs text-[#bafffa]">
                    Only users with this password can watch.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-gray-300">Guest Box Pricing</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Pricing Type</label>
                  <select
                    value={boxPriceType}
                    onChange={(e) => setBoxPriceType(e.target.value as 'per_minute' | 'flat')}
                    className="w-full bg-[#0e0020] border-2 border-[#0fffc1]/60 focus:border-[#ff00ea] text-white rounded-lg px-3 py-2 text-sm neon-input"
                  >
                    <option value="per_minute">Coins Per Minute</option>
                    <option value="flat">Flat Fee (One-time)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Price (Coins)</label>
                  <input
                    type="number"
                    min="0"
                    value={boxPriceAmount}
                    onChange={(e) => setBoxPriceAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-[#0e0020] border-2 border-[#ff00ea]/60 focus:border-[#0fffc1] text-white rounded-lg px-3 py-2 text-sm neon-input"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {boxPriceAmount === 0 
                  ? "Guests can join boxes for free." 
                  : boxPriceType === 'per_minute' 
                    ? `Guests pay ${boxPriceAmount} coins every minute they are in a box.`
                    : `Guests pay ${boxPriceAmount} coins once to join a box.`}
              </p>
            </div>
          </div>

          <div>
            <label className="text-gray-300">Stream Quality</label>
            <div className="mt-2 rounded-lg border-2 border-[#0fffc1]/60 bg-[#0fffc1]/10 px-4 py-3 text-sm text-[#0fffc1] shadow-[0_0_8px_#0fffc1]">
              <span className="font-bold text-[#ff00ea]">HD streaming</span> is enabled for everyone by default. No boosts or upgrades needed.
            </div>
          </div>

          <div>
            <label className="text-gray-300">Broadcast Background</label>
            <div className="mt-2 space-y-4">
              <div className="rounded-xl border border-purple-700/30 bg-[#0b091f] p-4 space-y-3">
                <div className="text-sm font-semibold text-white mb-2">Select a theme</div>
                <BroadcastThemePicker
                  themes={themes}
                  selected={selectedThemeId}
                  onSelect={(id) => setSelectedThemeId(id)}
                  ownedThemeIds={ownedThemeIds}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectTheme(selectedThemeId)}
                    className={`flex-1 text-xs px-3 py-2 rounded border border-cyan-400/80 text-cyan-200`}
                    disabled={!selectedThemeId}
                  >
                    Use Selected Theme
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTheme(null)}
                    className={`flex-1 text-xs px-3 py-2 rounded border border-white/10 text-white/60`}
                  >
                    Use Default
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
              <button
                onClick={() => handleStartStream()}
                disabled={
                  isConnecting ||
                  !streamTitle.trim() ||
                  liveRestriction.isRestricted ||
                  (lockdownSettings.enabled && !isAdmin)
                }
                className="flex-1 py-3 rounded-lg bg-gradient-to-r from-[#0fffc1] via-[#ff00ea] to-[#00b3ff] text-white font-extrabold neon-btn shadow-[0_0_16px_4px_rgba(0,255,255,0.25)] hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed w-full"
                style={{textShadow:'0 0 8px #0fffc1, 0 0 16px #ff00ea'}}
              >
                {isConnecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#0fffc1]/30 border-t-[#ff00ea] rounded-full animate-spin"></div>
                    <div className="text-left">
                      <div>Creating Stream...</div>
                      <div className="text-xs opacity-75">This may take 10-30 seconds</div>
                    </div>
                  </span>
                ) : (
                  <span className="drop-shadow-[0_0_8px_#0fffc1]">Go Live Now!</span>
                )}
              </button>
            </div>
          </div>
      ) : (
        <div className="p-6 text-gray-300">Redirecting to stream…</div>
      )}
    </div>
  );
};

export default GoLive;
