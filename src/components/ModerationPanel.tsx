import { useState } from "react";
import {
  Shield,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import api from "../lib/api";

interface ModerationPanelProps {
  room: any; // LiveKit Room
  targetUserId: string;
  roomId: string;
}

export default function ModerationPanel({ room, targetUserId, roomId }: ModerationPanelProps) {
  const [open, setOpen] = useState(false);

  const handleBan = async () => {
    try {
      await api.post("/moderation/ban", { userId: targetUserId });
      room?.disconnectParticipant(targetUserId);
    } catch (error) {
      console.error("Ban failed:", error);
    }
  };

  const handleShadowBan = async () => {
    try {
      await api.post("/moderation/shadow-ban", { userId: targetUserId });
    } catch (error) {
      console.error("Shadow ban failed:", error);
    }
  };

  const handleKick = () => {
    room?.disconnectParticipant(targetUserId);
  };

  const handleMute = () => {
    room?.localParticipant.setParticipantPermissions(targetUserId, {
      canPublishAudio: true
    });
  };

  const handleGiftFreeze = async () => {
    try {
      await api.post("/moderation/gift-freeze", { userId: targetUserId });
    } catch (error) {
      console.error("Gift freeze failed:", error);
    }
  };

  const handleChatPurge = async () => {
    try {
      await api.post("/moderation/chat-purge", { roomId });
    } catch (error) {
      console.error("Chat purge failed:", error);
    }
  };

  const handleDisableStream = async () => {
    try {
      await api.post("/moderation/disable-stream", { roomId });
      room?.disconnect();
    } catch (error) {
      console.error("Disable stream failed:", error);
    }
  };

  const handleCourtSummon = async () => {
    try {
      await api.post("/court/summon", {
        userId: targetUserId,
        fromRoom: roomId
      });
    } catch (error) {
      console.error("Court summon failed:", error);
    }
  };

  const handleEvidenceCapture = async () => {
    try {
      await api.post("/moderation/evidence", {
        roomId,
        targetUserId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Evidence capture failed:", error);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()} className="fixed right-4 bottom-24 z-50 w-56">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-[#1a0f2e] border border-purple-700 text-white shadow-lg"
      >
        <div className="flex items-center gap-2">
          <Shield size={18} />
          <span className="font-semibold">Moderation</span>
        </div>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>

      {/* Actions */}
      {open && (
        <div className="mt-2 space-y-2 bg-[#0c0818] p-2 rounded-xl border border-purple-800">
          <Action label="Ban User" color="bg-red-700" onClick={handleBan} />
          <Action label="Shadow Ban" color="bg-amber-700" onClick={handleShadowBan} />
          <Action label="Kick" color="bg-yellow-600" onClick={handleKick} />
          <Action label="Mute" color="bg-gray-700" onClick={handleMute} />
          <Action label="Gift Freeze" color="bg-fuchsia-700" onClick={handleGiftFreeze} />
          <Action label="Chat Purge" color="bg-blue-700" onClick={handleChatPurge} />
          <Action label="Disable Stream" color="bg-red-900" onClick={handleDisableStream} />
          <Action label="Court Summon" color="bg-purple-700" onClick={handleCourtSummon} />
          <Action label="Evidence Capture" color="bg-emerald-700" onClick={handleEvidenceCapture} />
        </div>
      )}
    </div>
  );
}

function Action({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 rounded-md text-white text-sm font-medium ${color} hover:opacity-90`}
    >
      {label}
    </button>
  );
}