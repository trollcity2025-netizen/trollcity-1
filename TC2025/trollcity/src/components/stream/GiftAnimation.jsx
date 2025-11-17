import React from "react";

export default function GiftAnimation({ gift }) {
  if (!gift) return null;
  return (
    <div className="fixed bottom-4 right-4 px-3 py-2 rounded bg-pink-600/20 border border-pink-600/30 text-pink-200 text-sm">
      🎁 {gift?.name || "Gift"}
    </div>
  );
}

