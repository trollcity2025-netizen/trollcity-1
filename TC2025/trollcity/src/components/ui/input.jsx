import React from "react";

export function Input({ className = "", ...props }) {
  return (
    <input
      className={`bg-[#0a0a0f] border border-[#2a2a3a] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 ${className}`}
      {...props}
    />
  );
}
