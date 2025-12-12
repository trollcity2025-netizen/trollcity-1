import React, { useState, useEffect } from 'react';
import { Crown, Shield } from 'lucide-react';

interface AuthorityPresenceBadgeProps {
  type: 'admin' | 'lead_officer' | 'officer';
  showPulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const AuthorityPresenceBadge: React.FC<AuthorityPresenceBadgeProps> = ({
  type,
  showPulse = true,
  size = 'sm'
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!showPulse) return;

    // Pulse every 3 seconds
    const interval = setInterval(() => {
      setIsVisible(prev => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, [showPulse]);

  const getBadgeConfig = () => {
    switch (type) {
      case 'admin':
        return {
          icon: Crown,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/30',
          borderColor: 'border-yellow-500/50',
          label: 'Admin'
        };
      case 'lead_officer':
        return {
          icon: Shield,
          color: 'text-purple-400',
          bgColor: 'bg-purple-900/30',
          borderColor: 'border-purple-500/50',
          label: 'Lead Officer'
        };
      case 'officer':
        return {
          icon: Shield,
          color: 'text-red-400',
          bgColor: 'bg-red-900/30',
          borderColor: 'border-red-500/50',
          label: 'Officer'
        };
      default:
        return {
          icon: Shield,
          color: 'text-gray-400',
          bgColor: 'bg-gray-900/30',
          borderColor: 'border-gray-500/50',
          label: 'Authority'
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const containerClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1 rounded-full border
        ${config.bgColor} ${config.borderColor} ${containerClasses[size]}
        ${showPulse && !isVisible ? 'opacity-50' : 'opacity-100'}
        transition-opacity duration-1000
      `}
    >
      <Icon className={`${sizeClasses[size]} ${config.color}`} />
      <span className={`font-semibold ${config.color}`}>
        {config.label}
      </span>
      {showPulse && (
        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
      )}
    </div>
  );
};

export default AuthorityPresenceBadge;