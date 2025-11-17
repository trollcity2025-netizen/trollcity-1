import React from "react";

export function Skeleton({ className = "", width, height }) {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;
  return (
    <div
      className={`animate-pulse bg-[#1a1a24] border border-[#2a2a3a] rounded ${className}`}
      style={style}
    />
  );
}

