// src/pages/TromodyShow.jsx
import React, { useState, useEffect } from "react";
import TromodyInstructions from "../components/tromody/TromodyInstructions";
import TromodyChat from "../components/tromody/TromodyChat";
import TromodyGiftBox from "../components/tromody/TromodyGiftBox";
import TromodyLikeButton from "../components/tromody/TromodyLikeButton";
import TromodyVideoBox from "../components/tromody/TromodyVideoBox";
import { supabase } from "../lib/supabase";
import { createNotification } from "../lib/notifications";
import api from "../lib/api";
import { toast } from "sonner";

export default function TromodyShow() {
  const [showInstructions, setShowInstructions] = useState(true);
  const [timer, setTimer] = useState(180); // 3 minutes = 180 seconds
  const [winner, setWinner] = useState(null);

  // MOCK roles until connected to Supabase
  const [role, setRole] = useState("viewer");
  // allowed: viewer, officer, admin

  const [leftUser, setLeftUser] = useState({
    id: null,
    username: null,
    gifts: 0,
  });

  const [rightUser, setRightUser] = useState({
    id: null,
    username: null,
    gifts: 0,
  });

  const [currentUser, setCurrentUser] = useState(null);

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
          .from("profiles")
          .select("troll_role")
          .eq("id", data.user.id)
          .single();

        if (profile?.troll_role) setRole(profile.troll_role);
      }
    })();
  }, []);

  // 3-minute countdown timer
  useEffect(() => {
    if (showInstructions) return;
    if (timer <= 0) {
      determineWinner();
      return;
    }

    const interval = setInterval(() => {
      setTimer((t) => t - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [showInstructions, timer]);

  const determineWinner = () => {
    if (leftUser.gifts > rightUser.gifts) setWinner(leftUser.username);
    if (rightUser.gifts > leftUser.gifts) setWinner(rightUser.username);
    if (leftUser.gifts === rightUser.gifts) setWinner("Tie");
  };

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

  // Joining a box
  const joinLeft = async () => {
    if (!currentUser) return;
    if (leftUser.id) return;
    const newLeftUser = { ...currentUser, gifts: 0 };
    setLeftUser(newLeftUser);
    
    // Notify followers that user joined
    await notifyFollowersUserJoined(currentUser, 'left');
    toast.success(`${currentUser.username} joined the left side!`);
  };

  const joinRight = async () => {
    if (!currentUser) return;
    if (rightUser.id) return;
    const newRightUser = { ...currentUser, gifts: 0 };
    setRightUser(newRightUser);
    
    // Notify followers that user joined
    await notifyFollowersUserJoined(currentUser, 'right');
    toast.success(`${currentUser.username} joined the right side!`);
  };

  // Admin/Officer KICK user
  const kickLeft = () => {
    setLeftUser({ id: null, username: null, gifts: 0 });
  };

  const kickRight = () => {
    setRightUser({ id: null, username: null, gifts: 0 });
  };

  const addGift = (side, amount) => {
    if (side === "left" && leftUser.id) {
      setLeftUser((p) => ({ ...p, gifts: p.gifts + amount }));
    } else if (side === "right" && rightUser.id) {
      setRightUser((p) => ({ ...p, gifts: p.gifts + amount }));
    }
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
        <div className="flex flex-col items-center justify-center relative border-r border-gray-700">

          {/* Live Video Placeholder */}
          <div className="bg-gray-800 w-80 h-52 rounded-lg mb-4 flex items-center justify-center">
            {!leftUser.id ? (
              <button
                onClick={joinLeft}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                Join Left
              </button>
            ) : (
              <div className="text-gray-300">🎥 {leftUser.username} Live</div>
            )}
          </div>

          <div className="text-green-400 font-bold text-lg">
            Gifts: {leftUser.gifts}
          </div>

          {role === "admin" || role === "officer" ? (
            <button
              onClick={kickLeft}
              className="mt-2 text-red-400 underline text-sm"
            >
              Kick User
            </button>
          ) : null}
        </div>

        {/* RIGHT PLAYER */}
        <div className="flex flex-col items-center justify-center relative">

          <div className="bg-gray-800 w-80 h-52 rounded-lg mb-4 flex items-center justify-center">
            {!rightUser.id ? (
              <button
                onClick={joinRight}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                Join Right
              </button>
            ) : (
              <div className="text-gray-300">🎥 {rightUser.username} Live</div>
            )}
          </div>

          <div className="text-orange-400 font-bold text-lg">
            Gifts: {rightUser.gifts}
          </div>

          {(role === "admin" || role === "officer") && rightUser.id ? (
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