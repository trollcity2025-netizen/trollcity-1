import React from "react";

export default function JoinRequests({ requests = [], onApprove, onReject }) {
  if (!requests?.length) {
    return <div className="text-gray-400 text-sm">No join requests</div>;
  }
  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div key={r.id} className="flex items-center justify-between bg-[#0a0a0f] border border-[#2a2a3a] rounded p-2 text-sm">
          <div className="text-gray-300">{r.username || r.user_id || r.id}</div>
          <div className="flex gap-2">
            <button className="px-2 py-1 rounded bg-green-600 text-white" onClick={() => onApprove && onApprove(r)}>Approve</button>
            <button className="px-2 py-1 rounded bg-red-600 text-white" onClick={() => onReject && onReject(r)}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

