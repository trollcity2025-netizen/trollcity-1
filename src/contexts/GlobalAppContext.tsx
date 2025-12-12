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
}

const GlobalAppContext = createContext<GlobalAppContextType | undefined>(undefined);

interface GlobalAppProviderProps {
  children: ReactNode;
}

export const GlobalAppProvider: React.FC<GlobalAppProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'error' | 'offline' | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectMessage, setReconnectMessage] = useState('');

  const clearError = () => {
    setError(null);
    setErrorType(null);
  };

  const retryLastAction = () => {
    // This would typically retry the last failed action
    // For now, just clear the error
    clearError();
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