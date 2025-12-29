import React, { createContext, useContext, useState, ReactNode } from 'react';

interface GlobalAppContextType {
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  errorType: 'error' | 'offline' | null;
  clearError: () => void;
  retryLastAction: () => void;
  isReconnecting: boolean;
  reconnectMessage: string;
  setError: (message: string | null, type?: 'error' | 'offline') => void;
  setRetryAction: (action: (() => void) | null) => void;
  setStreamEnded: (ended: boolean) => void;
}

const GlobalAppContext = createContext<GlobalAppContextType | undefined>(undefined);

interface GlobalAppProviderProps {
  children: ReactNode;
}

export const GlobalAppProvider: React.FC<GlobalAppProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setErrorState] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'error' | 'offline' | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectMessage, setReconnectMessage] = useState('');
  const [retryAction, setRetryActionState] = useState<(() => void) | null>(null);
  const [isStreamEnded, setIsStreamEndedState] = useState(false);

  const setError = (message: string | null, type: 'error' | 'offline' = 'error') => {
    setErrorState(message);
    setErrorType(message ? type : null);
  };

  const setRetryAction = (action: (() => void) | null) => {
    setRetryActionState(() => action);
  };

  const setStreamEnded = (ended: boolean) => {
    setIsStreamEndedState(ended);
  };

  const clearError = () => {
    setErrorState(null);
    setErrorType(null);
    setRetryActionState(null);
    setIsStreamEndedState(false);
  };

  const retryLastAction = () => {
    if (retryAction) {
      retryAction();
    }
  };

  const value: GlobalAppContextType = {
    isLoading,
    loadingMessage,
    error,
    errorType,
    clearError,
    retryLastAction,
    isReconnecting,
    reconnectMessage,
    setError,
    setRetryAction,
    setStreamEnded,
  };

  return (
    <GlobalAppContext.Provider value={value}>
      {children}
    </GlobalAppContext.Provider>
  );
};

export const useGlobalApp = (): GlobalAppContextType => {
  const context = useContext(GlobalAppContext);
  if (context === undefined) {
    throw new Error('useGlobalApp must be used within a GlobalAppProvider');
  }
  return context;
};

