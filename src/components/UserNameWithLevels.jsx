// src/components/UserNameWithLevels.jsx
import React from "react";
import { useUserLevels } from "@/hooks/useUserLevels";
import LevelBadge from "./levels/LevelBadge";

export default function UserNameWithLevels({ userId, username, showBothLevels = false, className = "" }) {
  const { levels, loading } = useUserLevels();

  // If we're showing a different user's levels, we need to fetch their levels
  // For now, we'll use the current user's levels, but you could extend this
  // to fetch any user's levels by adding a userId parameter to the hook

  const currentUserLevels = levels;
  const isCurrentUser = !userId || userId === levels?.user_id;

  if (loading) {
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
        {isCurrentUser && currentUserLevels && (
          <>
            <LevelBadge type="buyer" level={currentUserLevels.buyer_level} />
            {showBothLevels && <LevelBadge type="stream" level={currentUserLevels.stream_level} />}
          </>
        )}
      </div>
    </div>
  );
}