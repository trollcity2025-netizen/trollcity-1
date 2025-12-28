import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';

const AccessDenied: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-6">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-6">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-400">
            You don't have permission to access this page.
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Go Home
        </button>
      </div>
    </div>
  );
};

export default AccessDenied;