import React from 'react';
import { useParams } from 'react-router-dom';

const LiveStreamPage: React.FC = () => {
  const { streamId } = useParams<{ streamId: string }>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Live Stream</h1>
        <p className="text-gray-400 mb-4">Stream ID: {streamId}</p>
        <div className="bg-black/60 border border-purple-600/30 rounded-xl p-8 text-center">
          <p>Live streaming component will be implemented here.</p>
        </div>
      </div>
    </div>
  );
};

export default LiveStreamPage;