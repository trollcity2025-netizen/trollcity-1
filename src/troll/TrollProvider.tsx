import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useTrollEngine, TrollEvent } from './useTrollEngine';
import TrollOverlay from './TrollOverlay';

interface TrollContextType {
  triggerTroll: (context?: string, options?: { safe?: boolean }) => void;
}

const TrollContext = createContext<TrollContextType | undefined>(undefined);

interface TrollProviderProps {
  children: ReactNode;
}

export const TrollProvider = ({ children }: TrollProviderProps) => {
  const { triggerTroll: engineTriggerTroll, completeTroll } = useTrollEngine();
  const [activeTroll, setActiveTroll] = useState<TrollEvent | null>(null);

  // Handle triggering a troll
  const triggerTroll = useCallback((context?: string, options?: { safe?: boolean }) => {
    const event = engineTriggerTroll(context, options);
    
    if (event) {
      setActiveTroll(event);
      
      // Auto-complete the troll after duration
      setTimeout(() => {
        setActiveTroll(null);
        completeTroll();
      }, event.duration);
    }
  }, [engineTriggerTroll]);

  return (
    <TrollContext.Provider value={{ triggerTroll }}>
      {children}
      {activeTroll && <TrollOverlay event={activeTroll} onComplete={() => setActiveTroll(null)} />}
    </TrollContext.Provider>
  );
};

export const useTrollContext = () => {
  const context = useContext(TrollContext);
  if (!context) {
    throw new Error('useTrollContext must be used within a TrollProvider');
  }
  return context;
};

export default TrollProvider;
