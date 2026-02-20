import React from 'react'

import { Stream } from '../../types/broadcast';

interface ChurchLayoutProps {
  children: React.ReactNode;
  isHost?: boolean;
  broadcasterProfile?: any; // Assuming 'any' for now, can be refined
  stream?: Stream;
}

export default function ChurchLayout({ children, isHost, broadcasterProfile, stream }: ChurchLayoutProps) {
  const broadcasterName = broadcasterProfile?.username || 'Pastor';
  const streamTitle = stream?.title || 'Service';

  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center p-6 bg-black"
      style={{
        backgroundImage: `url('/images/church-pastor-view-background.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="w-full h-full max-w-7xl relative">
        {/* Header with broadcaster name and service title */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
              <svg width="18" height="26" viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="2" width="2" height="24" fill="white" opacity="0.9"/>
                <rect x="4" y="10" width="12" height="2" fill="white" opacity="0.9"/>
              </svg>
            </div>
            <div className="text-white/90 font-semibold text-shadow-lg">{broadcasterName}</div>
          </div>
          <div className="text-white/90 font-semibold text-shadow-lg">Troll Church • {streamTitle}</div>
        </div>

        {/* Main content area - pastor video overlays here */}
        <div className="absolute inset-0 w-full h-full">
          {children}
        </div>

        {/* Footer overlay for host info */}
        <div className="absolute bottom-4 right-4 z-20 text-sm text-white/80 text-shadow-md">{isHost ? 'You are live (Pastor)' : 'Live: Pastor speaking'}</div>
      </div>
    </div>
  )
}
