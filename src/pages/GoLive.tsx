import React, { useEffect, useState, useRef } from "react";
import AgoraRTC, {
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ClickableUsername from "../components/ClickableUsername";

const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

const GoLive: React.FC = () => {
  const { user, profile } = useAuthStore();
  const [isLive, setIsLive] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Just Chatting");
  const [multiBeam, setMultiBeam] = useState(false);
  const [beamBoxes, setBeamBoxes] = useState<{ id: string; userId?: string; username?: string; w: number; h: number }[]>([]);
  const [previewUser, setPreviewUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef<HTMLDivElement>(null);
  const client = useRef(AgoraRTC.createClient({ mode: "live", codec: "vp8" }));
  const localVideoTrack = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    startPreview();
    const stopPreviewSync = () => {
      try {
        localVideoTrack.current?.stop();
        localVideoTrack.current?.close();
        localAudioTrack.current?.close();
      } catch {}
    }
    return stopPreviewSync;
  }, []);

  const startPreview = async () => {
    try {
      // Create video track with optimizations
      localVideoTrack.current = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 1280,
          height: 720,
          frameRate: 30,
          bitrateMin: 600,
          bitrateMax: 1500
        }
      });
      
      // Create audio track with echo cancellation
      localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'high_quality_stereo',
        AEC: true, // Acoustic Echo Cancellation
        ANS: true, // Automatic Noise Suppression
        AGC: true  // Automatic Gain Control
      });
      
      localVideoTrack.current?.play(videoRef.current!);
    } catch (err) {
      console.error(err);
      toast.error("Camera or Mic permission blocked.");
    }
  };

  const stopPreview = async () => {
    localVideoTrack.current?.stop();
    localVideoTrack.current?.close();
    localAudioTrack.current?.close();
  };

  const handleGoLive = async () => {
    if (!APP_ID) return toast.error("Missing Agora App ID.");
    if (!title.trim()) return toast.error("Please enter a stream title.");

    setLoading(true);
    try {
      const base = (profile?.username || "stream").replace(/[^a-z0-9_-]/gi, "").toLowerCase();
      const channelName = `${base}-${Date.now()}`;

      const { data: sessionData } = await supabase.auth.getSession()
      const tokenHeader = sessionData?.session?.access_token || ''
      const resp = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/agora/agora-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tokenHeader ? { Authorization: `Bearer ${tokenHeader}` } : {}) },
        body: JSON.stringify({ channelName, userId: String(profile?.id), role: 'publisher' })
      })
      const j = await resp.json()
      if (!resp.ok || !j?.token) {
        throw new Error(j?.error || 'Failed to get Agora token')
      }

      const token = j.token as string
      client.current.setClientRole('host')
      await client.current.join(APP_ID, channelName, token, String(profile?.id));
      await client.current.publish([
        localVideoTrack.current!,
        localAudioTrack.current!,
      ]);

      const { data: streamRow, error } = await supabase
        .from('streams')
        .insert({
          broadcaster_id: profile!.id,
          title: title.trim(),
          category,
          multi_beam: multiBeam,
          status: 'live',
          agora_channel: channelName,
          agora_token: token
        })
        .select()
        .single()

      if (error) throw error

      setIsLive(true);
      toast.success("You are now LIVE!");
      navigate(`/stream/${streamRow.id}`, { state: { stream: streamRow } });
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Failed to Go Live.'
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0f0f1a] via-[#1a0f2a] to-[#082016] text-white px-6">
      
      <div className="flex flex-col md:flex-row items-center gap-8 w-full max-w-6xl">

        {/* 🎥 Video Preview */}
        <div
          ref={videoRef}
          className="w-[620px] h-[420px] bg-black/70 backdrop-blur-xl rounded-xl border border-purple-500/40 shadow-[0_0_25px_rgba(128,0,128,0.5)] flex items-center justify-center"
        >
          {!localVideoTrack.current && (
            <p className="text-gray-400 animate-pulse">Camera Preview</p>
          )}
          {multiBeam && (
            <div className="absolute inset-0 p-2 grid grid-cols-4 grid-rows-4 gap-1 pointer-events-auto">
              {beamBoxes.map((b, idx) => (
                <div
                  key={b.id}
                  className="relative bg-black/50 border border-purple-600 rounded-lg overflow-hidden"
                  style={{
                    gridColumn: idx === 0 ? 'span 2' : 'span 1',
                    gridRow: idx === 0 ? 'span 2' : 'span 1'
                  }}
                >
                  <button
                    className="absolute top-1 left-1 text-[10px] bg-purple-900/70 px-2 py-1 rounded"
                    onClick={async () => {
                      if (!b.username) return
                      try {
                        const { data } = await supabase
                          .from('user_profiles')
                          .select('*')
                          .eq('username', b.username)
                          .maybeSingle()
                        setPreviewUser(data || null)
                      } catch { setPreviewUser(null) }
                    }}
                  >
                    {b.username || 'Empty'}
                  </button>
                  {b.username && (
                    <button
                      className="absolute top-1 right-1 text-[10px] bg-green-700/70 px-2 py-1 rounded"
                      onClick={async () => {
                        try {
                          const { data } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .eq('id', b.userId)
                            .maybeSingle()
                          setPreviewUser(data || null)
                        } catch { setPreviewUser(null) }
                      }}
                    >
                      View
                    </button>
                  )}
                  <div className="absolute bottom-1 left-1 right-1 flex items-center gap-2 px-2">
                    <input
                      type="range"
                      min={40}
                      max={100}
                      value={b.w}
                      onChange={(e) => setBeamBoxes((prev) => prev.map(x => x.id===b.id?{...x, w: Number(e.target.value)}:x))}
                      className="flex-1"
                    />
                    <input
                      type="range"
                      min={40}
                      max={100}
                      value={b.h}
                      onChange={(e) => setBeamBoxes((prev) => prev.map(x => x.id===b.id?{...x, h: Number(e.target.value)}:x))}
                      className="flex-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ⚙️ Settings Panel */}
        <div className="bg-black/60 backdrop-blur-xl p-6 rounded-xl border border-purple-500/50 shadow-[0_0_30px_rgba(0,255,170,0.4)] w-[350px]">
          
          <h2 className="text-xl font-semibold text-purple-300 mb-4">
            Go Live Settings
          </h2>

          <label className="text-sm">Stream Title</label>
          <input
            type="text"
            className="w-full bg-gray-900 text-white p-2 rounded mb-3 border border-purple-600
            focus:ring-2 focus:ring-green-400"
            placeholder="Enter your stream title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className="text-sm">Category</label>
          <select
            className="w-full bg-gray-900 text-white p-2 rounded mb-5 border border-purple-600
            focus:ring-2 focus:ring-green-400"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>Just Chatting</option>
            <option>Gaming</option>
            <option>Music</option>
            <option>IRL / Vlog</option>
            <option>Smoking</option>
            <option>Drinking</option>
            <option>Partying</option>
            <option>Bored</option>
            <option>Sleep</option>
            <option>Networking</option>
            <option>Flirting Only (No Nudes)</option>
          </select>

          <div className="flex items-center justify-between mb-3">
            <label className="text-sm">Enable Multi Beams (14 boxes)</label>
            <button
              onClick={() => {
                const next = !multiBeam
                setMultiBeam(next)
                if (next && beamBoxes.length === 0) {
                  // Create 14 beam boxes
                  const boxes = Array.from({ length: 14 }, (_, i) => ({
                    id: `b${i + 1}`,
                    w: i === 0 ? 50 : 25, // First box bigger
                    h: i === 0 ? 50 : 25,
                    username: undefined,
                    userId: undefined
                  }))
                  setBeamBoxes(boxes)
                }
              }}
              className={`px-3 py-1 rounded ${multiBeam? 'bg-green-700':'bg-gray-700'} text-white text-xs`}
            >
              {multiBeam ? 'On' : 'Off'}
            </button>
          </div>

          {multiBeam && (
            <div className="space-y-2 mb-4">
              <button
                onClick={() => setBeamBoxes(prev => [...prev, { id: `b${prev.length+1}`, w: 50, h: 50 }])}
                className="w-full py-1 rounded bg-purple-700 text-white text-xs"
              >
                Add Box
              </button>
              <div className="grid grid-cols-2 gap-2">
                {beamBoxes.map(b => (
                  <div key={b.id} className="p-2 bg-[#0D0D0D] rounded border border-purple-700/50">
                    <div className="text-xs mb-1">Box {b.id.toUpperCase()}</div>
                    <input
                      type="text"
                      placeholder="Assign username"
                      className="w-full bg-gray-900 text-white p-1 rounded border border-purple-600 text-xs"
                      value={b.username || ''}
                      onChange={(e) => setBeamBoxes(prev => prev.map(x => x.id===b.id?{...x, username: e.target.value}:x))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🔘 Live Button */}
          <button
            onClick={handleGoLive}
            disabled={loading}
            className={`w-full py-2 rounded-md font-semibold transition-all ${
              loading
                ? "bg-gray-700 cursor-not-allowed"
                : "bg-gradient-to-r from-green-400 to-purple-500 hover:scale-105 shadow-[0_0_15px_rgba(0,255,150,0.5)]"
            }`}
          >
            {loading ? "Starting..." : "Go Live"}
          </button>
        </div>
      </div>

      {previewUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="w-[360px] bg-[#121212] border border-purple-600 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-purple-600">
                <img src={previewUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${previewUser.username}`} className="w-full h-full object-cover" />
              </div>
              <div className="font-semibold">
                <ClickableUsername username={previewUser.username} className="text-white" />
              </div>
              <span className="ml-auto text-xs px-2 py-1 rounded bg-purple-800/60 border border-purple-500">{previewUser.role}</span>
            </div>
            <div className="text-xs text-gray-300 mb-3">{previewUser.bio || 'No bio'}</div>
            <div className="text-xs text-gray-300 mb-2">Perks: {(() => {
              const perks: string[] = []
              try {
                if (localStorage.getItem(`tc-ghost-mode-${previewUser.id}`)) perks.push('Ghost Mode')
                if (localStorage.getItem(`tc-disappear-chat-${previewUser.id}`)) perks.push('Disappearing Chats')
                if (localStorage.getItem(`tc-message-admin-${previewUser.id}`)) perks.push('Message Admin')
              } catch {}
              return perks.length ? perks.join(', ') : 'None'
            })()}</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPreviewUser(null)} className="px-3 py-1 rounded bg-[#2C2C2C] text-white text-xs">Close</button>
              <button onClick={() => navigate(`/profile/${previewUser.username}`)} className="px-3 py-1 rounded bg-purple-600 text-white text-xs">Open Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoLive;
