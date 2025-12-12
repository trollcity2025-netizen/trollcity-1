// src/pages/TromodyShow.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TromodyInstructions from "../components/tromody/TromodyInstructions";
import TromodyChat from "../components/tromody/TromodyChat";
import TromodyGiftBox from "../components/tromody/TromodyGiftBox";
import TromodyLikeButton from "../components/tromody/TromodyLikeButton";
import StageFrame from "../components/tromody/StageFrame";
import AuthorityPanel from "../components/AuthorityPanel";
import { useBattleQueue } from "../hooks/useBattleQueue";
import { useBattleTimer } from "../hooks/useBattleTimer";
import { useLiveKitRoom } from "../hooks/useLiveKitRoom";
import { supabase } from "../lib/supabase";
import { createNotification } from "../lib/notifications";
import api from "../lib/api";
import { toast } from "sonner";
import { createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import "../styles/tromody-stage.css";

export default function TromodyShow() {
  const navigate = useNavigate();
  const [showInstructions, setShowInstructions] = useState(true);
  const [winner, setWinner] = useState(null);
  const [curtainsOpen, setCurtainsOpen] = useState(false);
  const [crowdLevel, setCrowdLevel] = useState(0);
  const [giftHistory, setGiftHistory] = useState([]);

  // MOCK roles until connected to Supabase
  const [role, setRole] = useState("viewer");
  // allowed: viewer, officer, admin

  const [currentUser, setCurrentUser] = useState(null);
  const [audioContextResumed, setAudioContextResumed] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  // Video refs for LiveKit track attachment
  const leftVideoRef = useRef(null);
  const rightVideoRef = useRef(null);

  // Determine winner function
  const determineWinner = async () => {
    let winnerUsername = null;
    let winnerUserId = null;

    if (leftUser?.gifts > rightUser?.gifts) {
      winnerUsername = leftUser.username;
      winnerUserId = leftUser.id;
    } else if (rightUser?.gifts > leftUser?.gifts) {
      winnerUsername = rightUser.username;
      winnerUserId = rightUser.id;
    } else {
      winnerUsername = "Tie";
    }

    setWinner(winnerUsername);

    // Save battle result to database
    if (leftUser && rightUser) {
      try {
        const battleId = `tromody-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await supabase.from('tromody_battles').insert({
          battle_id: battleId,
          left_user_id: leftUser.id,
          right_user_id: rightUser.id,
          winner_user_id: winnerUserId,
          left_gifts_received: leftUser.gifts || 0,
          right_gifts_received: rightUser.gifts || 0,
          battle_duration_seconds: 180, // Standard 3-minute battles
          battle_started_at: new Date(Date.now() - 180000).toISOString(), // Approximate start time
          battle_ended_at: new Date().toISOString()
        });

        console.log('Tromody battle result saved:', { battleId, winner: winnerUsername });
      } catch (error) {
        console.error('Failed to save Tromody battle result:', error);
      }
    }
  };

  // Battle queue and media hooks
  const {
    queue,
    leftUser,
    rightUser,
    joinQueue,
    removeUser,
    updateGift,
    rotateBattle
  } = useBattleQueue(determineWinner);

  // Timer hook
  const { timer, isRunning } = useBattleTimer(leftUser, rightUser, () => {
    determineWinner();
    rotateBattle();
  });

  // Curtain opening ceremony at 2:55
  useEffect(() => {
    if (timer <= 175 && !curtainsOpen) {
      setCurtainsOpen(true);
    }
  }, [timer, curtainsOpen]);

  // Unified LiveKit room for Tromody Show
  const { room, participants, isConnecting, connect, disconnect } = useLiveKitRoom(
    'tromody-show',
    currentUser ? { ...currentUser, role: role, level: 1 } : null
  );

  // Handle LiveKit track events for video display
  useEffect(() => {
    if (!room) return;

    const handleTrackSubscribed = (track, publication, participant) => {
      if (track.kind === 'video') {
        // Find which side this participant is on
        const metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
        const side = metadata.side;

        if (side === 'left' && leftVideoRef.current) {
          track.attach(leftVideoRef.current);
        } else if (side === 'right' && rightVideoRef.current) {
          track.attach(rightVideoRef.current);
        }
      }
    };

    const handleTrackUnsubscribed = (track) => {
      track.detach();
    };

    room.on('trackSubscribed', handleTrackSubscribed);
    room.on('trackUnsubscribed', handleTrackUnsubscribed);

    return () => {
      room.off('trackSubscribed', handleTrackSubscribed);
      room.off('trackUnsubscribed', handleTrackUnsubscribed);
    };
  }, [room]);

  // Media streams are now handled by LiveKit in joinBattle

  // Load logged-in user
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setCurrentUser({
          id: data.user.id,
          username: data.user.email.split("@")[0],
        });

        // Fetch role
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("troll_role")
          .eq("id", data.user.id)
          .single();

        if (profile?.troll_role) setRole(profile.troll_role);
      }
    })();
  }, []);

  // Handle AudioContext resumption for browser security
  useEffect(() => {
    const resumeAudioContext = async () => {
      if (audioContextResumed) return;

      try {
        if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          const audioContext = new AudioContextClass();

          console.log('AudioContext state before resume:', audioContext.state);

          if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('AudioContext resumed, new state:', audioContext.state);
          }

          setAudioContextResumed(true);
          console.log('AudioContext setup completed successfully');

          // If user is in a battle but doesn't have audio, try to add it now
          if (room && room.state === 'connected' && !hasAudio && currentUser) {
            tryAddAudio();
          }
        }
      } catch (error) {
        console.error('Failed to resume AudioContext:', error);
      }
    };

    // Resume on any user interaction
    const handleUserInteraction = async () => {
      console.log('User interaction detected, attempting AudioContext resume...');
      await resumeAudioContext();
      // Remove listeners after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };

    if (!audioContextResumed) {
      console.log('Setting up AudioContext listeners...');
      document.addEventListener('click', handleUserInteraction);
      document.addEventListener('touchstart', handleUserInteraction);
      document.addEventListener('keydown', handleUserInteraction);
    }

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [audioContextResumed]);

  // Camera access is now handled entirely by LiveKit in the joinBattle function
  // No need for separate useMediaStream management

  // Handle page unload to cleanup streams
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentUser) {
        removeUser(currentUser.id);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentUser, removeUser]);

  // Get followers of a user and send notifications
  const notifyFollowersUserJoined = async (user, side) => {
    try {
      // Get all followers of the user
      const { data: followers, error } = await supabase
        .from('user_follows')
        .select('follower_id')
        .eq('following_id', user.id);

      if (error) {
        console.error('Error fetching followers:', error);
        return;
      }

      if (!followers || followers.length === 0) {
        return; // No followers to notify
      }

      // Send notifications to all followers
      const notifications = followers.map(follower => ({
        user_id: follower.follower_id,
        type: 'officer_update',
        title: '🎭 Someone Joined Tromody!',
        message: `${user.username} just joined the ${side} side in a Tromody battle! Come watch the chaos unfold.`,
        metadata: {
          joined_user_id: user.id,
          joined_username: user.username,
          side_joined: side,
          tromody_battle: true,
          timestamp: new Date().toISOString()
        }
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error sending follower notifications:', insertError);
      } else {
        console.log(`Sent tromody notifications to ${followers.length} followers`);
      }
    } catch (err) {
      console.error('Error in notifyFollowersUserJoined:', err);
    }
  };

  // Try to add audio track after AudioContext is resumed
  const tryAddAudio = async () => {
    if (!room || room.state !== 'connected' || hasAudio) return;

    try {
      console.log('Attempting to add audio track...');
      const audioTrack = await createLocalAudioTrack();
      await room.localParticipant.publishTrack(audioTrack);
      setHasAudio(true);
      toast.success('Audio enabled! You can now speak in the battle.');
      console.log('Audio track added successfully');
    } catch (error) {
      console.warn('Failed to add audio track:', error);
    }
  };

  // Joining the queue
  const joinBattle = async (side) => {
    if (!currentUser) return;

    // Check if AudioContext needs to be resumed first
    if (!audioContextResumed) {
      toast.error('Please interact with the page first (click anywhere) to enable audio');
      return;
    }

    // Connect to LiveKit room if not already connected
    if (!room) {
      connect();
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (room && room.state === 'connected') {
      try {
        // Wait a bit for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('Attempting to create and publish video track...');

        // Create video track with better error handling
        let videoTrack;
        try {
          videoTrack = await createLocalVideoTrack({
            facingMode: 'user',
            resolution: { width: 1280, height: 720 },
            frameRate: 30
          });
          console.log('Video track created successfully');
        } catch (videoError) {
          console.error('Video track creation failed:', videoError);

          // Provide specific error messages
          if (videoError.name === 'NotAllowedError') {
            throw new Error('Camera access denied. Please allow camera permissions in your browser.');
          } else if (videoError.name === 'NotFoundError') {
            throw new Error('No camera found. Please connect a camera and try again.');
          } else if (videoError.name === 'NotReadableError') {
            throw new Error('Camera is already in use by another application.');
          } else {
            throw new Error(`Camera error: ${videoError.message}`);
          }
        }

        // Publish video track
        await room.localParticipant.publishTrack(videoTrack);
        console.log('Video track published successfully');

        // Attach local video to the appropriate video element
        if (side === 'left' && leftVideoRef.current) {
          videoTrack.attach(leftVideoRef.current);
          leftVideoRef.current.muted = true;
          leftVideoRef.current.play().catch(console.error);
        } else if (side === 'right' && rightVideoRef.current) {
          videoTrack.attach(rightVideoRef.current);
          rightVideoRef.current.muted = true;
          rightVideoRef.current.play().catch(console.error);
        }

        // Try to create and publish audio track with better error handling
        try {
          const audioTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          });
          await room.localParticipant.publishTrack(audioTrack);
          setHasAudio(true);
          console.log('Audio track published successfully');
        } catch (audioError) {
          console.warn('Audio track creation failed:', audioError);
          setHasAudio(false);
          // Continue without audio - video will still work
          toast.warning('Joined battle with video only - audio may be enabled later');
        }

        // Set metadata for side with timeout and retry
        const metadata = JSON.stringify({
          side: side,
          user_id: currentUser.id,
          role: role
        });

        try {
          await Promise.race([
            room.localParticipant.setMetadata(metadata),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Metadata update timeout')), 5000)
            )
          ]);
        } catch (metadataError) {
          console.warn('Metadata update failed, continuing without it:', metadataError);
          // Don't fail the whole join process for metadata issues
        }

        const userWithStreams = {
          ...currentUser,
          gifts: 0,
          // Stream management is now handled by LiveKit
          startStream: () => Promise.resolve(),
          stopStream: () => Promise.resolve(),
        };

        const joined = joinQueue(userWithStreams, side);
        if (joined) {
          // Notify followers that user joined
          await notifyFollowersUserJoined(currentUser, side);
          toast.success(`${currentUser.username} joined the battle!`);
        } else {
          toast.error('You are already in the battle or queue');
        }
      } catch (err) {
        console.error('Error publishing to LiveKit:', err);
        toast.error('Failed to join battle stream');
      }
    } else {
      toast.error('Failed to connect to battle room');
    }
  };

  // Admin/Officer KICK user
  const kickLeft = () => {
    if (leftUser) {
      removeUser(leftUser.id);
    }
  };

  const kickRight = () => {
    if (rightUser) {
      removeUser(rightUser.id);
    }
  };

  const leaveBattle = () => {
    if (currentUser) {
      removeUser(currentUser.id);
    }
    disconnect(); // Disconnect from LiveKit
    navigate('/live');
  };

  const addGift = (side, amount) => {
    updateGift(side, amount);

    // Track gift history for crowd meter
    const now = Date.now();
    const newGiftHistory = [...giftHistory, { timestamp: now, amount }];
    setGiftHistory(newGiftHistory);

    // Calculate crowd level based on gifts in last 10 seconds
    const tenSecondsAgo = now - 10000;
    const recentGifts = newGiftHistory.filter(gift => gift.timestamp > tenSecondsAgo);
    const totalRecentGifts = recentGifts.reduce((sum, gift) => sum + gift.amount, 0);
    const newCrowdLevel = Math.min(Math.floor(totalRecentGifts / 5), 5);
    setCrowdLevel(newCrowdLevel);

    // Clean up old gift history (keep only last 15 seconds)
    const fifteenSecondsAgo = now - 15000;
    setGiftHistory(prev => prev.filter(gift => gift.timestamp > fifteenSecondsAgo));
  };

  // Golden confetti burst on win
  const launchConfetti = () => {
    const canvas = document.getElementById('confetti-layer');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#FFD700', '#FACC15', '#FFF1A8'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * 12,
        vy: -(Math.random() * 12 + 6),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        gravity: 0.4,
        life: 120
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.life--;

        if (p.life <= 0) {
          particles.splice(i, 1);
          return;
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      if (particles.length > 0) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  };

  // Trigger confetti on winner
  useEffect(() => {
    if (winner && winner !== 'Tie') {
      launchConfetti();
    }
  }, [winner]);

  return (
    <div className="relative w-full h-screen bg-black text-white flex pt-16 lg:pt-0">
      <div className="flex-1 flex flex-col">

      {showInstructions && (
        <TromodyInstructions onClose={() => setShowInstructions(false)} />
      )}

      {/* Winner Prompt */}
      {winner && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="bg-purple-900 border border-purple-600 p-6 rounded-xl shadow-xl text-center">
            <h1 className="text-3xl font-bold text-yellow-400 mb-4">🏆 WINNER 🏆</h1>
            <p className="text-xl text-white mb-4">{winner}</p>
            <p className="text-gray-300 text-sm mb-4">They receive ALL gifts from both sides.</p>
            <button
              onClick={() => setWinner(null)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Golden Confetti Layer */}
      <canvas id="confetti-layer" className="confetti-canvas" />

      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-900 border-b border-purple-700">
        <div className="text-sm">
          <span className="text-purple-300 font-bold">TIMER:</span>{" "}
          {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
        </div>

        <h2 className="text-xl font-bold text-purple-400">TROMODY COMEDY BATTLE</h2>

        <div className="text-sm">
          Role: <span className="text-green-400">{role}</span>
        </div>
      </div>

      {/* Live Video Battle Boxes - Side by Side Battle Arena */}
      <div className={`battle-stage flex-1 border-b border-gray-800 ${false ? 'vip-stage' : ''}`}>

        {/* LEFT PLAYER STAGE */}
        <StageFrame
          side="left"
          isLive={!!leftUser}
          giftCount={leftUser?.gifts || 0}
          onJoin={() => joinBattle('left')}
          disabled={!currentUser || queue.some(u => u.id === currentUser.id)}
          joinText={queue.some(u => u.id === currentUser?.id) ? 'In Queue' : 'Join Left'}
          curtainsOpen={curtainsOpen}
          crowdLevel={crowdLevel}
        >
          {leftUser ? (
            <div className="relative w-full h-full">
              <video
                ref={leftVideoRef}
                className="w-full h-full object-cover rounded-lg"
                autoPlay
                muted
                playsInline
              />

              {/* Control buttons overlay */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                {leftUser?.id === currentUser?.id && (
                  <button
                    onClick={leaveBattle}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm font-semibold"
                  >
                    Leave Battle
                  </button>
                )}

                {leftUser && (role === "admin" || role === "officer") && (
                  <button
                    onClick={kickLeft}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 rounded text-sm font-semibold"
                  >
                    Kick User
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </StageFrame>

        {/* CENTER GOLD VS DIVIDER */}
        <div className="stage-divider" />

        {/* RIGHT PLAYER STAGE */}
        <StageFrame
          side="right"
          isLive={!!rightUser}
          giftCount={rightUser?.gifts || 0}
          onJoin={() => joinBattle('right')}
          disabled={!currentUser || queue.some(u => u.id === currentUser.id)}
          joinText={queue.some(u => u.id === currentUser?.id) ? 'In Queue' : 'Join Right'}
          curtainsOpen={curtainsOpen}
          crowdLevel={crowdLevel}
        >
          {rightUser ? (
            <div className="relative w-full h-full">
              <video
                ref={rightVideoRef}
                className="w-full h-full object-cover rounded-lg"
                autoPlay
                muted
                playsInline
              />

              {/* Control buttons overlay */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                {rightUser?.id === currentUser?.id && (
                  <button
                    onClick={leaveBattle}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm font-semibold"
                  >
                    Leave Battle
                  </button>
                )}

                {rightUser && (role === "admin" || role === "officer") && (
                  <button
                    onClick={kickRight}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 rounded text-sm font-semibold"
                  >
                    Kick User
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </StageFrame>
      </div>

      {/* Chat + Gift + Like */}
      <div className="grid grid-cols-4 border-t border-purple-700 bg-gray-900 p-3">
        <div className="col-span-3 pr-3">
          <TromodyChat />
        </div>
        <div className="col-span-1 flex flex-col gap-3">
          <TromodyGiftBox onGift={addGift} leftUser={leftUser} rightUser={rightUser} />
          <TromodyLikeButton />
        </div>
      </div>
    </div>

    {/* Authority Panel - Right Side Rail */}
    <div className="hidden lg:block">
      <div className="sticky top-0 h-screen">
        <AuthorityPanel />
      </div>
    </div>
  </div>
);
}