import { useState } from "react";
import { X, Eye, EyeOff, Gift, Shield, Ban, AlertCircle, UserPlus, Gavel } from "lucide-react";

interface UserActionMenuProps {
  user: {
    name: string;
    role?: "admin" | "lead_troll_officer" | "troll_officer" | "user";
  };
  userRole?: "admin" | "lead_troll_officer" | "troll_officer" | "user";
  onClose: () => void;
  onGift?: (amount: number) => void;
  onKick?: () => void;
  onReport?: () => void;
  onFollow?: () => void;
  onSummon?: () => void;
}

export default function UserActionsMenu({
  user,
  userRole = "user",
  onClose,
  onGift,
  onKick,
  onReport,
  onFollow,
  onSummon,
}: UserActionMenuProps) {
  const [showGiftAmount, setShowGiftAmount] = useState(false);
  const [giftAmount, setGiftAmount] = useState(100);
  const [hideRoles, setHideRoles] = useState(false);

  const isOfficer = ["admin", "lead_troll_officer", "troll_officer"].includes(user.role || "");
  const isCurrentUserOfficer = ["admin", "lead_troll_officer", "troll_officer"].includes(userRole);

  const handleGiftSend = () => {
    onGift?.(giftAmount);
    setShowGiftAmount(false);
    setGiftAmount(100);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-sm w-full purple-neon">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold">{user.name}</h3>
            {!hideRoles && user.role && user.role !== "user" && (
              <span className="text-xs text-purple-300 font-semibold uppercase">
                {user.role.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition"
          >
            <X size={20} />
          </button>
        </div>

        {showGiftAmount ? (
          <div className="space-y-3 mb-4">
            <label className="text-sm font-bold block">Gift Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={giftAmount}
                onChange={(e) => setGiftAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 bg-gray-800 text-white rounded px-3 py-2"
              />
              <button
                onClick={handleGiftSend}
                className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-bold transition"
              >
                Send
              </button>
            </div>
            <button
              onClick={() => setShowGiftAmount(false)}
              className="w-full px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            <button
              onClick={() => setShowGiftAmount(true)}
              className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-bold transition flex items-center justify-center gap-2"
            >
              <Gift size={16} />
              Send Gift
            </button>

            <button
              onClick={onFollow}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold transition flex items-center justify-center gap-2"
            >
              <UserPlus size={16} />
              Follow
            </button>

            {isCurrentUserOfficer && !isOfficer && (
              <>
                <button
                  onClick={onKick}
                  className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded font-bold transition flex items-center justify-center gap-2 text-sm"
                >
                  <Ban size={16} />
                  Kick from Stream
                </button>

                <button
                  onClick={onReport}
                  className="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded font-bold transition flex items-center justify-center gap-2 text-sm"
                >
                  <AlertCircle size={16} />
                  Report User
                </button>

                <button
                  onClick={onSummon}
                  className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded font-bold transition flex items-center justify-center gap-2 text-sm"
                >
                  <Gavel size={16} />
                  Summon to Troll Court
                </button>
              </>
            )}

            {isCurrentUserOfficer && (
              <button
                onClick={() => setHideRoles(!hideRoles)}
                className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded font-bold transition flex items-center justify-center gap-2 text-sm"
              >
                {hideRoles ? <Eye size={16} /> : <EyeOff size={16} />}
                {hideRoles ? "Show Roles" : "Hide Roles"}
              </button>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}
