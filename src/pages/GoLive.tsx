import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// import api from '../lib/api'; // Uncomment if needed
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../lib/store';
import { Video } from 'lucide-react';
import { toast } from 'sonner';
import { useLiveKit } from '../hooks/useLiveKit';
import type { LiveKitServiceConfig } from '../lib/LiveKitService';
import { deductCoins } from '../lib/coinTransactions';

const GoLive: React.FC = () => {
  const navigate = useNavigate();
  const liveKit = useLiveKit();
  // Note: videoRef removed - no camera preview in setup

  const { profile } = useAuthStore(); // Using getState() instead for async operations

  const [streamTitle, setStreamTitle] = useState('');
  const [isStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [_uploadingThumbnail, setUploadingThumbnail] = useState(false); // Thumbnail upload state
  const [broadcasterName, setBroadcasterName] = useState<string>('');
  const [category, setCategory] = useState<string>('Chat');
  const [isPrivateStream, setIsPrivateStream] = useState<boolean>(false);
  const [themes, setThemes] = useState<any[]>([]);
  const [ownedThemeIds, setOwnedThemeIds] = useState<Set<string>>(new Set());
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [themesLoading, setThemesLoading] = useState(false);
  const [themePurchaseId, setThemePurchaseId] = useState<string | null>(null);

  // Note: Camera/mic permissions will be requested when joining seats in broadcast
  // No camera preview needed in setup



  const [_broadcasterStatus, setBroadcasterStatus] = useState<{
    isApproved: boolean;
    hasApplication: boolean;
    applicationStatus: string | null;
  } | null>(null); // Broadcaster approval status

  // Note: All camera/mic functionality moved to seat joining in broadcast page

  // -------------------------------
  // CHECK BROADCASTER STATUS
  // -------------------------------
  useEffect(() => {
    const checkStatus = async () => {
      const { user, profile } = useAuthStore.getState();
      if (!user || !profile) return;

      // If already marked broadcaster
      if (profile.is_broadcaster) {
        setBroadcasterStatus({
          isApproved: true,
          hasApplication: true,
          applicationStatus: 'approved',
        });
        return;
      }

      // Check broadcaster_applications table
      const { data } = await supabase
        .from('broadcaster_applications')
        .select('application_status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        setBroadcasterStatus({
          isApproved: false,
          hasApplication: false,
          applicationStatus: null,
        });
      } else {
        setBroadcasterStatus({
          isApproved: data.application_status === 'approved',
          hasApplication: true,
          applicationStatus: data.application_status,
        });
      }
    };

    checkStatus();
    // Prefill broadcaster name if available
    const p = useAuthStore.getState().profile;
    if (p?.username) setBroadcasterName(p.username);
  }, []);

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

        setThemes(catalog || []);
        setOwnedThemeIds(new Set((owned || []).map((row: any) => row.theme_id)));
        setActiveThemeId(state?.active_theme_id || null);
      } catch (err) {
        console.error('Failed to load broadcast themes', err);
      } finally {
        setThemesLoading(false);
      }
    };

    loadThemes();
  }, []);

  const buildThemeStyle = (theme?: any) => {
    if (!theme) return {};
    if (theme.background_css) {
      return { background: theme.background_css };
    }
    if (theme.background_asset_url) {
      return {
        backgroundImage: `url(${theme.background_asset_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      };
    }
    return {};
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
      const userLevel = profile.level || 0;
      if (userLevel < 40) {
        // Need to pay 1000 coins
        const currentCoins = profile.troll_coins || 0;
        const COST = 1000;
        
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

    // Enhanced timeout helper with better error handling - increased timeouts for database operations
    const withTimeout = async <T,>(p: Promise<T>, ms = 30000, operation = 'operation'): Promise<T> => {
      let timer: any = null;
      return await Promise.race([
        p.then((v) => {
          if (timer) clearTimeout(timer);
          return v;
        }),
        new Promise<never>((_, rej) => {
          timer = setTimeout(() => {
            rej(new Error(`${operation} timed out after ${ms}ms`));
          }, ms);
        }),
      ]);
    };

    try {
      const streamId = crypto.randomUUID();
      const roomName = streamId; // Use streamId as LiveKit room name
      let thumbnailUrl: string | null = null;

      // 1. Request camera and microphone access FIRST (preflight stream)
      // This ensures we don't create a stream entry if the user denies permissions
      let preflightStream: MediaStream | null = null;
      try {
        preflightStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'user',
            frameRate: { ideal: 30, max: 60 }
          },
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
        cleanup();
        return;
      }

      // Optimized thumbnail upload (skip if not needed for faster stream creation)
      if (thumbnailFile) {
        console.log('[GoLive] Starting thumbnail upload...');
        setUploadingThumbnail(true);

        try {
          const fileName = `thumb-${streamId}-${Date.now()}.${thumbnailFile.name.split('.').pop()}`;
          const filePath = `thumbnails/${fileName}`;

          // Use timeout for thumbnail upload to prevent hanging
          const uploadPromise = supabase.storage
            .from('troll-city-assets')
            .upload(filePath, thumbnailFile, { upsert: false });

          const uploadResult = await Promise.race([
            uploadPromise,
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Thumbnail upload timed out')), 15000)
            )
          ]);

          if (!uploadResult.error) {
            const { data: url } = supabase.storage.from('troll-city-assets').getPublicUrl(filePath);
            thumbnailUrl = url.publicUrl;
            console.log('[GoLive] Thumbnail uploaded successfully');
          } else {
            console.warn('[GoLive] Thumbnail upload failed, continuing without thumbnail:', uploadResult.error);
          }
        } catch (uploadErr: any) {
          console.warn('[GoLive] Thumbnail upload failed, continuing without thumbnail:', uploadErr);
          // Don't fail the entire stream creation if thumbnail upload fails
        } finally {
          setUploadingThumbnail(false);
        }
      } else {
        console.log('[GoLive] No thumbnail provided, skipping upload');
      }

      // Optimized stream creation with retry logic and better error handling
      console.log('[GoLive] Starting optimized stream creation...', { streamId, broadcasterId: profile.id });

      // Quick session verification - increased timeout for slower networks
      const { data: sessionData, error: sessionError } = await withTimeout(
        supabase.auth.getSession(),
        10000,
        'Session verification'
      );
      
      if (sessionError || !sessionData.session?.access_token) {
        console.error('[GoLive] Session verification failed:', sessionError);
        toast.error('Session expired. Please sign in again.');
        // Stop media tracks if we fail here
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
        start_time: new Date().toISOString(),
        thumbnail_url: thumbnailUrl,
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
      
      console.log('[GoLive] Stream created successfully:', createdId);

      // Connect to LiveKit and publish both tracks before navigation
      const identity = user.id;
      const service = await liveKit.connect(roomName, { id: identity }, {
        allowPublish: true,
        autoPublish: true,
        preflightStream,
      } as Partial<LiveKitServiceConfig>);

      if (!service) {
        console.error('[GoLive] LiveKit connect failed');
        toast.error('Failed to connect to LiveKit. Please try again.');
        preflightStream?.getTracks().forEach(t => t.stop());
        // Clean up the stream we just created since we can't broadcast
        await supabase.from('streams').delete().eq('id', createdId);
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
        thumbnail_url: insertedStream.thumbnail_url || thumbnailUrl,
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

          <div>
            <label className="text-gray-300">Broadcaster Name *</label>
            <input
              value={broadcasterName}
              onChange={(e) => setBroadcasterName(e.target.value)}
              className="w-full bg-[#171427] border border-purple-500/40 text-white rounded-lg px-4 py-3"
              placeholder="Your display name..."
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
                    <span className="text-xs text-purple-300 ml-2">(1000 troll coins)</span>
                  )}
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="text-gray-300">Stream Thumbnail (Optional)</label>
            <div className="mt-2">
              <label className="block w-full border-2 border-dashed border-purple-700/30 rounded-lg p-6 text-center cursor-pointer">
                {thumbnailPreview ? (
                  <img src={thumbnailPreview} className="mx-auto max-h-40 object-contain" />
                ) : (
                  <div className="text-gray-400">Click to upload thumbnail<br/><span className="text-xs text-gray-500">PNG, JPG up to 5MB</span></div>
                )}
                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f) {
                      setThumbnailFile(f);
                      setThumbnailPreview(URL.createObjectURL(f));
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="text-gray-300">Broadcast Background</label>
            <div className="mt-2 space-y-4">
              <div className="rounded-xl border border-purple-700/30 bg-[#0b091f] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Preview</div>
                    <div className="text-xs text-gray-400">Applies to your broadcast stage only.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTheme(null)}
                    className={`text-xs px-3 py-1 rounded border ${!activeThemeId ? 'border-cyan-400/70 text-cyan-200' : 'border-white/10 text-white/60'}`}
                  >
                    Default
                  </button>
                </div>
                <div
                  className="mt-3 h-28 rounded-lg border border-white/10"
                  style={buildThemeStyle(themes.find(t => t.id === activeThemeId))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {themesLoading && <div className="text-xs text-gray-400">Loading themes...</div>}
                {!themesLoading && themes.length === 0 && (
                  <div className="text-xs text-gray-500">No themes available yet.</div>
                )}
                {!themesLoading && themes.map((theme) => {
                  const owned = ownedThemeIds.has(theme.id);
                  const isActive = activeThemeId === theme.id;
                  return (
                    <div key={theme.id} className="rounded-xl border border-purple-700/20 bg-[#120f1f] p-3 space-y-2">
                      <div className="h-20 rounded-lg border border-white/10 overflow-hidden" style={buildThemeStyle(theme)} />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">{theme.name}</div>
                          <div className="text-[10px] text-gray-400">{theme.rarity || 'standard'}</div>
                        </div>
                        <div className="text-xs text-yellow-300">{theme.price_coins.toLocaleString()} coins</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {owned ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSelectTheme(theme.id)}
                              className={`flex-1 text-xs px-3 py-2 rounded border ${isActive ? 'border-cyan-400/80 text-cyan-200' : 'border-white/10 text-white/70 hover:text-white'}`}
                            >
                              {isActive ? 'Active' : 'Use Theme'}
                            </button>
                            <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-200">Owned</span>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBuyTheme(theme.id)}
                            disabled={themePurchaseId === theme.id}
                            className="flex-1 text-xs px-3 py-2 rounded border border-pink-500/40 text-pink-200 hover:text-white"
                          >
                            {themePurchaseId === theme.id ? 'Purchasing...' : 'Buy Theme'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleStartStream}
              disabled={isConnecting || !streamTitle.trim() || !broadcasterName.trim()}
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
