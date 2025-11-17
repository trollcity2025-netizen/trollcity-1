import React from "react";

export default function AccessDenied({ message = "You do not have access to view this page." }) {
  return (
    <div className="p-6 border border-red-500/30 bg-red-500/10 rounded text-red-300">
      <p className="font-semibold">Access Denied</p>
      <p className="text-sm mt-1">{message}</p>
    </div>
  );
}

