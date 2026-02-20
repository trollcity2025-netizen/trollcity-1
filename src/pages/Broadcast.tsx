import React, { useState } from 'react';
import { useAgora } from '../hooks/useAgora';
import { IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';

const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

const Broadcast: React.FC = () => {
  const {
    client,
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
    join,
    leave,
    publish,
    unpublish,
    connectionState,
  } = useAgora();

  const [channel, setChannel] = useState<string>('trollcity');
  const [token, setToken] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!channel) {
      alert('Please enter a channel name.');
      return;
    }
    await join(APP_ID, channel, token);
    await publish();
  };

  const handleLeave = async () => {
    await unpublish();
    await leave();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-4xl font-bold text-green-500 mb-4 text-center">Broadcast</h1>
        <div className="flex justify-center mb-4">
          <input
            type="text"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="Enter channel name"
            className="bg-gray-700 text-white rounded-l-md px-4 py-2 focus:outline-none"
          />
          <button
            onClick={handleJoin}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-r-md"
            disabled={connectionState === 'CONNECTED'}
          >
            Join
          </button>
          <button
            onClick={handleLeave}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 ml-2 rounded-md"
            disabled={connectionState !== 'CONNECTED'}
          >
            Leave
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-2">Local Video</h2>
            {localVideoTrack && (
              <div
                ref={(el) => el && localVideoTrack.play(el)}
                className="w-full h-64 bg-black rounded-lg"
              />
            )}
          </div>

          {remoteUsers.map((user: IAgoraRTCRemoteUser) => (
            <div key={user.uid} className="bg-gray-700 rounded-lg p-4">
              <h2 className="text-xl font-bold mb-2">Remote Video ({user.uid})</h2>
              {user.videoTrack && (
                <div
                  ref={(el) => el && user.videoTrack?.play(el)}
                  className="w-full h-64 bg-black rounded-lg"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Broadcast;
