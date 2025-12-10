import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Video, Users, Gift, Timer, Shield } from 'lucide-react';

const OfficerLoungeStream = () => {
  const { user, profile } = useAuthStore();
  const [boxCount, setBoxCount] = useState(2);
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [battleTimer, setBattleTimer] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);
  const [roomName] = useState('officer_stream_room');
  
  // Gift tracking for each box
  const [boxGifts, setBoxGifts] = useState({});

  // Officer access validation
  useEffect(() => {
    if (!profile || !user) return;

    const isOfficer = 
      profile.troll_role === 'troll_officer' || 
      profile.troll_role === 'lead_troll_officer' ||
      profile.role === 'troll_officer' || 
      profile.is_troll_officer === true ||
      profile.is_admin === true;

    if (!isOfficer) {
      setAccessDenied(true);
      toast.error('Access Denied — Officers Only');
      return;
    }
  }, [profile, user]);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setBattleTimer(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Initialize gift tracking for each box
  useEffect(() => {
    const initialGifts = {};
    for (let i = 1; i <= boxCount; i++) {
      initialGifts[i] = { total: 0, recent: [] };
    }
    setBoxGifts(initialGifts);

    // Subscribe to gift events for realtime updates
    const giftsChannel = supabase
      .channel('officer-stream-gifts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battle_gifts',
          filter: 'room_name=eq.officer_stream_room'
        },
        (payload) => {
          const gift = payload.new;
          const boxNum = parseInt(gift.position || '1');
          setBoxGifts(prev => ({
            ...prev,
            [boxNum]: {
              total: (prev[boxNum]?.total || 0) + gift.coins_spent,
              recent: [...(prev[boxNum]?.recent || []), gift].slice(-5)
            }
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(giftsChannel);
    };
  }, [boxCount]);

  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get grid layout classes based on box count
  const getGridClasses = (count) => {
    switch (count) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-2';
      case 3:
      case 4: return 'grid-cols-2';
      case 5:
      case 6: return 'grid-cols-3';
      default: return 'grid-cols-2';
    }
  };

  // Join a specific box
  const joinBox = async (boxNumber) => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Get LiveKit token with position metadata for officer room
      const tokenResponse = await fetch(`/api/livekit/token?role=broadcaster&position=${boxNumber}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          room: roomName,
          identity: user.email || user.id,
          metadata: { position: boxNumber.toString(), roomType: 'officer' }
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get LiveKit token');
      }

      const { token, livekitUrl } = await tokenResponse.json();

      if (!token || !livekitUrl) {
        throw new Error('Invalid token response');
      }

      // Create and connect room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up event listeners
      newRoom.on(RoomEvent.Connected, () => {
        console.log(`Officer connected to box ${boxNumber}`);
        setIsConnecting(false);
        setRoom(newRoom);

        // Publish local tracks
        const publishTracks = async () => {
          try {
            const [videoTrack, audioTrack] = await Promise.all([
              createLocalVideoTrack({ facingMode: 'user' }),
              createLocalAudioTrack()
            ]);

            await newRoom.localParticipant.publishTrack(videoTrack);
            await newRoom.localParticipant.publishTrack(audioTrack);
            
            toast.success(`Joined Officer Box ${boxNumber}!`);
          } catch (err) {
            console.error('Error publishing tracks:', err);
            toast.error('Failed to start camera/microphone');
          }
        };

        publishTracks();
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log(`Disconnected from officer box ${boxNumber}`);
        setRoom(null);
        toast.info(`Left Officer Box ${boxNumber}`);
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('Officer participant connected:', participant.identity);
        // Parse metadata to get position
        const metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
        const position = metadata.position || '1';
        
        setParticipants(prev => ({
          ...prev,
          [position]: participant
        }));
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('Officer participant disconnected:', participant.identity);
        // Remove from participants map
        setParticipants(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(key => {
            if (updated[key]?.identity === participant.identity) {
              delete updated[key];
            }
          });
          return updated;
        });
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log('Officer track subscribed:', track.kind, participant.identity);
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        console.log('Officer track unsubscribed:', track.kind);
      });

      // Connect to officer room
      await newRoom.connect(livekitUrl, token);

    } catch (err) {
      console.error('Error joining officer box:', err);
      setError(err.message);
      setIsConnecting(false);
      toast.error('Failed to join officer box');
    }
  };

  // Leave current box
  const leaveBox = () => {
    if (room) {
      room.disconnect();
      setRoom(null);
    }
  };

  // Render individual box
  const renderBox = (boxNumber) => {
    const participant = participants[boxNumber];
    const gifts = boxGifts[boxNumber] || { total: 0, recent: [] };

    return (
      <div key={boxNumber} className="relative bg-black rounded-xl overflow-hidden aspect-video">
        {participant ? (
          // Active participant
          <div className="w-full h-full">
            <VideoRenderer 
              participant={participant} 
              position={boxNumber}
            />
            <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Officer Box {boxNumber}
            </div>
            <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs">
              OFFICER LIVE
            </div>
          </div>
        ) : (
          // Waiting state
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            <Shield className="w-12 h-12 mb-4 text-blue-400" />
            <div className="text-lg font-semibold">Waiting for Officer...</div>
            <div className="text-sm mb-4">Officer Box {boxNumber}</div>
            <button
              onClick={() => joinBox(boxNumber)}
              disabled={isConnecting || room !== null}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              {isConnecting ? 'Connecting...' : `Join Officer Box ${boxNumber}`}
            </button>
          </div>
        )}

        {/* Gift counter */}
        <div className="absolute bottom-2 right-2 bg-black/60 text-yellow-400 px-2 py-1 rounded text-sm flex items-center gap-1">
          <Gift className="w-4 h-4" />
          {gifts.total.toLocaleString()}
        </div>
      </div>
    );
  };

  // Access denied screen
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-900 to-black text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <Shield className="w-20 h-20 mx-auto mb-6 text-red-400" />
          <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
          <p className="text-xl text-red-200 mb-2">Officers Only</p>
          <p className="text-gray-300">
            This area is restricted to Troll Officers and Lead Troll Officers only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Shield className="w-10 h-10 text-blue-400" />
            OFFICER STREAM — MULTI-BOX VIEW
          </h1>
          <p className="text-gray-300">Exclusive officer streaming with LiveKit</p>
          {profile && (
            <p className="text-blue-300 text-sm mt-2">
              Officer: {profile.username} • Role: {profile.troll_role || profile.role}
            </p>
          )}
        </div>

        {/* Battle Timer */}
        <div className="bg-blue-900/50 border border-blue-500/50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-2xl font-bold">
            <Timer className="w-6 h-6" />
            OFFICER BATTLE TIME: {formatTime(battleTimer)}
          </div>
        </div>

        {/* Box Count Selector */}
        <div className="bg-[#111320] border border-blue-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <label className="text-lg font-semibold">Number of Officer Boxes: {boxCount}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setBoxCount(Math.max(1, boxCount - 1))}
                className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded"
                disabled={boxCount <= 1}
              >
                -
              </button>
              <button
                onClick={() => setBoxCount(Math.min(6, boxCount + 1))}
                className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded"
                disabled={boxCount >= 6}
              >
                +
              </button>
            </div>
          </div>
          
          <input
            type="range"
            min="1"
            max="6"
            value={boxCount}
            onChange={(e) => setBoxCount(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>1 Box</span>
            <span>2 Boxes</span>
            <span>3 Boxes</span>
            <span>4 Boxes</span>
            <span>5 Boxes</span>
            <span>6 Boxes</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-4">
            <p className="text-red-200">Error: {error}</p>
          </div>
        )}

        {/* Video Grid */}
        <div className={`grid gap-4 ${getGridClasses(boxCount)}`}>
          {Array.from({ length: boxCount }, (_, i) => renderBox(i + 1))}
        </div>

        {/* Current Status */}
        {room && (
          <div className="bg-green-900/50 border border-green-500 rounded-xl p-4 text-center">
            <p className="text-green-200 font-semibold flex items-center justify-center gap-2">
              <Shield className="w-5 h-5" />
              ✅ Connected to Officer LiveKit room. You are broadcasting!
            </p>
            <button
              onClick={leaveBox}
              className="mt-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
            >
              Leave Officer Stream
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-[#111320] border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Officer Stream Guidelines:
          </h3>
          <ul className="space-y-2 text-gray-300">
            <li>• This area is exclusively for Troll Officers and Lead Troll Officers</li>
            <li>• Select the number of streaming boxes (1-6)</li>
            <li>• Click "Join Officer Box" on any empty box to start broadcasting</li>
            <li>• Officers can send gifts that appear in real-time</li>
            <li>• Each box represents a different officer broadcaster position</li>
            <li>• Uses separate LiveKit room: "officer_stream_room"</li>
            <li>• Officer activity is tracked for shift management</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// VideoRenderer component for displaying participant video
const VideoRenderer = ({ participant, position }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const handleTrackSubscribed = (track, publication) => {
      if (track.kind === 'video' && videoRef.current) {
        track.attach(videoRef.current);
      }
    };

    const handleTrackUnsubscribed = (track) => {
      track.detach();
    };

    // Subscribe to existing tracks
    participant.tracks.forEach((publication) => {
      if (publication.track) {
        handleTrackSubscribed(publication.track, publication);
      }
    });

    // Listen for new tracks
    participant.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    participant.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    return () => {
      participant.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      participant.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      
      // Clean up tracks
      participant.tracks.forEach((publication) => {
        if (publication.track) {
          publication.track.detach();
        }
      });
    };
  }, [participant]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
};

export default OfficerLoungeStream;