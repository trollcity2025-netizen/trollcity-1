import React from "react";

export function Label({ children, className = "", htmlFor }) {
  return (
    <label htmlFor={htmlFor} className={`text-gray-300 text-sm ${className}`}>
      {children}
    </label>
  );
}

