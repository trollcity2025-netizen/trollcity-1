import React, { createContext, useState, useCallback, ReactNode } from 'react';
import DrivingAnimation from './DrivingAnimation';
import { useAuthStore } from '../../lib/store';
import { cars } from '../../data/vehicles';

export interface GameContextType {
  isDriving: boolean;
  destination: string | null;
  startDriving: (to: string, onArrive?: () => void) => void;
  isRaidActive: boolean;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [isDriving, setIsDriving] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [isRaidActive, setIsRaidActive] = useState(false);
  const [arrivalCallback, setArrivalCallback] = useState<(() => void) | null>(null);
  const { profile } = useAuthStore();

  const startDriving = useCallback((to: string, onArrive?: () => void) => {
    setDestination(to);
    setIsDriving(true);
    setArrivalCallback(() => onArrive || null);
    
    const activeId = profile?.active_vehicle ?? null;
    const activeVehicle = cars.find(car => car.id === activeId);
    const armor = activeVehicle?.armor ?? 0;
    const baseChance = 0.1;
    const armorReduction = Math.min(0.07, armor / 1500);
    const raidChance = Math.max(0.02, baseChance - armorReduction);
    const triggerRaid = Math.random() < raidChance;
    setIsRaidActive(triggerRaid);
  }, []);

  const handleArrival = useCallback(() => {
    setIsDriving(false);
    setDestination(null);
    setIsRaidActive(false);
    if (arrivalCallback) {
      arrivalCallback();
      setArrivalCallback(null);
    }
  }, [arrivalCallback]);

  return (
    <GameContext.Provider value={{ isDriving, destination, startDriving, isRaidActive }}>
      {children}
      {isDriving && destination && (
        <DrivingAnimation 
          destination={destination} 
          onComplete={handleArrival} 
          isRaid={isRaidActive}
        />
      )}
    </GameContext.Provider>
  );
}

export default GameContext;
