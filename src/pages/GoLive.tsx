import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_ENDPOINTS } from '../lib/api';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../lib/store';
import { useCoins } from '../lib/hooks/useCoins';
import { Video } from 'lucide-react';
import { toast } from 'sonner';
import { useLiveKit } from '../hooks/useLiveKit';
import type { LiveKitServiceConfig } from '../lib/LiveKitService';
import { deductCoins } from '../lib/coinTransactions';
import { sendNotification } from '../lib/sendNotification';

const PRIVATE_STREAM_COST = 500;
type StreamQuality = 'STANDARD' | 'HD_BOOST' | 'HIGHEST';

const GoLive: React.FC = () => {
  const { profile, refreshProfile } = useAuthStore(); // Using getState() instead for async operations
  const { refreshCoins } = useCoins();

  const [streamTitle, setStreamTitle] = useState('');
  const [isStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [category, setCategory] = useState<string>('Chat');
  const [isPrivateStream, setIsPrivateStream] = useState<boolean>(false);
  const [privateStreamPassword, setPrivateStreamPassword] = useState<string>('');
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
        p_user_id: user.id,
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
  const handleStartStream = async () => {
    const { profile, user } = useAuthStore.getState();

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

      // Connect to LiveKit and publish both tracks before navigation
      const identity = user.id;
      const service = await liveKit.connect(roomName, { id: identity }, {
        allowPublish: true,
        autoPublish: true,
        preflightStream,
        tokenOverride: livekitToken || undefined,
        publishConfig,
      } as Partial<LiveKitServiceConfig>);

      if (!service) {
        console.error('[GoLive] LiveKit connect failed');
        toast.error('Failed to connect to LiveKit. Please try again.');
        preflightStream?.getTracks().forEach(t => t.stop());
        // Clean up the stream we just created since we can't broadcast
        await supabase.from('streams').delete().eq('id', createdId);
        if (hdPaid && sessionId) {
          await api.request(API_ENDPOINTS.stream.refundHDBoost, {
            method: 'POST',
            body: JSON.stringify({ sessionId, reason: 'livekit_connect_failed' })
          });
        }
        cleanup();
        return;
      }
      console.log('[GoLive] ✅ Connected to LiveKit and publishing');
      
      // Update stream to starting status (not live yet)
      // The LivePage will update it to 'live' once fully connected
      await supabase
        .from('streams')
        .update({ 
          is_live: false, 
          status: 'starting' 
        })
        .eq('id', createdId);

      if (sessionId) {
        await api.request(API_ENDPOINTS.stream.markLive, {
          method: 'POST',
          body: JSON.stringify({ sessionId, status: 'live', streamId: createdId })
        });
      }

      console.log('[GoLive] ✅ Stream status updated to STARTING');
      
      // ✅ Pass stream data directly via navigation state to avoid database query
      // This eliminates replication delay issues
      const streamDataForNavigation = {
        id: insertedStream.id,
        broadcaster_id: insertedStream.broadcaster_id || profile.id,
        title: insertedStream.title || streamTitle,
        category: insertedStream.category || category,
        status: 'starting',
        is_live: false,
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
          state: { streamData: streamDataForNavigation, isBroadcaster: true, roomName } 
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
    <div className="max-w-6xl mx-auto space-y-6 go-live-wrapper">

      <h1 className="text-3xl font-extrabold flex items-center gap-2">
        <Video className="text-troll-gold w-8 h-8" />
        Go Live
      </h1>
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
              className="w-full bg-[#171427] border border-purple-500/40 text-white rounded-lg px-4 py-3"
              placeholder="Enter your stream title..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-300">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#171427] border border-purple-500/40 text-white rounded-lg px-4 py-3"
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
                  <label className="text-xs uppercase tracking-[0.3em] text-gray-400">
                    Invite Password
                  </label>
                  <input
                    type="password"
                    value={privateStreamPassword}
                    onChange={(e) => setPrivateStreamPassword(e.target.value)}
                    placeholder="Enter a password for invited viewers"
                    className="w-full bg-[#0E0A1A] border border-purple-600/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-400"
                  />
                  <p className="text-xs text-gray-500">
                    Only viewers who know this password can join. Passwords never expire during the stream.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-gray-300">Stream Quality</label>
            <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              HD streaming is enabled for everyone by default. No boosts or upgrades needed.
            </div>
          </div>

          <div>
            <label className="text-gray-300">Broadcast Background</label>
            <div className="mt-2 space-y-4">
            <div className="rounded-xl border border-purple-700/30 bg-[#0b091f] p-4 space-y-3">
                <div className="text-sm font-semibold text-white">Select a theme</div>
                <select
                  value={selectedThemeId || ''}
                  onChange={(e) => setSelectedThemeId(e.target.value || null)}
                  className="w-full bg-[#171427] border border-purple-500/40 text-white rounded-lg px-4 py-3"
                  disabled={themesLoading}
                >
                  <option value="">Default (free)</option>
                  {themes.map((theme) => {
                    const owned = ownedThemeIds.has(theme.id);
                    const eligibility = getEligibility(theme);
                    const locked = !eligibility.isEligible;
                    const labelParts = [
                      theme.name,
                      owned ? 'Owned' : `${theme.price_coins.toLocaleString()} coins`,
                      locked ? 'Locked' : null
                    ].filter(Boolean);
                    return (
                      <option key={theme.id} value={theme.id} disabled={locked}>
                      {labelParts.join(' - ')}
                      </option>
                    );
                  })}
                </select>

                {themesLoading && <div className="text-xs text-gray-400">Loading themes...</div>}
                {!themesLoading && themes.length === 0 && (
                  <div className="text-xs text-gray-500">No themes available yet.</div>
                )}

                {(() => {
                  const selectedTheme = themes.find((t) => t.id === selectedThemeId);
                  if (!selectedTheme) {
                    return (
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Default background active.</span>
                        <button
                          type="button"
                          onClick={() => handleSelectTheme(null)}
                          className={`px-3 py-1 rounded border ${!activeThemeId ? 'border-cyan-400/70 text-cyan-200' : 'border-white/10 text-white/60'}`}
                        >
                          Use Default
                        </button>
                      </div>
                    );
                  }

                  const owned = ownedThemeIds.has(selectedTheme.id);
                  const isActive = activeThemeId === selectedTheme.id;
                  const eligibility = getEligibility(selectedTheme);
                  const isAnimated = selectedTheme.asset_type === 'video';
                  const isLimited = Boolean(selectedTheme.is_limited);
                  const isExclusive = Boolean(selectedTheme.is_streamer_exclusive || selectedTheme.min_stream_level || selectedTheme.min_followers || selectedTheme.min_total_hours_streamed);

                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-gray-400">
                        <span>{selectedTheme.rarity || 'standard'}</span>
                        {isAnimated && <span className="text-cyan-200">Animated</span>}
                        {isLimited && <span className="text-pink-200">Limited</span>}
                        {isExclusive && <span className="text-amber-200">Exclusive</span>}
                      </div>
                      {!eligibility.isEligible && (
                        <div className="text-[11px] text-red-200 space-y-1">
                          <div>{eligibility.seasonalState || 'Locked'}</div>
                          {eligibility.requiresStreamer && !eligibility.meetsStreamer && (
                            <div className="text-[10px] text-white/60">
                              Needs
                              {eligibility.minLevel ? ` Lv ${eligibility.minLevel}` : ''}
                              {eligibility.minFollowers ? ` - ${eligibility.minFollowers}+ followers` : ''}
                              {eligibility.minHours ? ` - ${eligibility.minHours}+ hrs` : ''}
                            </div>
                          )}
                        </div>
                      )}
                      {eligibility.isEligible && eligibility.seasonalState && (
                        <div className="text-[11px] text-yellow-200">{eligibility.seasonalState}</div>
                      )}

                      <div className="flex items-center gap-2">
                        {owned ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSelectTheme(selectedTheme.id)}
                              className={`flex-1 text-xs px-3 py-2 rounded border ${isActive ? 'border-cyan-400/80 text-cyan-200' : 'border-white/10 text-white/70 hover:text-white'}`}
                            >
                              {isActive ? 'Active' : 'Enable'}
                            </button>
                            <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-200">Owned</span>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBuyTheme(selectedTheme.id)}
                            disabled={!eligibility.isEligible || themePurchaseId === selectedTheme.id}
                            className="flex-1 text-xs px-3 py-2 rounded border border-pink-500/40 text-pink-200 hover:text-white"
                          >
                            {themePurchaseId === selectedTheme.id
                              ? 'Purchasing...'
                              : Number(selectedTheme.price_coins || 0) === 0
                                ? 'Claim Free'
                                : eligibility.isEligible
                                  ? 'Buy Theme'
                                  : 'Locked'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
            onClick={handleStartStream}
            disabled={
              isConnecting ||
              !streamTitle.trim() ||
              liveRestriction.isRestricted
            }
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <div className="text-left">
                    <div>Creating Stream...</div>
                    <div className="text-xs opacity-75">This may take 10-30 seconds</div>
                  </div>
                </span>
              ) : (
                'Go Live Now!'
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
