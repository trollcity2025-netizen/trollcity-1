import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import api from '../lib/api'; // Uncomment if needed
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Video } from 'lucide-react';
import { toast } from 'sonner';

const GoLive: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  // const { user, profile } = useAuthStore(); // Using getState() instead for async operations

  const [streamTitle, setStreamTitle] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  
  const [isTestingMode, _setIsTestingMode] = useState(false); // Testing mode state

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [_uploadingThumbnail, setUploadingThumbnail] = useState(false); // Thumbnail upload state
  const [broadcasterName, setBroadcasterName] = useState<string>('');
  const [category, setCategory] = useState<string>('Chat');
  const [isPrivateStream, setIsPrivateStream] = useState<boolean>(false);
  const [enablePaidGuestBoxes, setEnablePaidGuestBoxes] = useState<boolean>(false);

  const [_broadcasterStatus, setBroadcasterStatus] = useState<{
    isApproved: boolean;
    hasApplication: boolean;
    applicationStatus: string | null;
  } | null>(null); // Broadcaster approval status

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

    if (!profile.is_broadcaster && !isTestingMode) {
      toast.error('🚫 You must be an approved broadcaster to go live.');
      return;
    }

    if (!streamTitle.trim()) {
      toast.error('Enter a stream title.');
      return;
    }

    setIsConnecting(true);

    // small helper to add timeouts to long-running promises
    const withTimeout = async <T,>(p: Promise<T>, ms = 30000): Promise<T> => {
      let timer: any = null;
      return await Promise.race([
        p.then((v) => {
          if (timer) clearTimeout(timer);
          return v;
        }),
        new Promise((_, rej) => {
          timer = setTimeout(() => rej(new Error('timeout')), ms);
        }) as any,
      ]);
    };

    try {
      const streamId = crypto.randomUUID();
      let thumbnailUrl: string | null = null;

      // Upload thumbnail
      if (thumbnailFile) {
        setUploadingThumbnail(true);

        const fileName = `thumb-${streamId}-${Date.now()}.${thumbnailFile.name.split('.').pop()}`;
        const filePath = `thumbnails/${fileName}`;

        const upload = await supabase.storage
          .from('troll-city-assets')
          .upload(filePath, thumbnailFile, { upsert: false });

        if (!upload.error) {
          const { data: url } = supabase.storage.from('troll-city-assets').getPublicUrl(filePath);
          thumbnailUrl = url.publicUrl;
        }

        setUploadingThumbnail(false);
      }

      // Enhanced DB health check with comprehensive logging
      try {
        console.log('[GoLive] Running enhanced DB health check...');
        
        // Log environment variables (safely)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        console.log('[GoLive] Environment check:', {
          hasUrl: !!supabaseUrl,
          urlLength: supabaseUrl?.length || 0,
          hasAnonKey: !!supabaseAnonKey,
          anonKeyLength: supabaseAnonKey?.length || 0,
          url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING'
        });
        
        // Use the healthcheck RPC function for reliable connectivity testing
        const healthQuery = supabase.rpc('healthcheck');
        const health = await withTimeout(Promise.resolve(healthQuery), 5000);
        
        console.log('[GoLive] DB health check result:', {
          data: health.data,
          error: health.error,
          status: health.status,
          statusText: health.statusText,
          fullResponse: health
        });
        
        if (health.error) {
          console.error('[GoLive] Health check Supabase error:', health.error);
          throw new Error(`Supabase health check failed: ${health.error.message || health.error}`);
        }
        
        console.log('[GoLive] ✅ Database health check passed');
      } catch (hErr: any) {
        console.error('[GoLive] DB health check failed:', hErr);
        
        // Show the exact Supabase error message in toast
        const errorMessage = hErr?.message || hErr?.error?.message || 'Unknown database error';
        toast.error(`Database health check failed: ${errorMessage}`);
        
        // continue to attempt insert; health check is advisory
      }

      // Insert into streams table (use timeout to avoid hanging UI)
      console.log('[GoLive] Inserting stream row into DB...');

      const insertOperation = supabase
        .from('streams')
        .insert({
          id: streamId,
          broadcaster_id: profile.id,
          title: streamTitle,
          room_name: String(streamId),
          is_live: true,
          status: 'live',
          start_time: new Date().toISOString(),
          thumbnail_url: thumbnailUrl,
          is_testing_mode: isTestingMode,
          viewer_count: 0,
          current_viewers: 0,
          total_gifts_coins: 0,
          popularity: 0,
        })
        .select()
        .single();

      const result: any = await withTimeout(Promise.resolve(insertOperation), 30000);

      if (result.error) {
        console.error('[GoLive] Supabase insert immediate error:', {
          error: result.error,
          message: result.error?.message,
          details: result.error?.details,
          hint: result.error?.hint,
          code: result.error?.code,
          fullError: result.error
        });
        
        // Show specific error message based on error type
        let errorMessage = 'Failed to start stream.';
        if (result.error?.message?.includes('permission')) {
          errorMessage = 'Permission denied: You may not have broadcaster privileges.';
        } else if (result.error?.message?.includes('duplicate')) {
          errorMessage = 'Stream already exists or duplicate ID conflict.';
        } else if (result.error?.code === '23505') {
          errorMessage = 'Stream ID conflict - please try again.';
        } else if (result.error?.message) {
          errorMessage = `Database error: ${result.error.message}`;
        }
        
        toast.error(errorMessage);
        return;
      }

      const insertedStream = result.data ?? result;
      const createdId = insertedStream?.id;
      if (!createdId) {
        console.error('[GoLive] Stream insert did not return an id', insertedStream);
        toast.error('Failed to start stream (no id returned).');
        return;
      }

      setIsStreaming(true);
      console.log('[GoLive] Stream created successfully, navigating to broadcast', { createdId });
      navigate(`/broadcast/${createdId}?start=1`);
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
      try {
        setIsConnecting(false);
      } catch {}
    }
  };

  // -------------------------------
  // Camera preview
  // -------------------------------
  useEffect(() => {
    let previewStream: MediaStream | null = null;

    if (videoRef.current && !isStreaming) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
        previewStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }).catch((err) => {
        console.error('Error accessing camera/microphone:', err);
      });
    }
    // Cleanup: Stop all tracks when component unmounts or when streaming starts
    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isStreaming]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 go-live-wrapper">

      <h1 className="text-3xl font-extrabold flex items-center gap-2">
        <Video className="text-troll-gold w-8 h-8" />
        Go Live
      </h1>

      <div className="host-video-box relative rounded-xl overflow-hidden border border-purple-700/30">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-32 md:h-40 lg:h-48 object-cover bg-black"
        />
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
              disabled={isConnecting}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-semibold"
            >
              {isConnecting ? 'Starting…' : 'Go Live Now!'}
            </button>

            {/* Broadcaster options removed per design */}
          </div>
        </div>
      ) : (
        <div className="p-6 text-gray-300">Redirecting to stream…</div>
      )}
    </div>
  );
};

export default GoLive;
