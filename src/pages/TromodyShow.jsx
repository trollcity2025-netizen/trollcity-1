// src/pages/TromodyShow.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TromodyInstructions from "../components/tromody/TromodyInstructions";
import TromodyChat from "../components/tromody/TromodyChat";
import TromodyGiftBox from "../components/tromody/TromodyGiftBox";
import TromodyLikeButton from "../components/tromody/TromodyLikeButton";
import TromodyVideoBox from "../components/tromody/TromodyVideoBox";
import { useMediaStream } from "../hooks/useMediaStream";
import { useBattleQueue } from "../hooks/useBattleQueue";
import { useBattleTimer } from "../hooks/useBattleTimer";
import { useLiveKitRoom } from "../hooks/useLiveKitRoom";
import { supabase } from "../lib/supabase";
import { createNotification } from "../lib/notifications";
import api from "../lib/api";
import { toast } from "sonner";
import { createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';

export default function TromodyShow() {
  const navigate = useNavigate();
  const [showInstructions, setShowInstructions] = useState(true);
  const [winner, setWinner] = useState(null);

  // MOCK roles until connected to Supabase
  const [role, setRole] = useState("viewer");
  // allowed: viewer, officer, admin

  const [currentUser, setCurrentUser] = useState(null);
  const [leftLoaded, setLeftLoaded] = useState(false);
  const [rightLoaded, setRightLoaded] = useState(false);

  // Determine winner function
  const determineWinner = () => {
    if (leftUser?.gifts > rightUser?.gifts) setWinner(leftUser.username);
    else if (rightUser?.gifts > leftUser?.gifts) setWinner(rightUser.username);
    else setWinner("Tie");
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

  // Unified LiveKit room for Tromody Show
  const { room, participants, isConnecting, connect, disconnect } = useLiveKitRoom(
    'tromody-show',
    currentUser ? { ...currentUser, role: role, level: 1 } : null
  );

  // Media streams for left and right (keeping for local preview)
  const leftStream = useMediaStream();
  const rightStream = useMediaStream();

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

  // Handle user streams when they join
  useEffect(() => {
    if (leftUser && leftUser.id === currentUser?.id) {
      setLeftLoaded(false);
      leftStream.startStream().then(() => {
        // Stream started, wait for loaded
      }).catch(err => {
        toast.error('Failed to start camera: ' + err.message);
        removeUser(currentUser.id);
      });
    }
  }, [leftUser, currentUser, leftStream, removeUser]);

  useEffect(() => {
    if (rightUser && rightUser.id === currentUser?.id) {
      setRightLoaded(false);
      rightStream.startStream().then(() => {
        // Stream started, wait for loaded
      }).catch(err => {
        toast.error('Failed to start camera: ' + err.message);
        removeUser(currentUser.id);
      });
    }
  }, [rightUser, currentUser, rightStream, removeUser]);

  // Cleanup streams when users leave
  useEffect(() => {
    if (!leftUser) {
      leftStream.stopStream();
      setLeftLoaded(false);
    }
  }, [leftUser, leftStream]);

  useEffect(() => {
    if (!rightUser) {
      rightStream.stopStream();
      setRightLoaded(false);
    }
  }, [rightUser, rightStream]);

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

  // Joining the queue
  const joinBattle = async (side) => {
    if (!currentUser) return;

    // Connect to LiveKit room if not already connected
    if (!room) {
      connect();
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (room && room.state === 'connected') {
      try {
        // Publish tracks to LiveKit
        const [videoTrack, audioTrack] = await Promise.all([
          createLocalVideoTrack({ facingMode: 'user' }),
          createLocalAudioTrack()
        ]);

        await room.localParticipant.publishTrack(videoTrack);
        await room.localParticipant.publishTrack(audioTrack);

        // Set metadata for side
        room.localParticipant.setMetadata(JSON.stringify({
          side: side,
          user_id: currentUser.id,
          role: role
        }));

        const userWithStreams = {
          ...currentUser,
          gifts: 0,
          startStream: side === 'left' ? leftStream.startStream : rightStream.startStream,
          stopStream: side === 'left' ? leftStream.stopStream : rightStream.stopStream,
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
  };

  return (
    <div className="relative w-full h-screen bg-black text-white flex flex-col">

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

      {/* Live Video Battle Boxes */}
      <div className="grid grid-cols-2 flex-1 border-b border-gray-800">

        {/* LEFT PLAYER */}
        <div className="flex flex-col items-center justify-center relative border-r border-gray-700 p-4">

          {/* Live Video */}
          <div className="bg-gray-800 flex-1 w-full max-w-lg rounded-lg mb-4 flex items-center justify-center overflow-hidden relative">
            <video
              ref={leftStream.videoRef}
              className={`w-full h-full object-cover transition-opacity duration-300 ${leftLoaded ? 'opacity-100' : 'opacity-0'}`}
              autoPlay
              muted
              playsInline
              onLoadedMetadata={() => {
                console.log('Left video loaded');
                setLeftLoaded(true);
              }}
            />
            {!leftUser && (
              <button
                onClick={() => joinBattle('left')}
                disabled={!currentUser || queue.some(u => u.id === currentUser.id)}
                className="absolute inset-0 flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg"
              >
                {queue.some(u => u.id === currentUser?.id) ? 'In Queue' : 'Join Left'}
              </button>
            )}
          </div>

          <div className="text-green-400 font-bold text-lg">
            Gifts: {leftUser?.gifts || 0}
          </div>

          {leftUser?.id === currentUser?.id && (
            <button
              onClick={leaveBattle}
              className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Leave Battle
            </button>
          )}

          {leftUser && (role === "admin" || role === "officer") ? (
            <button
              onClick={kickLeft}
              className="mt-2 text-red-400 underline text-sm"
            >
              Kick User
            </button>
          ) : null}
        </div>

        {/* RIGHT PLAYER */}
        <div className="flex flex-col items-center justify-center relative p-4">

          <div className="bg-gray-800 flex-1 w-full max-w-lg rounded-lg mb-4 flex items-center justify-center overflow-hidden relative">
            <video
              ref={rightStream.videoRef}
              className={`w-full h-full object-cover transition-opacity duration-300 ${rightLoaded ? 'opacity-100' : 'opacity-0'}`}
              autoPlay
              muted
              playsInline
              onLoadedMetadata={() => {
                console.log('Right video loaded');
                setRightLoaded(true);
              }}
            />
            {!rightUser && (
              <button
                onClick={() => joinBattle('right')}
                disabled={!currentUser || queue.some(u => u.id === currentUser.id)}
                className="absolute inset-0 flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg"
              >
                {queue.some(u => u.id === currentUser?.id) ? 'In Queue' : 'Join Right'}
              </button>
            )}
          </div>

          <div className="text-orange-400 font-bold text-lg">
            Gifts: {rightUser?.gifts || 0}
          </div>

          {rightUser?.id === currentUser?.id && (
            <button
              onClick={leaveBattle}
              className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Leave Battle
            </button>
          )}

          {rightUser && (role === "admin" || role === "officer") ? (
            <button
              onClick={kickRight}
              className="mt-2 text-red-400 underline text-sm"
            >
              Kick User
            </button>
          ) : null}
        </div>
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
  );
}