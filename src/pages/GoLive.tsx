import React, { useEffect, useState, useRef } from "react";
import AgoraRTC, {
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api, { API_ENDPOINTS } from "../lib/api";
import ClickableUsername from "../components/ClickableUsername";

const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

const GoLive: React.FC = () => {
  const { user, profile } = useAuthStore();
  const [isLive, setIsLive] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Just Chatting");
  const [multiBeam, setMultiBeam] = useState(false);
  const [beamBoxes, setBeamBoxes] = useState<
    { id: string; userId?: string; username?: string }[]
  >([]);
  const [previewUser, setPreviewUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const client = useRef(AgoraRTC.createClient({ mode: "live", codec: "vp8" }));
  const localVideoTrack = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    startPreview();
    return () => {
      localVideoTrack.current?.stop();
      localVideoTrack.current?.close();
      localAudioTrack.current?.close();
    };
  }, []);

  const startPreview = async () => {
    try {
      localVideoTrack.current = await AgoraRTC.createCameraVideoTrack();
      localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack();

      if (videoRef.current) {
        localVideoTrack.current.play(videoRef.current, { fit: "contain" });
      }
    } catch {
      toast.error("Camera/Mic blocked.");
    }
  };

  const handleGoLive = async () => {
    if (!APP_ID) return toast.error("Missing Agora App ID.");
    if (!title.trim()) return toast.error("Enter a stream title.");

    setLoading(true);
    try {
      const base = (profile?.username || "stream")
        .replace(/[^a-z0-9_-]/gi, "")
        .toLowerCase();
      const channelName = `${base}-${Date.now()}`;

      const tokenRes = await api.post(API_ENDPOINTS.agora.token, {
        channelName,
        userId: String(profile?.id),
        role: "publisher",
      });

      if (!tokenRes?.success || !tokenRes?.token) {
        throw new Error(tokenRes?.error || "Failed to get Agora token");
      }

      const token = tokenRes.token as string;
      client.current.setClientRole("host");
      await client.current.join(APP_ID, channelName, token, String(profile?.id));
      await client.current.publish([
        localVideoTrack.current!,
        localAudioTrack.current!,
      ]);

      const { data: streamRow, error } = await supabase
        .from("streams")
        .insert({
          broadcaster_id: profile!.id,
          title: title.trim(),
          category,
          multi_beam: multiBeam,
          status: "live",
          agora_channel: channelName,
          agora_token: token,
        })
        .select()
        .single();

      if (error) throw error;

      setIsLive(true);
      toast.success("You are LIVE!");
      navigate(`/stream/${streamRow.id}`, { state: { stream: streamRow } });
    } catch (err: any) {
      toast.error(err?.message || "Failed to Go Live");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0f0f1a] via-[#1a0f2a] to-[#082016] text-white px-6">
      <div className="flex flex-col md:flex-row items-center gap-8 w-full max-w-6xl">
        
        {/* 🎥 VIDEO PREVIEW */}
        <div
          className="relative w-[620px] h-[420px] bg-black/70 rounded-xl border border-purple-500/40 shadow-[0_0_25px_rgba(128,0,128,0.5)] overflow-hidden"
        >
          {multiBeam ? (
            // 🟢 MULTI-BEAM GRID
            <div className="grid grid-cols-4 grid-rows-4 gap-1 w-full h-full p-1">
              {/* Seat 1 – Host Camera */}
              <div className="col-span-2 row-span-2 bg-black/80 rounded-lg border border-green-400 overflow-hidden relative flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                <span className="absolute bottom-1 left-2 text-[10px] bg-green-600/70 px-2 py-1 rounded">
                  You (Host)
                </span>
              </div>

              {/* Other seats */}
              {beamBoxes.slice(1).map((b) => (
                <div
                  key={b.id}
                  className="bg-black/50 border border-purple-600 rounded-lg flex items-center justify-center text-gray-400 text-xs"
                >
                  {b.username || "+"}
                </div>
              ))}
            </div>
          ) : (
            // 🔵 SOLO MODE – FULL PREVIEW
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* ⚙️ SETTINGS PANEL */}
        <div className="bg-black/60 backdrop-blur-xl p-6 rounded-xl border border-purple-500/50 shadow-[0_0_30px_rgba(0,255,170,0.4)] w-[350px]">
          <h2 className="text-xl font-semibold text-purple-300 mb-4">
            Go Live Settings
          </h2>
          <label className="text-sm">Stream Title</label>
          <input
            className="w-full bg-gray-900 text-white p-2 rounded mb-3 border border-purple-600"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="text-sm">Category</label>
          <select
            className="w-full bg-gray-900 text-white p-2 rounded mb-5 border border-purple-600"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>Just Chatting</option>
            <option>Gaming</option>
            <option>Music</option>
            <option>IRL / Vlog</option>
            <option>Networking</option>
            <option>Flirting Only (No Nudes)</option>
          </select>

          <div className="flex items-center justify-between mb-3">
            <label className="text-sm">Enable Multi Beams (14 seats)</label>
            <button
              onClick={() => {
                const next = !multiBeam;
                setMultiBeam(next);
                if (next && beamBoxes.length === 0) {
                  setBeamBoxes(Array.from({ length: 14 }, (_, i) => ({ id: `b${i + 1}` })));
                }
              }}
              className={`px-3 py-1 rounded ${multiBeam ? "bg-green-700" : "bg-gray-700"} text-white text-xs`}
            >
              {multiBeam ? "On" : "Off"}
            </button>
          </div>

          <button
            onClick={handleGoLive}
            disabled={loading}
            className="w-full py-2 rounded-md font-semibold bg-gradient-to-r from-green-400 to-purple-500"
          >
            {loading ? "Starting..." : "Go Live"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoLive;
