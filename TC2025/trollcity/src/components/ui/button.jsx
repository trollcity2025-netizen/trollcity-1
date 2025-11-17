import React from "react";

const VARIANTS = {
  default: "bg-blue-600 text-white hover:bg-blue-700",
  outline: "border border-[#2a2a3a] text-gray-300 bg-transparent hover:bg-[#2a2a3a] hover:text-white",
};

export function Button({ className = "", variant = "default", children, ...props }) {
  const base =
    "inline-flex items-center justify-center h-9 px-4 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variantClass = VARIANTS[variant] || VARIANTS.default;
  return (
    <button className={`${base} ${variantClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
