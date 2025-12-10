// src/components/levels/LevelBadge.jsx
import React from "react";
import { getBuyerMeta, getStreamMeta } from "@/lib/levelsConfig";

export default function LevelBadge({ type, level }) {
  const meta = type === "buyer" ? getBuyerMeta(level) : getStreamMeta(level);

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
      <span className="mr-1">{meta.icon}</span>
      <span>{meta.name}</span>
      <span className="ml-1 text-[10px] opacity-80">Lv.{level}</span>
    </div>
  );
}