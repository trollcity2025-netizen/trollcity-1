import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { trollCityTheme } from '../styles/trollCityTheme';

const AccessDenied: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white flex items-center justify-center p-6`}>
      <div className={`max-w-md mx-auto text-center ${trollCityTheme.backgrounds.card} p-8 rounded-2xl ${trollCityTheme.borders.glass}`}>
        <div className="mb-6">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
          <p className={trollCityTheme.text.muted}>
            You don&apos;t have permission to access this page.
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className={`inline-flex items-center ${trollCityTheme.components.buttonPrimary}`}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Go Home
        </button>
      </div>
    </div>
  );
};

export default AccessDenied;