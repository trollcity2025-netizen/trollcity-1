import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Video } from 'lucide-react';
import BroadcasterApplicationForm from '../components/BroadcasterApplicationForm';
import { toast } from 'sonner';

const GoLive: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const { user, profile } = useAuthStore.getState();

  const [streamTitle, setStreamTitle] = useState('');
  const [starting, setStarting] = useState(false);

  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const [broadcasterStatus, setBroadcasterStatus] = useState<{
    isApproved: boolean;
    hasApplication: boolean;
    applicationStatus: string | null;
  } | null>(null);

  /* ----------------------------------------------------
     CHECK BROADCASTER STATUS (NO UI BLOCKING)
  ---------------------------------------------------- */
  useEffect(() => {
    const run = async () => {
      if (!user || !profile) return;

      if (profile.is_broadcaster) {
        setBroadcasterStatus({
          isApproved: true,
          hasApplication: true,
          applicationStatus: 'approved',
        });
        return;
      }

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

    run();
  }, []);

  const isApprovedBroadcaster =
    profile?.is_broadcaster ||
    (broadcasterStatus?.isApproved &&
      broadcasterStatus?.applicationStatus === 'approved');

  /* ----------------------------------------------------
     CAMERA PREVIEW (NO OVERLAY EVER)
  ---------------------------------------------------- */
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startPreview = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error(err);
        toast.error('Camera or microphone permission denied.');
      }
    };

    startPreview();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  /* ----------------------------------------------------
     THUMBNAIL HANDLING
  ---------------------------------------------------- */
  const handleThumbnailChange = (file: File | null) => {
    if (!file) {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
      setThumbnailFile(null);
      setThumbnailPreview(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Thumbnail must be an image.');
      return;
    }

    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);

    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  /* ----------------------------------------------------
     START STREAM (NO WAIT SCREEN)
  ---------------------------------------------------- */
  const handleStartStream = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in.');
      return;
    }

    if (!isApprovedBroadcaster) {
      toast.error('You are not approved to broadcast.');
      return;
    }

    if (!streamTitle.trim()) {
      toast.error('Stream title required.');
      return;
    }

    setStarting(true);

    try {
      const streamId = crypto.randomUUID();
      let thumbnailUrl: string | null = null;

      if (thumbnailFile) {
        setUploadingThumbnail(true);

        const path = `thumbnails/${streamId}-${Date.now()}-${thumbnailFile.name}`;

        const upload = await supabase.storage
          .from('troll-city-assets')
          .upload(path, thumbnailFile);

        if (!upload.error) {
          const { data } = supabase.storage
            .from('troll-city-assets')
            .getPublicUrl(path);

          thumbnailUrl = data.publicUrl;
        }

        setUploadingThumbnail(false);
      }

      await supabase.from('streams').insert({
        id: streamId,
        broadcaster_id: user.id,
        title: streamTitle,
        room_name: streamId,
        is_live: true,
        status: 'live',
        start_time: new Date().toISOString(),
        thumbnail_url: thumbnailUrl,
        viewer_count: 0,
        current_viewers: 0,
        total_gifts_coins: 0,
        popularity: 0,
      });

      const { data, error } = await supabase.functions.invoke(
        'livekit-token',
        {
          body: {
            room: streamId,
            identity: user.id,
            user_id: user.id,
            isHost: true,
            allowPublish: true,
          },
        }
      );

      if (error || !data?.token) {
        toast.error('LiveKit token failed.');
        return;
      }

      navigate(`/live/${streamId}`, {
        state: {
          roomName: streamId,
          serverUrl:
            data.serverUrl ||
            data.livekitUrl ||
            import.meta.env.VITE_LIVEKIT_URL,
          token: data.token,
          isHost: true,
          streamTitle,
        },
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to go live.');
    } finally {
      setStarting(false);
    }
  };

  /* ----------------------------------------------------
     ACCESS DENIED
  ---------------------------------------------------- */
  if (!user || !profile || broadcasterStatus === null) {
    return null; // prevents flicker / false denial
  }

  if (!isApprovedBroadcaster) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-extrabold flex items-center gap-2">
          <Video className="text-troll-gold w-8 h-8" />
          Go Live
        </h1>

        <div className="bg-[#0E0A1A] border border-purple-700/40 p-6 rounded-xl text-center">
          🚫 You must be an approved broadcaster.
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------
     RENDER
  ---------------------------------------------------- */
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <BroadcasterApplicationForm
        isOpen={showApplicationForm}
        onClose={() => setShowApplicationForm(false)}
        onSubmitted={() => toast.success('Application submitted')}
      />

      <h1 className="text-3xl font-extrabold flex items-center gap-2">
        <Video className="text-troll-gold w-8 h-8" />
        Go Live
      </h1>

      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>

      <div className="bg-[#0E0A1A] border border-purple-700/40 p-6 rounded-xl space-y-4">
        <input
          value={streamTitle}
          onChange={e => setStreamTitle(e.target.value)}
          placeholder="Stream title"
          className="w-full bg-[#171427] border border-purple-500/40 text-white rounded-lg px-4 py-3"
        />

        <input
          type="file"
          accept="image/*"
          onChange={e =>
            handleThumbnailChange(e.target.files?.[0] || null)
          }
          className="text-xs text-gray-300"
        />

        {thumbnailPreview && (
          <img
            src={thumbnailPreview}
            className="w-full h-40 object-cover rounded-lg"
          />
        )}

        <button
          onClick={handleStartStream}
          disabled={starting}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-bold"
        >
          {starting ? 'Starting…' : 'Go Live'}
        </button>
      </div>
    </div>
  );
};

export default GoLive;
