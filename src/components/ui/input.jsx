// src/components/ui/input.jsx
import React from "react";

export function Input({
  className = "",
  type = "text",
  disabled,
  onChange,
  ...props
}) {
  const baseClasses = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <input
      type={type}
      className={`${baseClasses} ${className}`}
      disabled={disabled}
      onChange={onChange}
      {...props}
    />
  );
}
