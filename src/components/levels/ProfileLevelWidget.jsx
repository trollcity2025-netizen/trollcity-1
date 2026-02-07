// src/components/levels/ProfileLevelWidget.jsx
import React, { useEffect, useRef, useState } from "react";
import { useXPStore } from "@/stores/useXPStore";
import LevelBadge from "./LevelBadge";
import LevelUpModal from "./LevelUpModal";

export default function ProfileLevelWidget() {
  const { level, buyerLevel, streamLevel, isLoading } = useXPStore();
  const prevBuyerLevel = useRef(null);
  const prevStreamLevel = useRef(null);
  const prevMainLevel = useRef(null);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [showMainModal, setShowMainModal] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (
      prevBuyerLevel.current !== null &&
      buyerLevel > prevBuyerLevel.current
    ) {
      setShowBuyerModal(true);
    }
    if (
      prevStreamLevel.current !== null &&
      streamLevel > prevStreamLevel.current
    ) {
      setShowStreamModal(true);
    }
    
    if (
      prevMainLevel.current !== null &&
      level > prevMainLevel.current
    ) {
      setShowMainModal(true);
    }

    prevBuyerLevel.current = buyerLevel;
    prevStreamLevel.current = streamLevel;
    prevMainLevel.current = level;
  }, [level, buyerLevel, streamLevel, isLoading]);

  if (isLoading) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="text-sm text-gray-400 mb-1">Troll City Levels</div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">Troll Level</span>
        <LevelBadge type="main" level={level} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">Supporter Level</span>
        <LevelBadge type="buyer" level={buyerLevel} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">Broadcast Level</span>
        <LevelBadge type="stream" level={streamLevel} />
      </div>

      {showMainModal && (
        <LevelUpModal
          type="main"
          oldLevel={prevMainLevel.current}
          newLevel={level}
          onClose={() => setShowMainModal(false)}
        />
      )}
      {showBuyerModal && (
        <LevelUpModal
          type="buyer"
          oldLevel={prevBuyerLevel.current}
          newLevel={buyerLevel}
          onClose={() => setShowBuyerModal(false)}
        />
      )}
      {showStreamModal && (
        <LevelUpModal
          type="stream"
          oldLevel={prevStreamLevel.current}
          newLevel={streamLevel}
          onClose={() => setShowStreamModal(false)}
        />
      )}
    </div>
  );
}