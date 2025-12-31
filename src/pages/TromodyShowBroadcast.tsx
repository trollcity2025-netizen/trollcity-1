import React, { useState, useEffect, useRef, memo } from 'react';
import { LiveKitRoom, ParticipantTile, useTracks } from '@livekit/components-react';
import '@livekit/components-styles';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Video, Users, Play, X } from 'lucide-react';
import { Track } from 'livekit-client';

type Status = 'IDLE' | 'SEARCHING' | 'MATCHED' | 'RESULTS' | 'EXITED';

const TromodyShowBroadcast = () => {
   const { user, profile } = useAuthStore();
   const [status, setStatus] = useState<Status>('IDLE');
   const [token, setToken] = useState<string | null>(null);
   const [serverUrl, setServerUrl] = useState<string | null>(null);
   const [roomName, setRoomName] = useState<string | null>(null);
   const [matchTimer, setMatchTimer] = useState(0);
   const [resultsCountdown, setResultsCountdown] = useState(7);
   const [isCameraReady, setIsCameraReady] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [shouldConnect, setShouldConnect] = useState(false);

  const _videoRef = useRef<HTMLVideoElement>(null);
  const _opponentVideoRef = useRef<HTMLVideoElement>(null);

  // Check camera readiness
  useEffect(() => {
    const checkCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setIsCameraReady(true);
        stream.getTracks().forEach(track => track.stop());
      } catch {
        setIsCameraReady(false);
        setError('Camera/microphone access required');
      }
    };
    checkCamera();
  }, []);

  // Match timer
  useEffect(() => {
    if (status === 'MATCHED') {
      const timer = setInterval(() => {
        setMatchTimer(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status]);

  // Results countdown
  useEffect(() => {
    if (status === 'RESULTS' && resultsCountdown > 0) {
      const timer = setTimeout(() => {
        setResultsCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (status === 'RESULTS' && resultsCountdown === 0) {
      handleSkip();
    }
  }, [status, resultsCountdown]);

  // Set status to MATCHED when connected
  useEffect(() => {
    if (shouldConnect && token) {
      setStatus('MATCHED');
    }
  }, [shouldConnect, token]);

  // Token generation - only when roomName changes
  useEffect(() => {
    let cancelled = false;
    if (!roomName || !user) {
      console.log('[TromodyShowBroadcast] No roomName or user, skipping token generation');
      return;
    }

    console.log('[TromodyShowBroadcast] Generating token for room:', roomName);

    (async () => {
      try {
        const tokenResponse = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            room: roomName,
            identity: user.email || user.id
          })
        });

        if (!tokenResponse.ok) throw new Error('Failed to get token');

        const { token: newToken, livekitUrl } = await tokenResponse.json();

        if (!cancelled) {
          console.log('[TromodyShowBroadcast] Token generated successfully');
          setToken(newToken);
          setServerUrl(livekitUrl);
        }
      } catch (err: any) {
        console.error('[TromodyShowBroadcast] Error generating token:', err);
        if (!cancelled) {
          setError(err.message);
          setStatus('IDLE');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomName, user]);



  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startShow = () => {
    if (!user || !profile || !isCameraReady) return;

    setStatus('SEARCHING');
    setError(null);

    const id = crypto.randomUUID();
    setRoomName(`tromody-show-${id}`);
    setShouldConnect(true);
  };


// Memoized Tromody Video Grid
const TromodyVideoGrid = memo(() => {
  const tracks = useTracks(
    [Track.Source.Camera],
    { onlySubscribed: false }
  );

  const localTrack = tracks.find(t => t.participant?.isLocal);
  const remoteTrack = tracks.find(t => !t.participant?.isLocal);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Local participant */}
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
        {localTrack ? (
          <ParticipantTile trackRef={localTrack} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Users className="w-12 h-12" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-sm">
          You
        </div>
        <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs">
          LIVE
        </div>
      </div>

      {/* Remote participant */}
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
        {remoteTrack ? (
          <ParticipantTile trackRef={remoteTrack} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            <Users className="w-12 h-12 mb-4" />
            <div className="text-lg font-semibold">Opponent</div>
          </div>
        )}
        {remoteTrack && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-sm">
            Opponent
          </div>
        )}
      </div>
    </div>
  );
});

TromodyVideoGrid.displayName = 'TromodyVideoGrid';

  const _endMatch = () => {
    setStatus('RESULTS');
    setResultsCountdown(7);
  };

  const handleRematch = () => {
    setStatus('MATCHED');
    setMatchTimer(0);
    setResultsCountdown(7);
  };

  const handleSkip = () => {
    const id = crypto.randomUUID();
    setRoomName(`tromody-show-${id}`);
    // shouldConnect stays true
    setStatus('SEARCHING');
    setMatchTimer(0);
    setResultsCountdown(7);
  };

  const exitShow = () => {
    setShouldConnect(false);
    setStatus('EXITED');
  };

  if (status === 'EXITED') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Show Ended</h2>
          <p>Thanks for broadcasting!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Video className="w-10 h-10 text-purple-400" />
            TROMODY SHOW — BROADCAST
          </h1>
          <p className="text-gray-300">Random match broadcasting</p>
        </div>

        {/* Status */}
        <div className="bg-purple-900/50 border border-purple-500/50 rounded-xl p-4 text-center">
          <div className="text-lg font-semibold">
            Status: {status}
            {status === 'MATCHED' && ` | Time: ${formatTime(matchTimer)}`}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-4">
            <p className="text-red-200">Error: {error}</p>
          </div>
        )}

        {/* LiveKit Room - Always rendered, connection controlled by connect prop */}
        <LiveKitRoom
          key={roomName ?? "no-room"}
          serverUrl={serverUrl || ""}
          token={token || ""}
          connect={shouldConnect && !!token}
          audio={true}
          video={true}
          className="w-full"
          onDisconnected={() => console.log("LK disconnected", roomName)}
          onConnected={() => console.log("LK connected", roomName)}
        >
          <TromodyVideoGrid />
        </LiveKitRoom>

        {/* Fallback Video Grid when not connected */}
        {(!token || status !== 'MATCHED') && (
          <div className="grid grid-cols-2 gap-4">
            {/* Broadcaster Box */}
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Users className="w-12 h-12" />
              </div>
              <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-sm">
                You
              </div>
            </div>

            {/* Opponent Box */}
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
              {status === 'SEARCHING' && (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                  <Users className="w-12 h-12 mb-4" />
                  <div className="text-lg font-semibold">Finding opponent...</div>
                </div>
              )}
              {status === 'IDLE' && (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                  <Users className="w-12 h-12 mb-4" />
                  <div className="text-lg font-semibold">Opponent</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-[#111320] border border-purple-700/50 rounded-xl p-6">
          <div className="flex justify-center gap-4">
            {status === 'IDLE' && (
              <button
                onClick={startShow}
                disabled={!isCameraReady}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Start Show
              </button>
            )}
            {(status === 'SEARCHING' || status === 'MATCHED') && (
              <button
                onClick={exitShow}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                Exit
              </button>
            )}
          </div>
        </div>

        {/* Results Overlay */}
        {status === 'RESULTS' && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-[#111320] border border-purple-500 rounded-xl p-8 text-center max-w-md">
              <h2 className="text-2xl font-bold mb-4">Match Results</h2>
              <p className="text-lg mb-6">You Win! (Placeholder)</p>
              <div className="text-3xl font-bold text-purple-400 mb-6">
                {resultsCountdown}
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleRematch}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Rematch
                </button>
                <button
                  onClick={handleSkip}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TromodyShowBroadcast;
