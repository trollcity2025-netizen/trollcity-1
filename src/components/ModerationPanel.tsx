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
    const reason = window.prompt("Enter ban reason:");
    if (!reason) return;

    try {
      await api.post(api.endpoints.moderation.takeAction, { 
        action: 'take_action',
        action_type: 'ban_user',
        target_user_id: targetUserId,
        reason,
        ban_duration_hours: 24 // Default to 24h
      });
      room?.disconnectParticipant(targetUserId);
    } catch (error) {
      console.error("Ban failed:", error);
      alert("Failed to ban user");
    }
  };

  const handleShadowBan = async () => {
    const reason = window.prompt("Enter shadow ban reason:");
    if (!reason) return;

    try {
      await api.post(api.endpoints.moderation.shadowBan, { 
        targetUserId,
        streamId: roomId,
        reason,
        durationMinutes: 60
      });
    } catch (error) {
      console.error("Shadow ban failed:", error);
      alert("Failed to shadow ban user");
    }
  };

  const handleKick = async () => {
    const reason = window.prompt("Enter kick reason (optional):") || "Kicked by moderator";
    
    // Disconnect first for immediate effect
    room?.disconnectParticipant(targetUserId);

    try {
        await api.post(api.endpoints.moderation.logEvent, {
            actionType: 'kick',
            targetUserId,
            streamId: roomId,
            reason
        });
    } catch (error) {
        console.error("Failed to log kick:", error);
    }
  };

  const handleMute = async () => {
    room?.localParticipant.setParticipantPermissions(targetUserId, {
      canPublishAudio: false,
      canPublishData: true,
      canSubscribe: true
    });
    
    try {
        await api.post(api.endpoints.moderation.logEvent, {
            actionType: 'mute',
            targetUserId,
            streamId: roomId,
            reason: "Muted by moderator"
        });
    } catch (error) {
        console.error("Failed to log mute:", error);
    }
  };

  const handleGiftFreeze = async () => {
    const reason = window.prompt("Enter gift freeze reason:");
    if (!reason) return;

    try {
      await api.post(api.endpoints.moderation.takeAction, { 
        action: 'take_action',
        action_type: 'gift_freeze',
        target_user_id: targetUserId,
        reason
      });
    } catch (error) {
      console.error("Gift freeze failed:", error);
      alert("Failed to freeze gifts");
    }
  };

  const handleChatPurge = async () => {
    if (!window.confirm("Are you sure you want to purge chat?")) return;

    try {
      await api.post(api.endpoints.moderation.takeAction, { 
        action: 'take_action',
        action_type: 'chat_purge',
        stream_id: roomId,
        reason: 'Manual purge'
      });
    } catch (error) {
      console.error("Chat purge failed:", error);
      alert("Failed to purge chat");
    }
  };

  const handleDisableStream = async () => {
    const reason = window.prompt("Enter stream disable reason:");
    if (!reason) return;

    try {
      await api.post(api.endpoints.moderation.takeAction, { 
        action: 'take_action',
        action_type: 'suspend_stream',
        stream_id: roomId,
        reason
      });
      room?.disconnect();
    } catch (error) {
      console.error("Disable stream failed:", error);
      alert("Failed to disable stream");
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
    <>
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
          <Action label="Ban IP Address" color="bg-red-900" onClick={async () => {
            // Fetch IP first if possible
             const { data } = await supabase
              .from('user_profiles')
              .select('last_known_ip')
              .eq('id', targetUserId)
              .single()
            
            if (data?.last_known_ip) {
              setTargetIP(data.last_known_ip)
            }
            setShowIPBanModal(true)
          }} />
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

    {showIPBanModal && (
      <IPBanModal 
        isOpen={showIPBanModal}
        onClose={() => {
          setShowIPBanModal(false);
          setTargetIP(null);
        }}
        onSuccess={() => {
          setShowIPBanModal(false);
          // Optional: disconnect user after IP ban
          room?.disconnectParticipant(targetUserId);
        }}
        targetUserId={targetUserId}
        targetIP={targetIP || undefined}
      />
    )}
    </>
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