// src/components/levels/StreamLevelOverlay.jsx
import React from "react";
import { useXPStore } from "@/stores/useXPStore";
import LevelBadge from "./LevelBadge";

export default function StreamLevelOverlay() {
  const { buyerLevel, streamLevel, isLoading } = useXPStore();

  if (isLoading) return null;

  return (
    <div className="pointer-events-none absolute top-2 right-2 z-30 flex flex-col items-end gap-1">
      <div className="pointer-events-auto bg-black/70 border border-purple-600 rounded-full px-3 py-1 flex items-center gap-2">
        <span className="text-[10px] text-gray-300 uppercase tracking-wide">
          Supporter
        </span>
        <LevelBadge type="buyer" level={buyerLevel} />
      </div>
      <div className="pointer-events-auto bg-black/70 border border-green-600 rounded-full px-3 py-1 flex items-center gap-2">
        <span className="text-[10px] text-gray-300 uppercase tracking-wide">
          Broadcast
        </span>
        <LevelBadge type="stream" level={streamLevel} />
      </div>
    </div>
  );
}
