import React from 'react';
import { Mic, MicOff, Users, Hand, Settings, LogOut, XCircle } from 'lucide-react';
import PodParticipantBox from './PodParticipantBox';
import PodChatBox from './PodChatBox';
import PodHostControlPanel from './PodHostControlPanel';
import TrollsTownControl from '../../components/TrollsTownControl';

const PodRoomContent = ({ 
  room, 
  isHost, 
  participantsData, 
  participantCount, 
  onRequestSpeak, 
  onApproveRequest, 
  onRemoveSpeaker,
  onEndPod,
  onLeavePod,
  isGuest, 
  canPublish, 
  localAudioTrack 
}) => {
  if (!room) {
    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white items-center justify-center">
        <p>Loading room...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h1 className="text-xl font-bold">{room.title}</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Users />
                <span>{participantCount}</span>
              </div>
              {isHost ? (
                <button 
                  onClick={onEndPod}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>End</span>
                </button>
              ) : (
                <button 
                  onClick={onLeavePod}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded-lg text-white text-sm transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Leave</span>
                </button>
              )}
              {isHost && <Settings />}
            </div>
          </div>
          <div className="flex-1 p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {participantsData.map(p => (
              <PodParticipantBox key={p.id} participant={p} isHost={isHost} onApprove={onApproveRequest} onRemove={onRemoveSpeaker} />
            ))}
          </div>
          <div className="p-4 border-t border-gray-700">
            {isGuest ? (
              <p>Sign in to chat and interact</p>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  {canPublish && localAudioTrack && (
                    <button onClick={() => localAudioTrack.setMuted(!localAudioTrack.muted)}>
                      {localAudioTrack.muted ? <MicOff /> : <Mic />}
                    </button>
                  )}
                  {!canPublish && (
                    <button onClick={onRequestSpeak}>
                      <Hand />
                      <span>Request to Speak</span>
                    </button>
                  )}
                </div>
                <TrollsTownControl />
              </div>
            )}
          </div>
        </div>
        <div className="w-80 border-l border-gray-700 flex flex-col">
          <PodChatBox roomId={room.id} />
        </div>
      </div>
    </div>
  );
};

export default PodRoomContent;
