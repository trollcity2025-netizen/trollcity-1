import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// import api from '../lib/api'; // Uncomment if needed
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../lib/store';
import { Video } from 'lucide-react';
import { toast } from 'sonner';

const GoLive: React.FC = () => {
  const navigate = useNavigate();
  // Note: videoRef removed - no camera preview in setup

  // const { user, profile } = useAuthStore(); // Using getState() instead for async operations

  const [streamTitle, setStreamTitle] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [_uploadingThumbnail, setUploadingThumbnail] = useState(false); // Thumbnail upload state
  const [broadcasterName, setBroadcasterName] = useState<string>('');
  const [category, setCategory] = useState<string>('Chat');
  const [isPrivateStream, setIsPrivateStream] = useState<boolean>(false);
  const [enablePaidGuestBoxes, setEnablePaidGuestBoxes] = useState<boolean>(false);

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

  // -------------------------------
  // START STREAM
  // -------------------------------
  const handleStartStream = async () => {
    const { profile, user } = useAuthStore.getState();

    if (!user || !profile) {
      toast.error('You must be logged in.');
      return;
    }

    if (!profile.is_broadcaster) {
      toast.error('🚫 You must be an approved broadcaster to go live.');
      return;
    }

    // Note: Camera/microphone permissions will be requested when joining seats in broadcast

    if (!streamTitle.trim()) {
      toast.error('Enter a stream title.');
      return;
    }

    setIsConnecting(true);
    
    // Reset connecting state on function exit to prevent getting stuck
    const cleanup = () => {
      try {
        setIsConnecting(false);
      } catch {}
    };

    // Enhanced timeout helper with better error handling
    const withTimeout = async <T,>(p: Promise<T>, ms = 20000, operation = 'operation'): Promise<T> => {
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
      let thumbnailUrl: string | null = null;

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
              setTimeout(() => reject(new Error('Thumbnail upload timed out')), 8000)
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

      // Quick session verification
      const { data: sessionData, error: sessionError } = await withTimeout(
        supabase.auth.getSession(),
        5000,
        'Session verification'
      );
      
      if (sessionError || !sessionData.session?.access_token) {
        console.error('[GoLive] Session verification failed:', sessionError);
        toast.error('Session expired. Please sign in again.');
        cleanup();
        return;
      }
      console.log('[GoLive] Session verified');

      // Prepare stream data
      const streamData = {
        id: streamId,
        broadcaster_id: profile.id,
        title: streamTitle,
        category: category,
        is_live: false, // Will be set to true when joining seat
        status: 'ready_to_join',
        start_time: new Date().toISOString(),
        thumbnail_url: thumbnailUrl,
        current_viewers: 0,
        total_gifts_coins: 0,
        total_unique_gifters: 0,
        popularity: 0,
        agora_channel: `stream_${streamId}`,
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

        // Use enhanced timeout
        insertResult = await Promise.race([
          insertOperation,
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Stream creation timed out')), 12000)
          )
        ]);
        
        if (insertResult.error) {
          throw insertResult.error;
        }
        
        console.log('[GoLive] Stream created successfully');
        
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
        cleanup();
        return;
      }

      const insertedStream = insertResult.data;
      const createdId = insertedStream?.id;
      
      if (!createdId) {
        console.error('[GoLive] Stream insert did not return an id');
        toast.error('Failed to create stream (no ID returned).');
        cleanup();
        return;
      }
      
      console.log('[GoLive] Stream created successfully:', createdId);

      console.log('[GoLive] Stream created successfully - camera/mic will be requested when joining seat');
      
      // ✅ Pass stream data directly via navigation state to avoid database query
      // This eliminates replication delay issues
      const streamDataForNavigation = {
        id: insertedStream.id,
        broadcaster_id: insertedStream.broadcaster_id || profile.id,
        title: insertedStream.title || streamTitle,
        category: insertedStream.category || category,
        status: 'ready_to_join', // Changed from 'live' to wait for seat joining
        is_live: false, // Will be set to true when they join a seat
        start_time: insertedStream.start_time || new Date().toISOString(),
        current_viewers: insertedStream.current_viewers || 0,
        total_gifts_coins: insertedStream.total_gifts_coins || 0,
        total_unique_gifters: insertedStream.total_unique_gifters || 0,
        thumbnail_url: insertedStream.thumbnail_url || thumbnailUrl,
        created_at: insertedStream.created_at || new Date().toISOString(),
        updated_at: insertedStream.updated_at || new Date().toISOString(),
      };
      
      try {
        navigate(`/broadcast/${createdId}?setup=1`, { 
          state: { streamData: streamDataForNavigation, needsSeatJoin: true } 
        });
        console.log('[GoLive] ✅ Navigation called successfully - waiting for seat join');
        toast.success('Stream created! Please join a seat to start broadcasting.');
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
        toast.error('Starting stream timed out — check network or Supabase and try again.');
      } else if (err?.message?.includes('fetch')) {
        toast.error('Network error: Unable to connect to Supabase. Check your internet connection.');
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
              </select>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-gray-300">Options</label>
              <div className="flex items-center gap-3">
                <input id="private" type="checkbox" checked={isPrivateStream} onChange={() => setIsPrivateStream((v) => !v)} />
                <label htmlFor="private" className="text-sm text-gray-300">Private Stream <span className="text-xs text-purple-300">(1000 troll coins)</span></label>
              </div>
              <div className="flex items-center gap-3">
                <input id="paidGuests" type="checkbox" checked={enablePaidGuestBoxes} onChange={() => setEnablePaidGuestBoxes((v) => !v)} />
                <label htmlFor="paidGuests" className="text-sm text-gray-300">Enable Paid Guest Boxes</label>
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

          <div className="flex items-center gap-4">
            <button
              onClick={handleStartStream}
              disabled={isConnecting || !streamTitle.trim() || !broadcasterName.trim()}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating Stream...
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
