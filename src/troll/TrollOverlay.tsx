import React, { useEffect, useState } from 'react';
import { TrollEvent } from './useTrollEngine';
import TrollJumpScare from './events/TrollJumpScare';
import FakeBanScreen from './events/FakeBanScreen';
import FakeVirusScan from './events/FakeVirusScan';
import FakeCoinLoss from './events/FakeCoinLoss';
import TrollCourtSummons from './events/TrollCourtSummons';

interface TrollOverlayProps {
  event: TrollEvent;
  onComplete: () => void;
}

const TrollOverlay: React.FC<TrollOverlayProps> = ({ event, onComplete }) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  // Animation for fade-in and fade-out
  useEffect(() => {
    setIsVisible(true);
    
    const timer = setTimeout(() => {
      setIsVisible(false);
      
      // Complete after fade-out animation
      const fadeOutTimer = setTimeout(() => {
        onComplete();
      }, 500);

      return () => clearTimeout(fadeOutTimer);
    }, event.duration - 500);

    return () => clearTimeout(timer);
  }, [event.duration, onComplete]);

  // Render the appropriate troll component
  const renderTrollComponent = () => {
    switch (event.type) {
      case 'TROLL_JUMPSCARE':
        return <TrollJumpScare rarity={event.rarity} />;
      case 'FAKE_BAN_SCREEN':
        return <FakeBanScreen rarity={event.rarity} />;
      case 'FAKE_VIRUS_SCAN':
        return <FakeVirusScan rarity={event.rarity} />;
      case 'FAKE_COIN_LOSS':
        return <FakeCoinLoss rarity={event.rarity} />;
      case 'TROLL_COURT_SUMMONS':
        return <TrollCourtSummons rarity={event.rarity} />;
      default:
        return <TrollJumpScare rarity={event.rarity} />;
    }
  };

  return (
    <div 
      className={`fixed top-0 left-0 w-full h-full z-[1000] flex items-center justify-center transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {renderTrollComponent()}
    </div>
  );
};

export default TrollOverlay;
