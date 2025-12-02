import React from "react";

interface EmpireBadgeProps {
  empireRole?: string | null;
}

export const EmpireBadge: React.FC<EmpireBadgeProps> = ({ empireRole }) => {
  if (empireRole !== "partner") return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-lg shadow-purple-900/40 border border-purple-300/40">
      👑 Empire Partner
    </span>
  );
};

