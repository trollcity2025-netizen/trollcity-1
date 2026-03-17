
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom';
import { Button } from '@/components/ui/button';
import { PhoneOff } from 'lucide-react';

import MaiTalentNav from '@/components/maitalent/MaiTalentNav';

import MaiTalentLayout from '@/components/maitalent/MaiTalentLayout';

import VideoTile from '@/components/livekit/VideoTile';

const TrainingSlot = ({ title, user, localVideoTrack, localAudioTrack, livekitClient, canPublish }) => (
  <div className="flex flex-col items-center gap-4">
    <h2 className="text-2xl font-bold">{title}</h2>
    <VideoTile 
      user={user}
      localVideoTrack={localVideoTrack}
      localAudioTrack={localAudioTrack}
      displayName={title}
      role="viewer" // Role is viewer in training, publish is controlled manually
      canPublish={canPublish}
      livekitClient={livekitClient}
    />
  </div>
);

const MaiTalentTraining = () => {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const [roomId] = useState(urlRoomId);
  const [isCallActive, setIsCallActive] = useState(!!urlRoomId);

  const { 
    localVideoTrack, 
    localAudioTrack,
    remoteUsers, 
    joinRoom, 
    leaveRoom, 
    client
  } = useLiveKitRoom({
    roomId: isCallActive ? roomId : null,
    role: 'publisher',
    publish: false, // Manual publishing
  });

  useEffect(() => {
    if (isCallActive && roomId) {
      joinRoom();
    }
  }, [isCallActive, roomId, joinRoom]);

  const auditioner = remoteUsers[0];

  const handleCreateAndJoin = () => {
    const newRoomId = uuidv4();
    navigate(`/mai-talent/training/${newRoomId}`);
  };

  const handleEndCall = () => {
    leaveRoom();
    setIsCallActive(false);
    navigate('/mai-talent/training');
  };

  return (
    <MaiTalentLayout>
      <MaiTalentNav />
      <div className="max-w-5xl mx-auto space-y-10">
        <h1 className="text-4xl font-bold text-center mb-2">1-on-1 Judge Training</h1>
        {isCallActive && roomId && (
          <div className="text-center">
            <p className="text-slate-400">Share this link with the auditioner:</p>
            <input 
              readOnly
              value={`${window.location.origin}/mai-talent/training/${roomId}`}
              className="bg-slate-800 text-center p-2 rounded-lg w-full max-w-md mx-auto mt-2"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TrainingSlot 
            title="Judge (You)" 
            localVideoTrack={localVideoTrack} 
            localAudioTrack={localAudioTrack} 
            livekitClient={client}
            canPublish={true}
          />
          <TrainingSlot 
            title="Auditioner" 
            user={auditioner} 
          />
        </div>

        {!isCallActive && (
          <div className="flex justify-center">
            <Button onClick={handleCreateAndJoin} className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6">Create & Start Call</Button>
          </div>
        )}
        {isCallActive && (
          <div className="flex justify-center">
             <Button onClick={handleEndCall} variant="destructive" size="lg" className="px-8 py-6">
                <PhoneOff className="mr-2" /> End Call
              </Button>
          </div>
        )}
      </div>
    </MaiTalentLayout>
  );
};

export default MaiTalentTraining;
