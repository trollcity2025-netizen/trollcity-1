import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Video, Mic, MicOff, VideoOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function SetupPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  const [restrictionCheck, setRestrictionCheck] = useState<{ allowed: boolean; waitTime?: string; reason?: string; message?: string } | null>(null);

  useEffect(() => {
    async function checkRestriction() {
      if (!user) return;

      console.log('[SetupPage] Checking restrictions for user:', user.id);

      // 1. Check Driver's License Status (Source: user_profiles)
    // We strictly enforce this for ALL users, including Admins.
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('created_at, bypass_broadcast_restriction')
      .eq('id', user.id)
      .single();

    if (profileError) console.error('[SetupPage] Profile fetch error:', profileError);

      // Check Bypass (Admins/VIPs) - Only bypasses account age, NOT license
      if (profile?.bypass_broadcast_restriction) {
        setRestrictionCheck({ allowed: true });
        return;
      }


      if (profile?.created_at) {
        const created = new Date(profile.created_at);
        const now = new Date();
        const diff = now.getTime() - created.getTime();
        const hours24 = 24 * 60 * 60 * 1000;

        if (diff < hours24) {
          const remaining = hours24 - diff;
          const hours = Math.floor(remaining / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          setRestrictionCheck({ 
            allowed: false, 
            waitTime: `${hours}h ${minutes}m` 
          });
        } else {
          setRestrictionCheck({ allowed: true });
        }
      } else {
         // Fallback if no profile or created_at (shouldn't happen usually)
         setRestrictionCheck({ allowed: true });
      }
    }

    checkRestriction();
  }, [user]);

  // Media state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  useEffect(() => {
    let localStream: MediaStream | null = null;

    // Request camera access on mount
    async function getMedia() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        localStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.warn("Error accessing media devices, trying audio only.", err);
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            localStream = audioStream;
            setStream(audioStream);
            setIsVideoEnabled(false);
            toast.warning("Camera not found. Audio only mode.");
        } catch (audioErr) {
            console.error("No media devices found.", audioErr);
            toast.error("Could not access microphone either.");
        }
      }
    }
    getMedia();

    return () => {
      // Cleanup stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => track.enabled = !isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => track.enabled = !isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const handleStartStream = async () => {
    if (!title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      // Create stream record with HLS URL pre-populated
      // Note: We use the ID returned by insert, so we do this in two steps or use client-generated ID.
      // Since we rely on Supabase ID generation usually, we insert first then update, OR we assume a pattern.
      // But actually, we can't know the ID before insert unless we generate it. 
      // Supabase insert returns the data. So we can update immediately after.
      
      const { data, error } = await supabase
          .from('streams')
          .insert({
            user_id: user.id,
            broadcaster_id: user.id,
            title,
            category,
            status: 'pending', // Start as pending
            box_count: 1,
            layout_mode: 'grid'
          })
          .select()
          .single();

        if (error) throw error;

        const streamId = data.id;

        // A) On “Start Stream / Go Live” — persist playback id immediately
        // Invoke the edge function. Some environments return a wrapper `{ data }`
        // and the Mux response can contain either `playback_id` or `playback_ids[0].id`.
        const muxRes: any = await supabase.functions.invoke('mux-create', {
          method: 'POST',
          body: JSON.stringify({ stream_id: streamId }),
        });

        if (muxRes.error) throw new Error(muxRes.error.message);

        const muxData = muxRes?.data || muxRes;
        const playbackId = muxData?.playback_id || null;
        if (!playbackId) throw new Error('mux-create did not return playback_id');

        // IMPORTANT: update the SAME stream row
        const { error: updErr } = await supabase
          .from('streams')
          .update({
            mux_playback_id: playbackId,
            mux_live_stream_id: muxData.stream_id || muxData.id || null,
            mux_stream_key: muxData.stream_key || null,
            mux_rtmp_url: muxData.rtmp_url || null, // Add rtmp_url
            status: 'live',
            started_at: new Date().toISOString(),
          })
          .eq('id', streamId);

        if (updErr) {
          console.error("Client-side update failed. This is likely an RLS issue.", updErr);
          throw updErr;
        }

        toast.success('Stream created! Going live...');
        navigate(`/broadcast/${streamId}`);
    } catch (err: any) {
      console.error('Error creating stream:', err);
      toast.error(err.message || 'Failed to start stream');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Preview Section */}
        <div className="space-y-4">
          <div className="aspect-video bg-black rounded-2xl overflow-hidden relative border border-white/10 shadow-2xl">
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover transform scale-x-[-1]" 
            />

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
              <button 
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <button 
                onClick={toggleAudio}
                className={`p-3 rounded-full transition-colors ${isAudioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
            </div>
          </div>
          <p className="text-center text-sm text-gray-400">
            Check your camera and microphone before going live
          </p>
        </div>

        {/* Form Section */}
        {restrictionCheck && !restrictionCheck.allowed ? (
            <div className="space-y-6 bg-slate-900/50 p-8 rounded-3xl border border-red-500/30 shadow-xl text-center flex flex-col justify-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                  <>
                    <h2 className="text-2xl font-bold text-white mb-2">Account in Cooldown</h2>
                    <p className="text-gray-400 mb-6">
                      New accounts must wait 24 hours before starting a broadcast to ensure community safety.
                    </p>
                    <div className="bg-slate-950 rounded-lg p-4 border border-white/5 inline-block mx-auto">
                      <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Time Remaining</div>
                      <div className="text-2xl font-mono text-red-400 font-bold">{restrictionCheck.waitTime}</div>
                    </div>
                  </>

                <button 
                  onClick={() => navigate('/')}
                  className="mt-4 w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-gray-300 hover:text-white"
                >
                  Return to Home
                </button>
            </div>
        ) : (
        <div className="space-y-6 bg-slate-900/50 p-8 rounded-3xl border border-white/5 shadow-xl">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">Go Live</h1>
            <p className="text-gray-400">Set up your broadcast details</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Stream Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Late Night Chill & Trolling"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all placeholder:text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all text-gray-300"
              >
                <option value="general">General Chat</option>
                <option value="gaming">Gaming</option>
                <option value="music">Music</option>
                <option value="debate">Debate / Battle</option>
              </select>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleStartStream}
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600 hover:from-yellow-500 hover:via-yellow-400 hover:to-yellow-500 text-black font-bold py-4 rounded-xl shadow-lg shadow-yellow-500/20 transform transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>Starting...</>
              ) : (
                <>
                  <Video size={20} />
                  START BROADCAST
                </>
              )}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}