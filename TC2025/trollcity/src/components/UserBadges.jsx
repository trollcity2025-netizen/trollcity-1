import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const UserBadges = ({ badges = [], size = "sm" }) => {
  if (!badges || badges.length === 0) {
    return null;
  }

  const badgeConfig = {
    'OG': {
      name: 'OG',
      color: 'bg-gradient-to-r from-yellow-400 to-orange-500',
      icon: '👑',
      tooltip: 'Original Gangster - Joined before Dec 31, 2025'
    },
    'TROLL_OFFICER': {
      name: 'Troll Officer',
      color: 'bg-gradient-to-r from-blue-500 to-purple-600',
      icon: '🎖️',
      tooltip: 'Troll Officer - Community Moderator'
    },
    'VIP': {
      name: 'VIP',
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
      icon: '💎',
      tooltip: 'Very Important Player'
    },
    'STREAMER': {
      name: 'Streamer',
      color: 'bg-gradient-to-r from-red-500 to-pink-500',
      icon: '📺',
      tooltip: 'Content Creator'
    }
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base"
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => {
          const config = badgeConfig[badge] || {
            name: badge,
            color: 'bg-gray-600',
            icon: '🏷️',
            tooltip: badge
          };

          return (
            <Tooltip key={badge}>
              <TooltipTrigger asChild>
                <span
                  className={`inline-flex items-center gap-1 rounded-full ${config.color} text-white font-semibold ${sizeClasses[size]} cursor-pointer hover:scale-105 transition-transform`}
                >
                  <span>{config.icon}</span>
                  <span>{config.name}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{config.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

export default UserBadges;