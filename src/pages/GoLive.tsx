import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Video } from 'lucide-react';
import { Room, createLocalTracks } from 'livekit-client';
import BroadcasterApplicationForm from '../components/BroadcasterApplicationForm';
import { toast } from 'sonner';

const GoLive: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const { user, profile } = useAuthStore.getState();

  const [streamTitle, setStreamTitle] = useState('');
  const [starting, setStarting] = useState(false);
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [permissionHint, setPermissionHint] = useState('Request camera + mic to ready the LiveKit cockpit.');

  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const [broadcasterStatus, setBroadcasterStatus] = useState<{
    isApproved: boolean;
    hasApplication: boolean;
    applicationStatus: string | null;
  } | null>(null);

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
    (broadcasterStatus?.isApproved && broadcasterStatus?.applicationStatus === 'approved');

  useEffect(() => {
    return () => {
      previewStreamRef.current?.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const requestPermissions = useCallback(async () => {
    setPermissionState('requesting');
    setPermissionHint('Requesting camera and microphone access.');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      previewStreamRef.current?.getTracks().forEach(track => track.stop());
      previewStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setPermissionState('granted');
      setPermissionHint('LiveKit ready - camera + mic unlocked.');
    } catch (error) {
      console.error('Permission request failed', error);
      setPermissionState('denied');
      setPermissionHint('Permission denied. Retry to re-enable the preview.');
      previewStreamRef.current?.getTracks().forEach(track => track.stop());
      previewStreamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, []);

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

  const handleStartStream = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in.');
      return;
    }

    if (!isApprovedBroadcaster) {
      toast.error('You are not approved to broadcast.');
      return;
    }

    if (permissionState !== 'granted') {
      toast.error('Unlock camera and microphone first.');
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

      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: streamId,
          identity: user.id,
          user_id: user.id,
          isHost: true,
          allowPublish: true,
        },
      });

      if (error || !data?.token) {
        toast.error('LiveKit token failed.');
        return;
      }

      navigate(`/live/${streamId}`, {
        state: {
          roomName: streamId,
          serverUrl: data.serverUrl || data.livekitUrl || import.meta.env.VITE_LIVEKIT_URL,
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

  const goLiveTest = useCallback(async () => {
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'test-room',
          participantName: `host-${Date.now()}`,
          role: 'admin',
          allowPublish: true,
          level: 1,
        }),
      });

      const data = await res.json();
      const room = new Room();
      await room.connect(import.meta.env.VITE_LIVEKIT_URL, data.token);
      const tracks = await createLocalTracks({ audio: true, video: true });
      await room.localParticipant.publishTrack(tracks[0]);
      await room.localParticipant.publishTrack(tracks[1]);
    } catch (err) {
      console.error('Go Live test failed:', err);
    }
  }, []);

  if (!user || !profile || broadcasterStatus === null) {
    return null;
  }

  if (!isApprovedBroadcaster) {
    return (
      <div className="min-h-screen bg-[#02000a] px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl space-y-6 rounded-[32px] border border-purple-500/40 bg-[#050016] p-8 shadow-[0_0_40px_rgba(62,10,120,0.45)]">
          <div className="flex items-center gap-3">
            <Video className="text-cyan-300 w-9 h-9" />
            <h1 className="text-4xl font-black tracking-tight">Go Live</h1>
          </div>
          <p className="text-sm text-gray-300">
            Stream to Troll City with LiveKit. You currently need an approved broadcaster application to launch a neon RGB show.
          </p>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-900/70 to-transparent p-6 text-center text-lg text-white">
            dYs® You must be an approved broadcaster.
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowApplicationForm(true)}
              className="rounded-full border border-white/30 bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-white transition hover:brightness-110"
            >
              Submit application
            </button>
            <button
              onClick={goLiveTest}
              className="rounded-full border border-white/30 px-6 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-white transition hover:border-cyan-400"
            >
              LiveKit test
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#030008] via-[#040117] to-[#050114] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <BroadcasterApplicationForm
          isOpen={showApplicationForm}
          onClose={() => setShowApplicationForm(false)}
          onSubmitted={() => toast.success('Application submitted')}
        />

        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 p-1">
              <div className="rounded-full bg-black p-2">
                <Video className="text-white w-7 h-7" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white">Go Live</h1>
              <p className="text-sm text-gray-400">
                Your home page neon aesthetic, now elevated with LiveKit and RGB outlines. Request cam + mic permissions, polish your thumbnail, and broadcast to the city.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.4em] text-white/70">
            <span className="rounded-full border border-white/20 px-3 py-1 text-white/80">LiveKit-powered</span>
            <span className="rounded-full border border-white/20 px-3 py-1 text-white/80">Neon RGB outline</span>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative overflow-hidden rounded-[36px] border border-purple-500/40 bg-[#040017] p-6 shadow-[0_0_45px_rgba(44,5,80,0.7)]">
            <div className="absolute inset-0 rounded-[36px] border border-gradient-to-r from-purple-500/40 via-pink-500/30 to-cyan-400/30 pointer-events-none" />
            <div className="relative space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.4em] text-purple-300">Broadcaster cockpit</span>
                <span className="rounded-full border border-white/20 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/70">
                  LiveKit Studio
                </span>
              </div>
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/70 px-1 py-1">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 via-pink-500/20 to-cyan-500/20 blur-3xl shadow-[0_0_60px_rgba(130,46,217,0.6)]" />
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="relative z-10 h-[320px] w-full rounded-[28px] object-cover shadow-[0_20px_60px_rgba(10,0,40,0.7)]"
                />
                <div className="absolute bottom-4 left-4 right-4 z-10 rounded-2xl border border-white/20 bg-black/70 px-4 py-3 text-xs text-white/80 backdrop-blur">
                  {permissionHint}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-white">
                <button
                  onClick={requestPermissions}
                  disabled={permissionState === 'requesting'}
                  className="rounded-full border border-white/30 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {permissionState === 'granted'
                    ? 'Permissions Granted'
                    : permissionState === 'requesting'
                      ? 'Requesting...'
                      : 'Request Camera & Mic'}
                </button>
                <span className="text-[11px] uppercase tracking-[0.35em] text-white/60">
                  {permissionState === 'denied' ? 'Denied - retry' : 'Ready for LiveKit broadcast'}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-900/60 to-transparent p-4 text-sm text-gray-300">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-purple-300">Preview</p>
                  <p className="text-2xl font-bold text-white">LiveKit</p>
                  <p className="text-xs text-white/70">
                    Camera + mic stream locally, then LiveKit mirrors the feed to viewers.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-900/60 to-transparent p-4 text-sm text-gray-300">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Broadcast</p>
                  <p className="text-2xl font-bold text-white">RGB neon</p>
                  <p className="text-xs text-white/70">
                    Outline, glow, and gradient neon overlays match the homepage aesthetic.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6 rounded-[32px] border border-white/10 bg-[#03000b] p-6 shadow-[0_0_40px_rgba(2,10,40,0.45)]">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">Stream details</p>
              <input
                value={streamTitle}
                onChange={e => setStreamTitle(e.target.value)}
                placeholder="Stream title"
                className="w-full rounded-2xl border border-purple-500/30 bg-[#0D0A1F] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-purple-400 focus:outline-none"
              />
              <label className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/60">
                Thumbnail
              </label>
              <div className="rounded-2xl border border-dashed border-white/20 p-4 text-[12px] text-gray-300">
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => handleThumbnailChange(e.target.files?.[0] || null)}
                  className="block w-full cursor-pointer text-[10px] uppercase tracking-[0.3em] text-white"
                />
                <p className="mt-2 text-[11px] text-white/60">
                  1920x1080 recommended. RGB glow automatically applies to the stream cover.
                </p>
                {thumbnailPreview && (
                  <img
                    src={thumbnailPreview}
                    className="mt-3 h-28 w-full rounded-xl object-cover shadow-lg shadow-purple-600/40"
                  />
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-purple-600/30 bg-gradient-to-br from-purple-900/80 to-transparent p-4 text-sm text-gray-100">
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">LiveKit readiness</p>
              <div className="flex items-center justify-between text-white">
                <span>Token status</span>
                <span className="text-xs font-semibold text-green-300">{starting ? 'requested' : 'secure'}</span>
              </div>
              <div className="flex items-center justify-between text-white">
                <span>Approval</span>
                <span className="text-xs font-semibold text-cyan-300">{isApprovedBroadcaster ? 'Approved' : 'Pending'}</span>
              </div>
              <p className="text-[12px] text-white/70">
                When you tap Launch broadcast, LiveKit publishes your camera/mic to every viewer watching Troll City in real time.
              </p>
            </div>

            <button
              onClick={handleStartStream}
              disabled={starting || permissionState !== 'granted'}
              className="w-full rounded-2xl border border-purple-400/50 bg-gradient-to-r from-cyan-400 to-purple-500 px-4 py-3 text-sm font-black uppercase tracking-[0.4em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {permissionState !== 'granted' ? 'Unlock camera + mic first' : starting ? 'Launching live...' : 'Launch broadcast'}
            </button>
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-[#04000e] p-4 text-center text-sm text-gray-300">
            <p className="text-xs uppercase tracking-[0.3em] text-purple-300">LiveKit</p>
            <p className="text-2xl font-bold text-white">Realtime</p>
            <p className="text-[11px] text-white/60">Low-latency delivery to every viewer</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#04000e] p-4 text-center text-sm text-gray-300">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Neon outline</p>
            <p className="text-2xl font-bold text-white">RGB glow</p>
            <p className="text-[11px] text-white/60">Matches the new home page design</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#04000e] p-4 text-center text-sm text-gray-300">
            <p className="text-xs uppercase tracking-[0.3em] text-pink-300">Preview</p>
            <p className="text-2xl font-bold text-white">Cam + Mic</p>
            <p className="text-[11px] text-white/60">Request permissions before broadcast</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoLive;
