import { useState } from "react";
import { X, Eye, EyeOff, Gift, Ban, AlertCircle, UserPlus, Gavel, Mic, MicOff, Shield } from "lucide-react";

export interface UserActionsMenuProps {
  user: {
    name: string;
    role?: string;
  };
  userRole?: string;
  onClose: () => void;
  onGift?: (amount: number) => void;
  onKick?: () => void;
  onKickWithBan?: (duration: '5m' | '30m' | '1h' | 'permanent') => void;
  onReport?: () => void;
  onFollow?: () => void;
  onSummon?: () => void;
  onAssignOfficer?: () => void;
  onRemoveOfficer?: () => void;
  onMute?: () => void;
  onUnmute?: () => void;
  onBlock?: () => void;
  isBroadofficer?: boolean;
  isBroadcaster?: boolean;
  isCurrentUserBroadofficer?: boolean;
}

export default function UserActionsMenu({
  user,
  userRole = "user",
  onClose,
  onGift,
  onKick,
  onKickWithBan,
  onReport,
  onFollow,
  onSummon,
  onAssignOfficer,
  onRemoveOfficer,
  onMute,
  onUnmute,
  onBlock,
  isBroadofficer,
  isBroadcaster,
  isCurrentUserBroadofficer,
}: UserActionsMenuProps) {
  const [showGiftAmount, setShowGiftAmount] = useState(false);
  const [giftAmount, setGiftAmount] = useState(100);
  const [hideRoles, setHideRoles] = useState(false);

  const isTargetOfficer = ["admin", "lead_troll_officer", "troll_officer"].includes((user.role || "").toString());
  // Broadcaster is also an officer in their own stream context
  const isCurrentUserPrivileged = isBroadcaster || isCurrentUserBroadofficer || ["admin", "lead_troll_officer", "troll_officer"].includes((userRole || "user").toString());

  const canKick = (() => {
    // Cannot kick admins/officers
    if (isTargetOfficer) return false;
    // If target is Broadofficer, only Broadcaster can kick
    if (isBroadofficer) return isBroadcaster;
    // Otherwise everyone can kick (paid or free)
    return true;
  })();

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

            {canKick && (
              <>
                <button
                  onClick={onKick}
                  className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded font-bold transition flex items-center justify-center gap-2 text-sm"
                >
                  <Ban size={16} />
                  Kick from Stream {!isCurrentUserPrivileged && '(500 Coins)'}
                </button>

                {onKickWithBan && isCurrentUserPrivileged && (
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-wider text-gray-400 px-1">
                      Guest box rejoin timeout
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => onKickWithBan("5m")}
                        className="px-2 py-1 bg-red-700/80 hover:bg-red-600 rounded text-[11px] font-semibold"
                      >
                        Kick + 5m
                      </button>
                      <button
                        onClick={() => onKickWithBan("30m")}
                        className="px-2 py-1 bg-red-700/80 hover:bg-red-600 rounded text-[11px] font-semibold"
                      >
                        Kick + 30m
                      </button>
                      <button
                        onClick={() => onKickWithBan("1h")}
                        className="px-2 py-1 bg-red-700/80 hover:bg-red-600 rounded text-[11px] font-semibold"
                      >
                        Kick + 1h
                      </button>
                      <button
                        onClick={() => onKickWithBan("permanent")}
                        className="px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-[11px] font-semibold"
                      >
                        Kick + Perm
                      </button>
                    </div>
                  </div>
                )}

                {onMute && (
                  <button
                    onClick={onMute}
                    className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-bold transition flex items-center justify-center gap-2 text-sm"
                  >
                    <MicOff size={16} />
                    Mute (10m)
                  </button>
                )}

                {onUnmute && (
                  <button
                    onClick={onUnmute}
                    className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded font-bold transition flex items-center justify-center gap-2 text-sm"
                  >
                    <Mic size={16} />
                    Unmute
                  </button>
                )}

                {onBlock && (
                  <button
                    onClick={onBlock}
                    className="w-full px-3 py-2 bg-red-800 hover:bg-red-900 rounded font-bold transition flex items-center justify-center gap-2 text-sm"
                  >
                    <Shield size={16} />
                    Block (24h)
                  </button>
                )}

                <button
                  onClick={onReport}
                  className="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded font-bold transition flex items-center justify-center gap-2 text-sm"
                >
                  <AlertCircle size={16} />
                  Report User
                </button>

                {isCurrentUserPrivileged && (
                    <button
                    onClick={onSummon}
                    className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded font-bold transition flex items-center justify-center gap-2 text-sm"
                    >
                    <Gavel size={16} />
                    Summon to Troll Court
                    </button>
                )}
              </>
            )}

            {isCurrentUserPrivileged && (
              <button
                onClick={() => setHideRoles(!hideRoles)}
                className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded font-bold transition flex items-center justify-center gap-2 text-sm"
              >
                {hideRoles ? <Eye size={16} /> : <EyeOff size={16} />}
                {hideRoles ? "Show Roles" : "Hide Roles"}
              </button>
            )}

            {isBroadcaster && (
              <>
                {isBroadofficer ? (
                  <button
                    onClick={onRemoveOfficer}
                    className="w-full px-3 py-2 bg-red-900/50 hover:bg-red-900 rounded font-bold transition flex items-center justify-center gap-2 text-sm border border-red-700"
                  >
                    <UserPlus size={16} className="rotate-45" />
                    Remove Broadofficer
                  </button>
                ) : (
                  <button
                    onClick={onAssignOfficer}
                    className="w-full px-3 py-2 bg-purple-900/50 hover:bg-purple-900 rounded font-bold transition flex items-center justify-center gap-2 text-sm border border-purple-700"
                  >
                    <UserPlus size={16} />
                    Assign Broadofficer
                  </button>
                )}
              </>
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
