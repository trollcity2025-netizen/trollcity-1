// src/components/UserNameWithLevels.jsx
import React from "react";
import { useXPStore } from "@/stores/useXPStore";
import { useAuthStore } from "@/lib/store";
import LevelBadge from "./levels/LevelBadge";

export default function UserNameWithLevels({ userId, username, showBothLevels = false, className = "" }) {
  const { user } = useAuthStore();
  const { buyerLevel, streamLevel, isLoading } = useXPStore();

  // If we're showing a different user's levels, we need to fetch their levels
  // For now, we'll use the current user's levels if the ID matches
  
  const isCurrentUser = !userId || (user && userId === user.id);

  if (isLoading && isCurrentUser) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="animate-pulse bg-gray-700 rounded px-3 py-1 text-transparent">{username || "Loading..."}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="font-semibold text-white">{username}</span>

      {/* Show level badges */}
      <div className="flex gap-1">
        {isCurrentUser && (
          <>
            <LevelBadge type="buyer" level={buyerLevel} />
            {showBothLevels && <LevelBadge type="stream" level={streamLevel} />}
          </>
        )}
      </div>
    </div>
  );
}