import React, { useEffect, useState, useRef } from "react";
import { Room, createLocalTracks, RoomEvent } from "livekit-client";
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
  const [room, setRoom] = useState<Room | null>(null);
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Just Chatting");
  const [multiBeam, setMultiBeam] = useState(false);
  const [beamBoxes, setBeamBoxes] = useState<
    { id: string; userId?: string; username?: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const previewRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  // 🎥 Show preview BEFORE going live (without LiveKit)
  useEffect(() => {
    if (!user) return;
    startPreview();
    return () => stopPreview();
  }, [user]);

  // 👋 Clean LiveKit + Supabase when closing tab or ending stream
  useEffect(() => {
    const cleanup = async () => {
      if (room) {
        room.disconnect();
        setRoom(null);
      }
      if (currentStreamId) {
        await supabase
          .from("streams")
          .update({
            is_live: false,
            ended_at: new Date().toISOString(),
          })
          .eq("id", currentStreamId);
      }
    };

    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, [currentStreamId, room]);

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
      }
    } catch {
      toast.error("Camera/Mic blocked.");
    }
  };

  const stopPreview = () => {
    const mediaStream = previewRef.current?.srcObject as MediaStream;
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      previewRef.current!.srcObject = null;
    }
  };

  const handleEndStream = async () => {
    if (room) {
      room.disconnect();
      setRoom(null);
    }
    setIsLive(false);
    stopPreview();
    if (currentStreamId) {
      await supabase
        .from("streams")
        .update({
          is_live: false,
          ended_at: new Date().toISOString(),
        })
        .eq("id", currentStreamId);
    }
    setCurrentStreamId(null);
  };

  const handleGoLive = async () => {
    // Use token endpoint to retrieve URL; LIVEKIT_URL is optional
    if (!title.trim()) return toast.error("Enter a stream title.");
    if (!profile?.id) return toast.error("Profile not loaded.");

    setLoading(true);
    stopPreview(); // 👈 stop preview before starting LiveKit

    try {
      const roomName = `${profile.username}-${Date.now()}`.toLowerCase();
      const tokenPath = LIVEKIT_TOKEN_ENDPOINT || API_ENDPOINTS.livekit.token;
      const resp = await api.get(tokenPath, { room: roomName, identity: profile.username });
      if (!resp.success) throw new Error(resp?.error || 'Token fetch failed');
      const { token, url } = resp;

      const newRoom = new Room({ adaptiveStream: true });
      await newRoom.connect(url, token);

      const tracks = await createLocalTracks({ audio: true, video: true });
      tracks.forEach((track) => {
        newRoom.localParticipant.publishTrack(track);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log("LiveKit disconnected");
      });

      // 🧹 Clear previous video elements
      const videoContainer = document.getElementById("live-video-container");
      if (videoContainer) videoContainer.innerHTML = "";

      // 🎯 Attach LiveKit video track
      newRoom.localParticipant.trackPublications.forEach((publication) => {
        if (publication.kind === "video") {
          const element = publication.track?.attach();
          if (element && videoContainer) {
            element.style.width = "100%";
            element.style.height = "100%";
            element.style.objectFit = "cover";
            videoContainer.appendChild(element);
          }
        }
      });

      // 📦 Save Live stream in Supabase (standard troll_streams schema)
      const { data: streamRow, error: insertError } = await supabase
        .from("streams")
        .insert({
          broadcaster_id: profile.id,
          title,
          category,
          current_viewers: 1,
          is_live: true,
          start_time: new Date().toISOString(),
          room_name: roomName,
          livekit_url: url,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setCurrentStreamId(streamRow.id);
      setRoom(newRoom);
      setIsLive(true);
      toast.success("🎉 You are LIVE!");

      navigate(`/stream/${streamRow.id}`, { state: { stream: streamRow } });
    } catch (err: any) {
      toast.error(err?.message || "Failed to Go Live");
      console.error(err);
      startPreview(); // fallback to preview
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0f0f1a] via-[#1a0f2a] to-[#082016] text-white px-6">
      <div className="flex flex-col md:flex-row items-center gap-8 w-full max-w-6xl">

        {/* 🎥 VIDEO PREVIEW / LIVE FEED */}
        <div className="relative w-[620px] h-[420px] bg-black/70 rounded-xl border border-purple-500/40 shadow-[0_0_25px_rgba(128,0,128,0.5)] overflow-hidden">
          {!isLive ? (
            <video
              ref={previewRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          ) : (
            <div
              id="live-video-container"
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
              }}
            />
          )}
        </div>

        {/* ⚙️ SETTINGS PANEL */}
        <div className="bg-black/60 p-6 rounded-xl border border-purple-500/50 shadow-[0_0_30px_rgba(0,255,170,0.4)] w-[350px]">
          <h2 className="text-xl font-semibold text-purple-300 mb-4">
            Go Live Settings
          </h2>

          {!isLive ? (
            <>
              <input
                className="w-full bg-gray-900 text-white p-2 rounded mb-3 border border-purple-600"
                placeholder="Enter stream title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <select
                className="w-full bg-gray-900 text-white p-2 rounded mb-5 border border-purple-600"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>Just Chatting</option>
                <option>Gaming</option>
                <option>Music</option>
                <option>Flirting Only</option>
                <option>Networking</option>
              </select>

              <button
                onClick={handleGoLive}
                disabled={loading}
                className="w-full py-2 rounded-md font-semibold bg-gradient-to-r from-green-400 to-purple-500"
              >
                {loading ? "Starting..." : "Go Live"}
              </button>
            </>
          ) : (
            <button
              onClick={handleEndStream}
              className="w-full py-2 bg-red-600 rounded-md font-semibold"
            >
              End Live
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoLive;
