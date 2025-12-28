import React from 'react';
import { useParams } from 'react-router-dom';

const InterviewRoom: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Interview Room</h1>
        <p className="text-gray-400 mb-4">Session ID: {sessionId}</p>
        <div className="bg-black/60 border border-purple-600/30 rounded-xl p-8 text-center">
          <p>Interview room component will be implemented here.</p>
        </div>
      </div>
    </div>
  );
};

export default InterviewRoom;