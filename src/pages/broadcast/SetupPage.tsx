import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Video, Mic, MicOff, VideoOff, Settings } from 'lucide-react';
import { toast } from 'sonner';

export default function SetupPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  
  // Media state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  useEffect(() => {
    // Request camera access on mount
    async function getMedia() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.warn("Error accessing media devices, trying audio only.", err);
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
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
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
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
      // Create stream record
      const { data, error } = await supabase
        .from('streams')
        .insert({
          user_id: user.id,
          title,
          category,
          status: 'live',
          is_live: true,
          started_at: new Date().toISOString(),
          box_count: 1, // Default to just host
          layout_mode: 'grid'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Stream created! Going live...');
      navigate(`/broadcast/${data.id}`);
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
      </div>
    </div>
  );
}
