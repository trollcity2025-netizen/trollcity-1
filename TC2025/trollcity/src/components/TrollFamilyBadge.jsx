import React from "react";

export default function TrollFamilyBadge({ name = "Troll Family" }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-600/20 text-purple-300 border border-purple-600/30 text-xs">
      <span>👪</span>
      <span>{name}</span>
    </span>
  );
}

