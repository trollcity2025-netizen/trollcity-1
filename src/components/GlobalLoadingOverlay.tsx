import React from 'react';
import { useGlobalApp } from '../contexts/GlobalAppContext';

interface GlobalLoadingOverlayProps {
  isVisible?: boolean;
  message?: string;
  type?: 'loading' | 'reconnecting' | 'error';
  onRetry?: () => void;
}

const GlobalLoadingOverlay: React.FC<GlobalLoadingOverlayProps> = ({
  isVisible = false,
  message = '',
  type = 'loading',
  onRetry
}) => {
  const { isLoading, loadingMessage, isReconnecting, reconnectMessage, error } = useGlobalApp();

  // Use props if provided, otherwise use context values
  const showOverlay = isVisible || isLoading || isReconnecting || !!error;
  const displayMessage = message ||
    (isReconnecting ? reconnectMessage : '') ||
    (isLoading ? loadingMessage : '') ||
    (error ? error : '');

  const overlayType = type || (isReconnecting ? 'reconnecting' : error ? 'error' : 'loading');

  if (!showOverlay) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-[#1a1a1a] rounded-lg p-6 max-w-sm w-full mx-4 text-center border border-[#333]">
        <div className="mb-4">
          {overlayType === 'loading' && (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#22c55e] mx-auto"></div>
          )}
          {overlayType === 'reconnecting' && (
            <div className="animate-pulse rounded-full h-12 w-12 bg-[#f59e0b] mx-auto flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          )}
          {overlayType === 'error' && (
            <div className="rounded-full h-12 w-12 bg-[#ef4444] mx-auto flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          )}
        </div>

        <p className="text-white text-sm mb-4">
          {displayMessage || getDefaultMessage(overlayType)}
        </p>

        {onRetry && overlayType === 'error' && (
          <button
            onClick={onRetry}
            className="bg-[#22c55e] hover:bg-[#16a34a] text-white px-4 py-2 rounded text-sm transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

function getDefaultMessage(type: string): string {
  switch (type) {
    case 'loading':
      return 'Loading...';
    case 'reconnecting':
      return 'Reconnecting...';
    case 'error':
      return 'An error occurred';
    default:
      return 'Please wait...';
  }
}

export default GlobalLoadingOverlay;
