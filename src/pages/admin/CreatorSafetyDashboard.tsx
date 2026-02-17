
import React from 'react';
import { useAuthStore } from '../../lib/store';
import { trollCityTheme } from '../../styles/trollCityTheme';
import ErrorBoundary from '../../components/ErrorBoundary';
import { Shield } from 'lucide-react';

// Import the components we'll be using
import PresidentialOversightPanel from './components/PresidentialOversightPanel';
import { CreatorApplicationsPanel } from '../../components/admin';
import IPBanModal from '../../components/officer/IPBanModal'; // This is a modal, so we'll need a way to trigger it.

import AutoClickerReportsPanel from './components/AutoClickerReportsPanel';

const CreatorSafetyDashboard = () => {
  const { profile } = useAuthStore();
  const [isIpBanModalOpen, setIsIpBanModalOpen] = React.useState(false);

  if (profile?.role !== 'admin') {
    return (
      <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white flex items-center justify-center`}>
        <div className="px-6 py-3 rounded bg-red-950 border border-red-500 text-center">
          <p className="font-bold mb-1">Access Restricted</p>
          <p className="text-sm text-red-200">
            This dashboard is limited to administrators only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-6`}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-purple-400" />
              Creator Safety Dashboard
            </h1>
            <p className="text-gray-400 text-sm">
              Tools for monitoring and ensuring the safety of creators.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2">
            <ErrorBoundary>
              <AutoClickerReportsPanel />
            </ErrorBoundary>
          </div>
          <div className="lg:col-span-1">
            <ErrorBoundary>
              <PresidentialOversightPanel />
            </ErrorBoundary>
          </div>
          <div className="lg:col-span-1">
            <ErrorBoundary>
              <CreatorApplicationsPanel />
            </ErrorBoundary>
          </div>
        </div>

        <div>
            <button
                onClick={() => setIsIpBanModalOpen(true)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
            >
                IP Ban Tool
            </button>
        </div>

        {isIpBanModalOpen && (
            <IPBanModal
                isOpen={isIpBanModalOpen}
                onClose={() => setIsIpBanModalOpen(false)}
                onSuccess={() => {
                    setIsIpBanModalOpen(false);
                    // Optionally, refresh data here
                }}
            />
        )}
      </div>
    </div>
  );
};

export default CreatorSafetyDashboard;
