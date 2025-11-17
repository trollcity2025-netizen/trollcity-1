import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { getCurrentUserProfile } from "@/api/supabaseHelpers";
import ChatBox from "@/components/stream/ChatBox";
import AgoraRTC from "agora-rtc-sdk-ng";
import { getAgoraToken } from "@/utils/agora";
import EntranceEffect from "@/components/stream/EntranceEffect";
import GiftBox from "@/components/stream/GiftBox";
import LikeButton from "@/components/stream/LikeButton";
import StreamerStatsPanel from "@/components/stream/StreamerStatsPanel";
import GiftAnimation from "@/components/stream/GiftAnimationDisplay";
import { X } from "lucide-react";
import { toast } from "sonner";

const StreamViewer = ({
  appId,
  channelName,
  token,
  uid,
  isStreamer,
  stream,
  isApprovedCoHost,
}) => {
  const navigate = useNavigate();
  const agoraClientRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });
  const remoteUsersRef = useRef({});
  const videoContainerRef = useRef(null);
  const shownEntrancesRef = useRef(new Set());
  const joinSentRef = useRef(false);
  const [entranceUser, setEntranceUser] = useState(null);
  const [viewerToken, setViewerToken] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [derivedAppId, setDerivedAppId] = useState(null);
  const [incomingGifts, setIncomingGifts] = useState([]);

  // Derive streamId from query params when routed via pages like Home/AdminLiveControl
  const searchParams = new URLSearchParams(window.location.search);
  const queryStreamId = searchParams.get("id") || searchParams.get("streamId");

  // Fetch current user (viewer)
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUserProfile,
    retry: false,
    staleTime: 10000,
  });

  // Fetch stream details if not provided via props
  const { data: fetchedStream } = useQuery({
    queryKey: ["streamByIdOrStreamer", queryStreamId],
    queryFn: async () => {
      if (!queryStreamId) return null;
      // First try by stream id
      let rows = await supabase.entities.Stream.filter({ id: queryStreamId }, undefined, 1);
      let found = rows?.[0] || null;
      if (found) return found;
      // Fallback: some links may pass streamer_id instead of stream.id
      rows = await supabase.entities.Stream.filter({ streamer_id: queryStreamId }, "-created_at", 1);
      return rows?.[0] || null;
    },
    enabled: !!queryStreamId,
    initialData: null,
    staleTime: 3000,
    refetchInterval: 5000,
  });

  const effectiveStream = stream || fetchedStream;
  const isUserStreamer = !!(currentUser && effectiveStream && currentUser.id === effectiveStream.streamer_id);
  const effectiveIsStreamer = !!(isStreamer || isUserStreamer);

  // Compute moderation capability for viewer
  const canModerate = !!(
    (currentUser?.user_role === "admin" || currentUser?.role === "admin") ||
    currentUser?.is_troll_officer ||
    currentUser?.permissions?.includes("moderate_chat") ||
    currentUser?.permissions?.includes("kick_users") ||
    currentUser?.permissions?.includes("ban_users") ||
    isUserStreamer
  );

  // Derive effective Agora credentials from props, stream row, or env
  const effectiveAppId = appId || derivedAppId || import.meta.env.VITE_AGORA_APP_ID;
  const effectiveChannelName = channelName || effectiveStream?.agora_channel_name || effectiveStream?.agora_channel_name || effectiveStream?.agora_channel;
  const effectiveToken = token || effectiveStream?.agora_token;
  useEffect(() => {
    setViewerToken(effectiveToken || null);
  }, [effectiveToken]);
  const effectiveUid = uid || currentUser?.id || 0;

  // Initialize Agora client
  const initAgoraClient = async () => {
    if (!effectiveAppId || !effectiveChannelName) {
      console.warn("[Agora] Missing credentials:", { effectiveAppId, effectiveChannelName });
      return;
    }

    setConnecting(true);

    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    agoraClientRef.current = client;

    // Handle remote users joining
    client.on("user-published", async (remoteUser, mediaType) => {
      console.log("[Agora] user-published:", remoteUser.uid, mediaType);

      // 🧠 Guard: only subscribe when connected
      if (!client || client.connectionState !== "CONNECTED") {
        console.warn(
          "⚠️ Skipping subscribe — invalid connection state:",
          client.connectionState
        );
        return;
      }

      try {
        await client.subscribe(remoteUser, mediaType);
        console.log("[Agora] subscribed to user:", remoteUser.uid);

        if (mediaType === "video") {
          const remoteContainer = document.createElement("div");
          remoteContainer.id = `remote-${remoteUser.uid}`;
          remoteContainer.style.cssText = `
            width: 100%;
            height: 100%;
            min-height: 200px;
            background: #000;
            border-radius: 8px;
            overflow: hidden;
            position: relative;
          `;
          videoContainerRef.current.appendChild(remoteContainer);
          remoteUser.videoTrack.play(remoteContainer);
        }

        if (mediaType === "audio" && remoteUser.audioTrack) {
          remoteUser.audioTrack.play();
        }

        remoteUsersRef.current[remoteUser.uid] = remoteUser;
      } catch (error) {
        console.error("❌ Failed to subscribe:", error);
      }
    });

    // Handle remote users leaving
    client.on("user-unpublished", (remoteUser) => {
      console.log("[Agora] user-unpublished:", remoteUser.uid);
      const remoteContainer = document.getElementById(`remote-${remoteUser.uid}`);
      if (remoteContainer) remoteContainer.remove();
      delete remoteUsersRef.current[remoteUser.uid];
    });

    client.on("connection-state-change", (curState, prevState) => {
      console.log(`[Agora] Connection state changed: ${prevState} -> ${curState}`);
    });

    // Join the channel
    try {
      let tokenToUse = viewerToken;
      let appIdToUse = effectiveAppId;
      if (!tokenToUse) {
        try {
          const tokenData = await getAgoraToken(effectiveChannelName, effectiveUid);
          tokenToUse = tokenData?.token ?? tokenData?.rtcToken ?? tokenData?.data?.token ?? null;
          appIdToUse = appIdToUse || tokenData?.appId || tokenData?.agoraAppId || tokenData?.data?.appId || null;
          if (tokenToUse) setViewerToken(tokenToUse);
          if (appIdToUse) setDerivedAppId(appIdToUse);
        } catch (tErr) {
          console.warn("[Agora] Initial token fetch failed:", tErr);
        }
      }

      if (!appIdToUse) {
        console.warn("[Agora] Missing App ID — set VITE_AGORA_APP_ID or return 'appId' from token API.");
        setConnecting(false);
        return;
      }

      await client.join(appIdToUse, effectiveChannelName, tokenToUse, effectiveUid);
      console.log("[Agora] Joined channel:", effectiveChannelName);
      setConnecting(false);

      // Streamer or Co-host publishes local tracks
      if (isStreamer || isApprovedCoHost) {
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localTracksRef.current = { audio: audioTrack, video: videoTrack };
        await client.publish(Object.values(localTracksRef.current));
        
        // Create dedicated local video container
        const localContainer = document.createElement("div");
        localContainer.id = `local-streamer`;
        localContainer.style.cssText = `
          width: 100%;
          height: 100%;
          min-height: 200px;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          grid-column: 1 / -1;
        `;
        videoContainerRef.current.appendChild(localContainer);
        videoTrack.play(localContainer);
        console.log("[Agora] Local tracks published");
      }
    } catch (error) {
      console.error("[Agora] Join error:", error);
      const msg = String(error?.message || "").toUpperCase();
      const code = Number(error?.code);
      const isTokenExpired = msg.includes("DYNAMIC_KEY_EXPIRED") || msg.includes("TOKEN_EXPIRED") || code === 109;
      if (isTokenExpired) {
        console.warn("[Agora] Token expired, attempting to refresh token...");
        try {
          const tokenData = await getAgoraToken(effectiveChannelName, effectiveUid);
          const newToken = tokenData?.token ?? tokenData?.rtcToken ?? tokenData?.data?.token ?? null;
          const newAppId = tokenData?.appId || tokenData?.agoraAppId || tokenData?.data?.appId || effectiveAppId;
          if (!newToken) {
            console.warn("[Agora] No token returned from fallback token fetch.");
          } else {
            setViewerToken(newToken);
            if (newAppId) setDerivedAppId(newAppId);
            await client.join(newAppId, effectiveChannelName, newToken, effectiveUid);
            console.log("[Agora] Re-joined channel after token refresh:", effectiveChannelName);
            if (isStreamer || isApprovedCoHost) {
              const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
              localTracksRef.current = { audio: audioTrack, video: videoTrack };
              await client.publish(Object.values(localTracksRef.current));
              videoTrack.play(videoContainerRef.current);
              console.log("[Agora] Local tracks published (after refresh)");
            }
            setConnecting(false);
          }
        } catch (refreshErr) {
          console.error("[Agora] Token refresh failed:", refreshErr);
        }
      }
      setConnecting(false);
    }
  };

  // Clean up Agora
  const cleanupAgora = async () => {
    const client = agoraClientRef.current;
    if (client) {
      try {
        console.log("[Agora] Cleaning up Agora client...");
        client.removeAllListeners();
        Object.values(remoteUsersRef.current).forEach((user) => {
          const el = document.getElementById(`remote-${user.uid}`);
          if (el) el.remove();
        });
        remoteUsersRef.current = {};

        const { audio, video } = localTracksRef.current;
        if (audio) audio.close();
        if (video) video.close();
        localTracksRef.current = {};

        await client.leave();
        console.log("[Agora] Left the channel cleanly");
      } catch (e) {
        console.error("Leave error:", e);
      } finally {
        agoraClientRef.current = null;
      }
    }
  };

  // Effect to handle connection
  // Normalize live status across boolean/string/number forms
  const normalizedIsLive = (
    effectiveStream?.is_live === true ||
    effectiveStream?.is_live === "true" ||
    effectiveStream?.is_live === 1 ||
    effectiveStream?.status === "live"
  );

  // Check whether the current user is banned from this stream by the streamer
  const { data: myStreamBan } = useQuery({
    queryKey: ["myStreamBan", effectiveStream?.id, currentUser?.id],
    queryFn: async () => {
      if (!effectiveStream?.streamer_id || !currentUser?.id) return null;
      const { data, error } = await supabase
        .from('user_stream_bans')
        .select('*')
        .eq('streamer_id', effectiveStream.streamer_id)
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .limit(1)
        .single();
      if (error) {
        // ignore not-found errors
        return null;
      }
      return data || null;
    },
    enabled: !!effectiveStream?.streamer_id && !!currentUser?.id,
    refetchInterval: 5000,
  });

  const isBannedFromThisStream = !!myStreamBan;

  useEffect(() => {
    const shouldAttemptJoin = !effectiveIsStreamer && (
      normalizedIsLive || !!effectiveChannelName
    ) && !!effectiveAppId;

    if (shouldAttemptJoin) {
      if (isBannedFromThisStream) {
        console.warn('[StreamViewer] User is banned from this stream, blocking join');
        return; // Do not attempt to join
      }

      const timer = setTimeout(() => {
        initAgoraClient();
      }, 1000);

      return () => {
        clearTimeout(timer);
        cleanupAgora();
      };
    }
  }, [normalizedIsLive, effectiveStream?.status, effectiveIsStreamer, effectiveAppId, effectiveChannelName, viewerToken]);

  // Emit a join chat message when a viewer enters the stream (once per session)
  useEffect(() => {
    const sendJoinMessage = async () => {
      try {
        if (!effectiveStream?.id || !currentUser?.id) return;
        if (effectiveIsStreamer) return; // streamer should not emit viewer join
        if (joinSentRef.current) return;

        await supabase.entities.ChatMessage.create({
          stream_id: effectiveStream.id,
          user_id: currentUser.id,
          username: currentUser.username || currentUser.full_name,
          message_type: "join",
        });
        joinSentRef.current = true;
        console.log("👋 Sent join message for viewer:", currentUser.username || currentUser.full_name);
      } catch (e) {
        console.warn("Failed to send join message:", e?.message || e);
      }
    };

    sendJoinMessage();
  }, [effectiveStream?.id, currentUser?.id, effectiveIsStreamer]);

  // Update viewer heartbeat to track activity for enhanced monitoring
  useEffect(() => {
    if (!effectiveStream?.id || !currentUser?.id || effectiveIsStreamer) return;

    const updateHeartbeat = async () => {
      try {
        // Insert or update viewer heartbeat
        await supabase
          .from('stream_viewers')
          .upsert({
            stream_id: effectiveStream.id,
            user_id: currentUser.id,
            last_heartbeat: new Date().toISOString()
          }, {
            onConflict: 'stream_id,user_id'
          });
      } catch (error) {
        console.warn('Failed to update heartbeat:', error);
      }
    };

    // Update heartbeat immediately and then every 25 seconds
    updateHeartbeat();
    const heartbeatInterval = setInterval(updateHeartbeat, 25000);

    return () => clearInterval(heartbeatInterval);
  }, [effectiveStream?.id, currentUser?.id, effectiveIsStreamer]);

  // Handle leave stream
  const handleLeaveStream = () => {
    // Leave the Agora channel
    if (agoraClientRef.current) {
      agoraClientRef.current.leave();
      agoraClientRef.current = null;
    }
    
    // Stop local tracks
    if (localTracksRef.current) {
      Object.values(localTracksRef.current).forEach(track => {
        if (track) {
          track.stop();
          track.close();
        }
      });
      localTracksRef.current = { audio: null, video: null };
    }
    
    // Stop remote video tracks
    Object.values(remoteUsersRef.current).forEach(user => {
      if (user.videoTrack) {
        user.videoTrack.stop();
      }
      if (user.audioTrack) {
        user.audioTrack.stop();
      }
    });
    remoteUsersRef.current = {};
    
    // Clear video container
    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = '';
    }
    
    // Navigate home
    navigate('/');
  };

  // Fetch chat messages to detect join events and show entrance effects on viewer side
  const { data: chatMessages = [] } = useQuery({
    queryKey: ["viewerStreamChat", effectiveStream?.id],
    queryFn: async () => {
      if (!effectiveStream?.id) return [];
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("stream_id", effectiveStream.id)
        .order("created_date", { ascending: false })
        .limit(100);
      if (error) { console.warn("fetch viewer chat error:", error.message); return []; }
      return data || [];
    },
    initialData: [],
    refetchInterval: 3000,
    enabled: !!effectiveStream?.id,
    staleTime: 2000,
  });

  useEffect(() => {
    const joins = chatMessages.filter(m => m.message_type === "join" && !shownEntrancesRef.current.has(m.id));
    if (joins.length === 0) return;

    const latestJoin = joins[0];
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", latestJoin.user_id)
          .limit(1);
        if (error) throw error;
        const joiningUser = Array.isArray(data) ? data[0] : null;
        if (joiningUser && joiningUser.active_entrance_effect) {
          setEntranceUser(joiningUser);
          shownEntrancesRef.current.add(latestJoin.id);
          setTimeout(() => setEntranceUser(null), 4000);
        }
      } catch (e) {
        console.error("viewer entrance effect lookup failed:", e);
      }
    })();
  }, [chatMessages]);

  return (
    <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", flexDirection: "row" }}>
      {/* Entrance effect overlay for viewers */}
      {entranceUser && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999999, pointerEvents: "none" }}>
          <EntranceEffect username={entranceUser.username || entranceUser.full_name} onComplete={() => setEntranceUser(null)} />
        </div>
      )}

      {/* Gift animations (multiple gifts at once) */}
      {incomingGifts.map((giftEvent, idx) => (
        <GiftAnimation
          key={idx}
          gift={giftEvent.gift}
          senderName={giftEvent.senderName}
          duration={4000}
        />
      ))}

      <div
        ref={videoContainerRef}
        id="video-container"
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "8px",
          padding: "8px",
          position: "relative",
        }}
      >
        {/* Leave button overlay */}
        <button
          onClick={handleLeaveStream}
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            zIndex: 50,
            backgroundColor: "rgba(220, 38, 38, 0.8)",
            color: "white",
            border: "none",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = "rgba(220, 38, 38, 1)"}
          onMouseLeave={(e) => e.target.style.backgroundColor = "rgba(220, 38, 38, 0.8)"}
        >
          <X size={20} />
        </button>
        {/* Streamer stats panel (only show for broadcaster) */}
        {effectiveIsStreamer && effectiveStream && (
          <div style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 30,
            width: 300,
          }}>
            <StreamerStatsPanel streamerId={effectiveStream.streamer_id} streamId={effectiveStream.id} />
          </div>
        )}

        <p style={{ color: "#fff" }}>
          {connecting
            ? "Connecting to live stream..."
            : effectiveStream == null
              ? "Loading stream..."
              : (!effectiveChannelName || !effectiveAppId)
                ? "Missing streaming credentials. Set VITE_AGORA_APP_ID or join with a valid channel."
                : normalizedIsLive
                  ? "Connecting to live stream..."
                  : "Stream not live"}
        </p>
      </div>

      {/* Chat sidebar */}
      <div style={{ width: 360, borderLeft: "1px solid #222", background: "#0a0a0f", display: "flex", flexDirection: "column" }}>
        {effectiveStream ? (
          <>
            {/* Viewer controls (gift box, like button) */}
            {!effectiveIsStreamer && (
              <div style={{ padding: "12px", borderBottom: "1px solid #222", display: "flex", gap: "8px" }}>
                <GiftBox
                  userId={currentUser?.id}
                  streamId={effectiveStream.id}
                  streamerId={effectiveStream.streamer_id}
                  streamerName={effectiveStream.broadcaster_name || "Streamer"}
                  onGiftSent={(giftEvent) => {
                    setIncomingGifts([...incomingGifts, giftEvent]);
                    // Remove gift after animation
                    setTimeout(() => {
                      setIncomingGifts(prev => prev.filter((_, i) => i !== 0));
                    }, 4500);
                  }}
                />
                <LikeButton userId={currentUser?.id} streamId={effectiveStream.id} />
              </div>
            )}
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <ChatBox stream={effectiveStream} user={currentUser} canModerate={canModerate} isStreamer={effectiveIsStreamer} />
            </div>
          </>
        ) : (
          <div style={{ color: "#bbb", padding: 12 }}>Loading chat…</div>
        )}
      </div>
    </div>
  );
};

export default StreamViewer;
