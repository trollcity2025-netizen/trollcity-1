import React, { useEffect, useState, useRef } from "react";
import { Room, createLocalVideoTrack, createLocalAudioTrack } from "livekit-client";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api, { API_ENDPOINTS } from "../lib/api";
import ClickableUsername from "../components/ClickableUsername";

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL;
const LIVEKIT_TOKEN_ENDPOINT = import.meta.env.VITE_LIVEKIT_TOKEN_ENDPOINT;

console.log("🟢 LiveKit URL:", LIVEKIT_URL);
console.log("🟢 LiveKit Token Endpoint:", LIVEKIT_TOKEN_ENDPOINT);

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
  console.log("LiveKit URL:", import.meta.env.VITE_LIVEKIT_URL);
  const room = useRef<Room | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    startPreview();
    return () => {
      if (room.current) {
        room.current.disconnect();
      }
    };
  }, [user]);

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast.error("Camera/Mic blocked.");
    }
  };

  const handleGoLive = async () => {
    console.log("LiveKit URL:", import.meta.env.VITE_LIVEKIT_URL);
    if (!LIVEKIT_URL) return toast.error("Missing LiveKit URL.");
    if (!title.trim()) return toast.error("Enter a stream title.");
    if (!profile?.id) return toast.error("Profile not loaded.");

    setLoading(true);
    try {
      // Build unique room name
      const roomName = `${profile.username}-${Date.now()}`.toLowerCase();

      // CALL LIVEKIT TOKEN API
      console.log("Calling LiveKit Token API:", `${LIVEKIT_TOKEN_ENDPOINT}?room=${roomName}&identity=${profile.username}`);

      const session = await supabase.auth.getSession();

      const response = await fetch(
        `${LIVEKIT_TOKEN_ENDPOINT}?room=${roomName}&identity=${profile.username}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${
              session?.data.session?.access_token ??
              import.meta.env.VITE_SUPABASE_ANON_KEY
            }`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${await response.text()}`);
      }

      const { token, url } = await response.json();

      console.log("🔐 Final Stream Connect Values:", {
        url,
        token: token?.slice(0, 25) + "...",
        identity: profile.username,
        roomName,
      });

      // Create LiveKit room
      room.current = new Room({ adaptiveStream: true });
      await room.current.connect(url, token);

      // Get local tracks
      const localVideoTrack = await createLocalVideoTrack();
      const localAudioTrack = await createLocalAudioTrack();

      // Publish tracks
      await room.current.localParticipant.publishTrack(localVideoTrack);
      await room.current.localParticipant.publishTrack(localAudioTrack);

      // Save stream session in Supabase
      const { data: streamRow, error: insertError } = await supabase
        .from("streams")
        .insert({
          broadcaster_id: profile.id,
          title: title.trim(),
          category,
          multi_beam: multiBeam,
          status: "live",
          livekit_room: roomName,
          livekit_token: token,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setIsLive(true);
      toast.success("🎉 You are LIVE!");
      navigate(`/stream/${streamRow.id}`, { state: { stream: streamRow } });

    } catch (err: any) {
      toast.error(err?.message || "Failed to Go Live");
      console.error("GoLive Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0f0f1a] via-[#1a0f2a] to-[#082016] text-white px-6">
      <div className="flex flex-col md:flex-row items-center gap-8 w-full max-w-6xl">

        {/* 🎥 VIDEO PREVIEW */}
        <div className="relative w-[620px] h-[420px] bg-black/70 rounded-xl border border-purple-500/40 shadow-[0_0_25px_rgba(128,0,128,0.5)] overflow-hidden">
          {multiBeam ? (
            <div className="grid grid-cols-4 grid-rows-4 gap-1 w-full h-full p-1">
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
