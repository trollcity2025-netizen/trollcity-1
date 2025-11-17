import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Hammer, Users, Clock, Coins, Play, Pause, X, Check, User, Crown, Star } from "lucide-react";
import { debitPurchasedCoins } from "@/lib/coins";

const SHOW_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const ENTRY_FEE = 500; // 500 paid coins

export default function TrollLiveShow() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [currentPerformer, setCurrentPerformer] = useState(null);
  const [waitlist, setWaitlist] = useState([]);
  const [votes, setVotes] = useState({ pass: 0, kick: 0 });
  const [hasVoted, setHasVoted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(SHOW_DURATION);
  const [showStartTime, setShowStartTime] = useState(null);
  const [isInWaitlist, setIsInWaitlist] = useState(false);
  const [userWins, setUserWins] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchUser();
    fetchShowStatus();
    fetchWaitlist();
    fetchVotes();

    // Set up real-time subscriptions
    const showSubscription = supabase
      .channel('troll-live-show')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'troll_live_show' }, (payload) => {
        handleShowUpdate(payload.new);
      })
      .subscribe();

    const waitlistSubscription = supabase
      .channel('troll-live-waitlist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'troll_live_show_waitlist' }, (payload) => {
        fetchWaitlist();
      })
      .subscribe();

    const votesSubscription = supabase
      .channel('troll-live-votes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'troll_live_show_votes' }, (payload) => {
        fetchVotes();
      })
      .subscribe();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      supabase.removeChannel(showSubscription);
      supabase.removeChannel(waitlistSubscription);
      supabase.removeChannel(votesSubscription);
    };
  }, []);

  useEffect(() => {
    if (isLive && showStartTime) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = now - new Date(showStartTime).getTime();
        const remaining = Math.max(0, SHOW_DURATION - elapsed);
        setTimeRemaining(remaining);

        if (remaining === 0) {
          handleShowEnd();
        }
      }, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [isLive, showStartTime]);

  const fetchUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, username, purchased_coins, wins_count")
          .eq("id", authUser.id)
          .single();
        setUser(profile);
        setUserWins(profile?.wins_count || 0);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchShowStatus = async () => {
    try {
      const response = await fetch('/api/manageTrollLiveShow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          action: 'get_current_show',
          userId: user?.id
        })
      });

      const result = await response.json();
      
      if (response.ok && result.show) {
        setIsLive(true);
        setCurrentPerformer(result.show.current_performer);
        setShowStartTime(result.show.current_performer_start_time);
      } else {
        setIsLive(false);
        setCurrentPerformer(null);
        setShowStartTime(null);
        setTimeRemaining(SHOW_DURATION);
      }
    } catch (error) {
      console.error("Error fetching show status:", error);
    }
  };

  const fetchWaitlist = async () => {
    try {
      const { data, error } = await supabase
        .from("troll_live_show_waitlist")
        .select("*, user:profiles(id, username, avatar_url)")
        .order("position", { ascending: true });

      if (data && !error) {
        setWaitlist(data);
        if (user) {
          const userInList = data.find(item => item.user_id === user.id);
          setIsInWaitlist(!!userInList);
        }
      }
    } catch (error) {
      console.error("Error fetching waitlist:", error);
    }
  };

  const fetchVotes = async () => {
    try {
      if (!currentPerformer || !isLive) return;

      // Get current active show
      const { data: currentShow } = await supabase
        .from('troll_live_show')
        .select('id')
        .eq('is_active', true)
        .single();

      if (!currentShow) return;

      // Get current performer waitlist entry
      const { data: performerEntry } = await supabase
        .from('troll_live_show_waitlist')
        .select('id, votes_received, votes_against')
        .eq('show_id', currentShow.id)
        .eq('user_id', currentPerformer.id)
        .eq('status', 'performing')
        .single();

      if (performerEntry) {
        setVotes({ 
          pass: performerEntry.votes_received || 0, 
          kick: performerEntry.votes_against || 0 
        });

        // Check if current user has voted
        if (user) {
          const { data: userVote } = await supabase
            .from('troll_live_show_votes')
            .select('id')
            .eq('show_id', currentShow.id)
            .eq('waitlist_entry_id', performerEntry.id)
            .eq('voter_id', user.id)
            .single();
          
          setHasVoted(!!userVote);
        }
      }
    } catch (error) {
      console.error("Error fetching votes:", error);
    }
  };

  const getCurrentShowId = () => {
    // This would typically come from the current show data
    return isLive ? 'current' : null;
  };

  const handleShowUpdate = (showData) => {
    if (showData && showData.status === "live") {
      setIsLive(true);
      setCurrentPerformer(showData.current_performer ? JSON.parse(showData.current_performer) : null);
      setShowStartTime(showData.start_time);
    } else {
      setIsLive(false);
      setCurrentPerformer(null);
      setShowStartTime(null);
      setTimeRemaining(SHOW_DURATION);
    }
  };

  const handleShowEnd = async () => {
    try {
      // Determine if performer was kicked or passed
      const totalVotes = votes.pass + votes.kick;
      const kickPercentage = totalVotes > 0 ? (votes.kick / totalVotes) * 100 : 0;
      const wasKicked = kickPercentage > 50; // Majority vote to kick

      if (wasKicked) {
        toast.error("🚫 Performer was kicked by majority vote!");
      } else {
        toast.success("✅ Performer completed their session!");
        
        // Award win to performer if they passed
        if (currentPerformer) {
          await awardWinToPerformer(currentPerformer.id);
        }
      }

      // Clear votes for next performer
      setVotes({ pass: 0, kick: 0 });
      setHasVoted(false);

      // Move to next performer
      await moveToNextPerformer();
    } catch (error) {
      console.error("Error handling show end:", error);
    }
  };

  const awardWinToPerformer = async (performerId) => {
    try {
      await supabase
        .from("profiles")
        .update({ wins: supabase.sql`wins + 1` })
        .eq("id", performerId);

      if (user && user.id === performerId) {
        setUserWins(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error awarding win:", error);
    }
  };

  const moveToNextPerformer = async () => {
    try {
      if (waitlist.length > 0) {
        const nextPerformer = waitlist[0];
        
        // Remove from waitlist
        await supabase
          .from("troll_live_show_waitlist")
          .delete()
          .eq("id", nextPerformer.id);

        // Update current performer
        await supabase
          .from("troll_live_show")
          .update({
            current_performer: JSON.stringify(nextPerformer.user),
            start_time: new Date().toISOString(),
            status: "live"
          })
          .eq("status", "live");

        // Clear votes for new performer
        await supabase
          .from("troll_live_show_votes")
          .delete()
          .eq("show_id", getCurrentShowId());

      } else {
        // No more performers, end show
        await endShow();
      }
    } catch (error) {
      console.error("Error moving to next performer:", error);
    }
  };

  const endShow = async () => {
    try {
      await supabase
        .from("troll_live_show")
        .update({ status: "ended" })
        .eq("status", "live");

      setIsLive(false);
      setCurrentPerformer(null);
      setShowStartTime(null);
      setTimeRemaining(SHOW_DURATION);
    } catch (error) {
      console.error("Error ending show:", error);
    }
  };

  const joinWaitlist = async () => {
    if (!user) {
      toast.error("Please login to join the waitlist");
      return;
    }

    if (user.purchased_coins < ENTRY_FEE) {
      toast.error(`You need ${ENTRY_FEE} paid coins to join. Please purchase coins first.`);
      return;
    }

    if (isInWaitlist) {
      toast.error("You are already in the waitlist");
      return;
    }

    try {
      const response = await fetch('/api/manageTrollLiveShow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          action: 'join_waitlist',
          userId: user.id
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success(`Joined waitlist! ${ENTRY_FEE} coins deducted.`);
        fetchUser(); // Refresh user data
        fetchWaitlist();
      } else {
        toast.error(result.error || "Failed to join waitlist");
      }
    } catch (error) {
      console.error("Error joining waitlist:", error);
      toast.error("Failed to join waitlist");
    }
  };

  const leaveWaitlist = async () => {
    if (!user || !isInWaitlist) return;

    try {
      const response = await fetch('/api/manageTrollLiveShow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          action: 'leave_waitlist',
          userId: user.id,
          showId: getCurrentShowId()
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success("Left waitlist");
        fetchWaitlist();
      } else {
        toast.error(result.error || "Failed to leave waitlist");
      }
    } catch (error) {
      console.error("Error leaving waitlist:", error);
      toast.error("Failed to leave waitlist");
    }
  };

  const vote = async (voteType) => {
    if (!user || !currentPerformer || hasVoted) return;

    try {
      // Get current active show and performer entry
      const { data: currentShow } = await supabase
        .from('troll_live_show')
        .select('id')
        .eq('is_active', true)
        .single();

      if (!currentShow) return;

      const { data: performerEntry } = await supabase
        .from('troll_live_show_waitlist')
        .select('id')
        .eq('show_id', currentShow.id)
        .eq('user_id', currentPerformer.id)
        .eq('status', 'performing')
        .single();

      if (!performerEntry) return;

      const response = await fetch('/api/manageTrollLiveShow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          action: 'cast_vote',
          userId: user.id,
          showId: currentShow.id,
          waitlistEntryId: performerEntry.id,
          voteType: voteType === 'pass' ? 'keep' : 'kick'
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setHasVoted(true);
        toast.success(`Voted to ${voteType === 'pass' ? 'PASS' : 'KICK'}!`);
        fetchVotes(); // Refresh vote counts
      } else {
        toast.error(result.error || "Failed to vote");
      }
    } catch (error) {
      console.error("Error voting:", error);
      toast.error("Failed to vote");
    }
  };

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getVotePercentage = (voteType) => {
    const total = votes.pass + votes.kick;
    if (total === 0) return 0;
    return Math.round((votes[voteType] / total) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-purple-900 to-indigo-900">
      {/* Red Curtain Header */}
      <div className="relative bg-gradient-to-b from-red-800 to-red-900 border-b-4 border-red-600">
        <div className="absolute inset-0 bg-red-900 opacity-50" style={{
          backgroundImage: `linear-gradient(45deg, #7f1d1d 25%, transparent 25%), linear-gradient(-45deg, #7f1d1d 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #7f1d1d 75%), linear-gradient(-45deg, transparent 75%, #7f1d1d 75%)`,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
        }} />
        <div className="relative container mx-auto px-4 py-8 text-center">
          <h1 className="text-5xl font-bold text-white mb-2 flex items-center justify-center gap-4">
            <Crown className="w-12 h-12 text-yellow-400" />
            🎭 TROLL LIVE SHOW 🎭
            <Crown className="w-12 h-12 text-yellow-400" />
          </h1>
          <p className="text-red-200 text-lg">The ultimate variety show where viewers control the stage!</p>
          
          <div className="flex justify-center items-center gap-4 mt-4">
            <Badge className="bg-yellow-500 text-black px-4 py-2">
              <Coins className="w-4 h-4 mr-1" />
              Entry: {ENTRY_FEE} coins
            </Badge>
            <Badge className="bg-purple-500 text-white px-4 py-2">
              <Clock className="w-4 h-4 mr-1" />
              5 minutes per performer
            </Badge>
            <Badge className="bg-green-500 text-white px-4 py-2">
              <Star className="w-4 h-4 mr-1" />
              Wins: {userWins}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Stage */}
          <div className="lg:col-span-2">
            <Card className="bg-black/50 backdrop-blur-sm border-red-500/30 overflow-hidden">
              {/* Red Curtain Frame */}
              <div className="relative bg-gradient-to-b from-red-700 to-red-800 p-1">
                <div className="bg-black rounded-lg overflow-hidden">
                  {isLive && currentPerformer ? (
                    <div className="aspect-video bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center relative">
                      {/* Performer Video Area */}
                      <div className="text-center">
                        <User className="w-24 h-24 text-white mb-4 mx-auto" />
                        <h2 className="text-2xl font-bold text-white mb-2">{currentPerformer.username}</h2>
                        <p className="text-gray-300">Performing Live!</p>
                        
                        {/* Timer */}
                        <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full font-bold">
                          {formatTime(timeRemaining)}
                        </div>
                      </div>
                      
                      {/* Stage Lights Effect */}
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-400 animate-pulse" />
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-blue-400 animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                      <div className="text-center">
                        <Crown className="w-16 h-16 text-yellow-400 mb-4 mx-auto" />
                        <h2 className="text-2xl font-bold text-white mb-2">Show Offline</h2>
                        <p className="text-gray-400">Waiting for the next performer...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Voting Controls */}
              {isLive && currentPerformer && (
                <div className="p-6 bg-black/30">
                  <h3 className="text-white font-bold mb-4 text-center">🗳️ VOTE NOW! 🗳️</h3>
                  
                  {/* Vote Results */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-green-300 font-bold">✅ PASS</span>
                        <span className="text-green-300 font-bold">{votes.pass}</span>
                      </div>
                      <div className="w-full bg-green-900 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${getVotePercentage('pass')}%` }}
                        />
                      </div>
                      <div className="text-green-300 text-sm mt-1">{getVotePercentage('pass')}%</div>
                    </div>
                    
                    <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-red-300 font-bold flex items-center gap-1">
                          <Hammer className="w-4 h-4" />
                          KICK
                        </span>
                        <span className="text-red-300 font-bold">{votes.kick}</span>
                      </div>
                      <div className="w-full bg-red-900 rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${getVotePercentage('kick')}%` }}
                        />
                      </div>
                      <div className="text-red-300 text-sm mt-1">{getVotePercentage('kick')}%</div>
                    </div>
                  </div>

                  {/* Voting Buttons */}
                  {!hasVoted ? (
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        onClick={() => vote('pass')}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-4"
                      >
                        <Check className="w-5 h-5 mr-2" />
                        PASS
                      </Button>
                      
                      <Button
                        onClick={() => vote('kick')}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-4"
                      >
                        <Hammer className="w-5 h-5 mr-2" />
                        KICK
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-yellow-300 font-bold">
                      ✅ You have voted! Results updating live...
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Waitlist */}
            <Card className="bg-black/30 backdrop-blur-sm border-purple-500/30">
              <div className="p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Waitlist ({waitlist.length})
                </h3>

                {!isInWaitlist ? (
                  <Button
                    onClick={joinWaitlist}
                    disabled={!user || user.purchased_coins < ENTRY_FEE}
                    className="w-full mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    Join Waitlist ({ENTRY_FEE} coins)
                  </Button>
                ) : (
                  <div className="mb-4">
                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 mb-2">
                      <p className="text-green-300 font-bold">✅ You're in the waitlist!</p>
                      <p className="text-green-200 text-sm">Position: #{waitlist.findIndex(item => item.user_id === user?.id) + 1}</p>
                    </div>
                    <Button
                      onClick={leaveWaitlist}
                      variant="outline"
                      className="w-full border-red-500 text-red-400 hover:bg-red-500/10"
                    >
                      Leave Waitlist
                    </Button>
                  </div>
                )}

                {/* Waitlist Users */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {waitlist.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-black/20 rounded-lg">
                      <div className="text-yellow-400 font-bold w-6 text-center">
                        {index + 1}
                      </div>
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{item.user?.username || 'Unknown'}</p>
                        <p className="text-gray-400 text-xs">Joined {new Date(item.joined_at).toLocaleTimeString()}</p>
                      </div>
                      {item.user_id === user?.id && (
                        <Badge className="bg-green-500 text-white text-xs">You</Badge>
                      )}
                    </div>
                  ))}
                  
                  {waitlist.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No one in waitlist yet</p>
                      <p className="text-xs">Be the first to join!</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Show Rules */}
            <Card className="bg-black/30 backdrop-blur-sm border-blue-500/30">
              <div className="p-6">
                <h3 className="text-white font-bold mb-4">📋 Show Rules</h3>
                <div className="space-y-3 text-sm text-gray-300">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    <span>Each performer gets 5 minutes on stage</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    <span>Viewers vote: PASS (green) or KICK (hammer)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    <span>Majority KICK vote = immediate removal</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    <span>Completing 5 minutes = WIN (+1 to profile)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    <span>Entry fee: {ENTRY_FEE} paid coins</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}