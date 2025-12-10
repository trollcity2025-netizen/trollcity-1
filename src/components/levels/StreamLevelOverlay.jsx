// src/components/levels/StreamLevelOverlay.jsx
import React from "react";
import { useUserLevels } from "@/hooks/useUserLevels";
import LevelBadge from "./LevelBadge";

export default function StreamLevelOverlay() {
  const { levels } = useUserLevels();

  if (!levels) return null;

  return (
    <div className="absolute top-2 right-2 z-30 flex flex-col items-end gap-1">
      <div className="bg-black/60 backdrop-blur-sm border border-purple-600 rounded-full px-3 py-1 flex items-center gap-2">
        <span className="text-[10px] text-gray-300 uppercase tracking-wide">
          Supporter
        </span>
        <LevelBadge type="buyer" level={levels.buyer_level} />
      </div>
      <div className="bg-black/60 backdrop-blur-sm border border-green-600 rounded-full px-3 py-1 flex items-center gap-2">
        <span className="text-[10px] text-gray-300 uppercase tracking-wide">
          Broadcast
        </span>
        <LevelBadge type="stream" level={levels.stream_level} />
      </div>
    </div>
  );
}