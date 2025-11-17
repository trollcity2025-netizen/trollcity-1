import React from "react";

export default function SystemHealthPanel({ results }) {
  const items = Array.isArray(results) ? results : [];
  return (
    <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded p-4 text-sm text-gray-300">
      <h4 className="text-white font-bold mb-2">System Health</h4>
      {items.length === 0 ? (
        <p className="text-gray-500">No health results</p>
      ) : (
        <ul className="space-y-1">
          {items.map((r, i) => (
            <li key={i} className="flex justify-between">
              <span>{r?.name || r?.service || `Check ${i + 1}`}</span>
              <span className={`font-semibold ${r?.ok ? "text-green-400" : "text-red-400"}`}>{r?.ok ? "OK" : "Fail"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

