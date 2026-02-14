/**
 * Bug Alert Popup Component
 * Real-time popup for admin notifications when bugs are detected
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useBugAlertStore } from '../stores/useBugAlertStore';
import { BugAlert, BUG_ALERT_SEVERITY_ORDER, BUG_ALERT_STATUS_COLORS } from '../types/bugAlert';
import { X, AlertTriangle, Check, Clock, Info, Bug } from 'lucide-react';

interface BugAlertPopupProps {
  maxVisible?: number;
}

export function BugAlertPopup({ maxVisible = 3 }: BugAlertPopupProps) {
  const { 
    unreadAlerts, 
    activeAlerts,
    markAsRead, 
    acknowledgeAlert, 
    dismissAlert,
    removeAlert: _removeAlert,
  } = useBugAlertStore();
  
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [visibleAlerts, setVisibleAlerts] = useState<BugAlert[]>([]);
  
  // Get the most critical unread alerts
  useEffect(() => {
    const sorted = [...unreadAlerts].sort((a, b) => {
      const aIndex = BUG_ALERT_SEVERITY_ORDER.indexOf(a.severity);
      const bIndex = BUG_ALERT_SEVERITY_ORDER.indexOf(b.severity);
      return aIndex - bIndex;
    });
    setVisibleAlerts(sorted.slice(0, maxVisible));
  }, [unreadAlerts, maxVisible]);
  
  const getSeverityIcon = useCallback((severity: BugAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'low':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Bug className="w-5 h-5 text-gray-500" />;
    }
  }, []);
  
  const getSeverityBg = useCallback((severity: BugAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'low':
        return 'bg-blue-500/10 border-blue-500/30';
      default:
        return 'bg-gray-500/10 border-gray-500/30';
    }
  }, []);
  
  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }, []);
  
  const handleDismiss = (alert: BugAlert) => {
    dismissAlert(alert.id);
  };
  
  const handleAcknowledge = (alert: BugAlert) => {
    acknowledgeAlert(alert.id);
    markAsRead(alert.id);
  };
  
  if (activeAlerts.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 max-w-md">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`
            relative overflow-hidden rounded-lg border shadow-2xl animate-slide-in
            ${getSeverityBg(alert.severity)}
            backdrop-blur-sm
            transition-all duration-300
            ${expandedAlert === alert.id ? 'w-96' : 'w-80'}
          `}
        >
          {/* Header */}
          <div 
            className="flex items-start gap-3 p-4 cursor-pointer"
            onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getSeverityIcon(alert.severity)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span 
                  className="text-xs font-bold uppercase px-2 py-0.5 rounded"
                  style={{ 
                    backgroundColor: BUG_ALERT_STATUS_COLORS[alert.severity],
                    color: '#fff',
                  }}
                >
                  {alert.severity}
                </span>
                <span className="text-xs text-gray-400 capitalize">
                  {alert.category}
                </span>
              </div>
              
              <h4 className="font-semibold text-white mt-1 truncate">
                {alert.title}
              </h4>
              
              <p className="text-sm text-gray-300 mt-1 line-clamp-2">
                {alert.description}
              </p>
              
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(alert.created_at)}
                </span>
                {alert.reported_by_username && (
                  <span>by {alert.reported_by_username}</span>
                )}
              </div>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss(alert);
              }}
              className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          
          {/* Expanded Details */}
          {expandedAlert === alert.id && (
            <div className="px-4 pb-4 pl-12 space-y-3 animate-fade-in">
              {alert.error_message && (
                <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                  <p className="text-xs font-semibold text-red-400 mb-1">Error</p>
                  <p className="text-xs text-red-300 font-mono break-all">
                    {alert.error_message}
                  </p>
                </div>
              )}
              
              {alert.page_url && (
                <div className="text-xs text-gray-400">
                  <span className="font-semibold">URL: </span>
                  <span className="font-mono truncate">{alert.page_url}</span>
                </div>
              )}
              
              {alert.stack_trace && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                    Stack Trace
                  </summary>
                  <pre className="mt-2 p-2 bg-black/50 rounded overflow-x-auto text-gray-300 font-mono text-[10px] whitespace-pre-wrap">
                    {alert.stack_trace}
                  </pre>
                </details>
              )}
              
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleAcknowledge(alert)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-xs font-medium transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Acknowledge
                </button>
                <button
                  onClick={() => {
                    handleDismiss(alert);
                    setExpandedAlert(null);
                  }}
                  className="flex-1 px-3 py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 rounded text-xs font-medium transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          
          {/* Progress bar for critical alerts */}
          {alert.severity === 'critical' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
          )}
        </div>
      ))}
      
      {/* Show indicator if there are more alerts */}
      {unreadAlerts.length > maxVisible && (
        <button
          onClick={() => {
            // Could navigate to bug alerts page
            console.log('Navigate to bug alerts');
          }}
          className="self-center px-4 py-2 bg-gray-800/90 hover:bg-gray-700/90 text-white text-xs rounded-full shadow-lg transition-colors"
        >
          +{unreadAlerts.length - maxVisible} more alerts
        </button>
      )}
    </div>
  );
}

export default BugAlertPopup;
