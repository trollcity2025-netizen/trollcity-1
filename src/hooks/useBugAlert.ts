/**
 * Bug Alert Hook
 * Hook for triggering bug alerts from anywhere in the app
 */

import { useCallback } from 'react';
import { BugAlertCreate, BugAlertSeverity } from '../types/bugAlert';
import { useBugAlertStore } from '../stores/useBugAlertStore';
import { toast } from 'sonner';

interface UseBugAlertOptions {
  autoReport?: boolean;
  showToast?: boolean;
  onError?: (error: Error) => void;
}

export function useBugAlert(options: UseBugAlertOptions = {}) {
  const { autoReport = false, showToast = true, onError } = options;
  const { reportBug } = useBugAlertStore();
  
  const report = useCallback(async (bug: BugAlertCreate): Promise<string | null> => {
    try {
      const result = await reportBug(bug);
      
      if (result && showToast) {
        toast.success('Bug reported successfully', {
          description: 'Admins have been notified',
          duration: 3000,
        });
      }
      
      return result?.id || null;
    } catch (error) {
      console.error('Failed to report bug:', error);
      if (onError) onError(error as Error);
      return null;
    }
  }, [reportBug, showToast, onError]);
  
  const reportError = useCallback(async (
    error: Error,
    context?: {
      title?: string;
      severity?: BugAlertSeverity;
      category?: BugAlertCreate['category'];
      metadata?: Record<string, unknown>;
    }
  ): Promise<string | null> => {
    const bug: BugAlertCreate = {
      title: context?.title || error.name || 'Unknown Error',
      description: error.message || 'An error occurred',
      severity: context?.severity || determineSeverity(error),
      category: context?.category || 'other',
      error_message: error.message,
      stack_trace: error.stack,
      metadata: {
        ...context?.metadata,
        errorName: error.name,
        timestamp: new Date().toISOString(),
      },
    };
    
    return report(bug);
  }, [report]);
  
  const reportCritical = useCallback(async (
    title: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string | null> => {
    return report({
      title,
      description,
      severity: 'critical',
      category: 'other',
      metadata,
    });
  }, [report]);
  
  const reportLiveKitError = useCallback(async (
    error: Error,
    context?: {
      roomId?: string;
      participantId?: string;
      action?: string;
    }
  ): Promise<string | null> => {
    return reportError(error, {
      title: `LiveKit Error: ${context?.action || 'Unknown'}`,
      severity: 'critical',
      category: 'livekit',
      metadata: {
        ...context,
        errorCode: 'LIVEKIT_ERROR',
      },
    });
  }, [reportError]);
  
  const reportBroadcastError = useCallback(async (
    error: Error,
    context?: {
      broadcastId?: string;
      action?: 'start' | 'join' | 'leave' | 'end' | 'guest' | 'viewer';
    }
  ): Promise<string | null> => {
    return reportError(error, {
      title: `Broadcast Error: ${context?.action || 'Unknown'}`,
      severity: 'high',
      category: 'broadcast',
      metadata: {
        ...context,
        errorCode: 'BROADCAST_ERROR',
      },
    });
  }, [reportError]);
  
  const reportAuthError = useCallback(async (
    error: Error,
    context?: {
      action?: string;
      userId?: string;
    }
  ): Promise<string | null> => {
    return reportError(error, {
      title: `Auth Error: ${context?.action || 'Unknown'}`,
      severity: 'high',
      category: 'auth',
      metadata: {
        ...context,
        errorCode: 'AUTH_ERROR',
      },
    });
  }, [reportError]);
  
  return {
    report,
    reportError,
    reportCritical,
    reportLiveKitError,
    reportBroadcastError,
    reportAuthError,
  };
}

/**
 * Determine severity based on error type
 */
function determineSeverity(error: Error): BugAlertSeverity {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  
  // Critical errors
  if (
    message.includes('livekit') ||
    message.includes('connection failed') ||
    message.includes('network') ||
    name.includes('typeerror') ||
    message.includes('cannot read property')
  ) {
    return 'critical';
  }
  
  // High severity
  if (
    message.includes('auth') ||
    message.includes('permission') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  ) {
    return 'high';
  }
  
  // Medium severity
  if (
    message.includes('timeout') ||
    message.includes('slow') ||
    message.includes('performance')
  ) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Global error handler for uncaught errors
 */
export function initGlobalBugReporter() {
  if (typeof window === 'undefined') return;
  
  const originalOnerror = window.onerror;
  const originalOnunhandledrejection = (window as any).onunhandledrejection;

  const reportError = async (
    error: Error,
    context?: {
      title?: string;
      severity?: BugAlertSeverity;
      category?: BugAlertCreate['category'];
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> => {
    try {
      const bug: BugAlertCreate = {
        title: context?.title || error.name || 'Unknown Error',
        description: error.message || 'An error occurred',
        severity: context?.severity || determineSeverity(error),
        category: context?.category || 'other',
        error_message: error.message,
        stack_trace: error.stack,
        metadata: {
          ...context?.metadata,
          errorName: error.name,
          timestamp: new Date().toISOString(),
        },
      };

      const { reportBug } = useBugAlertStore.getState();
      await reportBug(bug);
    } catch (reportErr) {
      console.error('Failed to report bug:', reportErr);
    }
  };
  
  window.onerror = (event, source, lineno, colno, error) => {
    console.error('[Global Error]', event, source, lineno, colno, error);
    
    if (error) {
      void reportError(error, {
        title: `JavaScript Error: ${event as string}`,
        severity: 'high',
        metadata: {
          source,
          lineno,
          colno,
        },
      });
    }
    
    if (originalOnerror) {
      return originalOnerror(event, source, lineno, colno, error);
    }
    return false;
  };
  
  (window as any).onunhandledrejection = (event: PromiseRejectionEvent) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
    
    if (event.reason instanceof Error) {
      void reportError(event.reason, {
        title: 'Unhandled Promise Rejection',
        severity: 'medium',
        metadata: {
          promise: event.promise,
        },
      });
    }
    
    if (originalOnunhandledrejection) {
      return originalOnunhandledrejection(event);
    }
    return false;
  };
}
