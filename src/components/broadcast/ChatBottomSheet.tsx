import React, { useRef, useEffect, useState } from "react";
import { Send, Smile } from "lucide-react";
import { cn } from "../../lib/utils";
import { ChatMessage } from "../../types/broadcast";
import ProfileFrame from "../live/ProfileFrame";
import { getDiamondForLevel } from "../../types/liveStreaming";

interface ChatBottomSheetProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  className?: string;
  compact?: boolean;
  overlay?: boolean; // broadcast floating mode
}

export default function ChatBottomSheet({
  messages,
  onSendMessage,
  className,
  _compact = false,
  overlay = false,
}: ChatBottomSheetProps) {
  const [inputValue, setInputValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Scroll only if user near bottom
  const scrollToBottom = (smooth = true) => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    if (distanceFromBottom < 120) {
      endRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    onSendMessage(inputValue.trim());
    setInputValue("");

    setTimeout(() => scrollToBottom(false), 50);
  };

  return (
    <div
      className={cn(
        "flex flex-col w-full pointer-events-auto",
        overlay && "absolute bottom-0 left-0 right-0",
        className
      )}
    >
      {/* Messages */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 overflow-y-auto px-4 space-y-2",
          overlay
            ? "max-h-[40vh] pb-2"
            : "h-full",
        )}
      >
        {messages.map((msg) => {
          if (msg.type === "system") {
            return (
              <SystemMessage key={msg.id} msg={msg} />
            );
          }

          return <UserMessage key={msg.id} msg={msg} />;
        })}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div
        className={cn(
          "p-3 border-t border-white/10",
          overlay
            ? "bg-black/40 backdrop-blur-md"
            : "bg-zinc-900/60"
        )}
        style={{
          paddingBottom:
            "calc(env(safe-area-inset-bottom) + 12px)",
        }}
      >
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Say something..."
              className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-full py-2.5 pl-4 pr-10 text-white placeholder-white/50 text-sm focus:outline-none focus:border-pink-500/50 transition-colors"
            />

            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60"
            >
              <Smile size={18} />
            </button>
          </div>

          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center text-white shadow-lg disabled:opacity-50 active:scale-95 transition"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

function SystemMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex justify-center my-1 animate-fade-in-up">
      <div className="bg-black/30 backdrop-blur-sm rounded-full px-3 py-1 border border-white/5">
        <span className="text-[10px] text-white/70 italic">
          <span className="font-bold text-pink-400/80">
            {msg.user?.username || "Guest"}
          </span>{" "}
          joined the broadcast
        </span>
      </div>
    </div>
  );
}

function ChatDiamondAvatar({
  avatarUrl,
  username,
  level,
}: {
  avatarUrl: string;
  username: string;
  level: number;
}) {
  const tier = getDiamondForLevel(level);
  const showFrame = level >= 1;

  const glowStyle =
    tier.glow_color && tier.glow_intensity > 0
      ? { boxShadow: `0 0 ${tier.glow_intensity * 10}px ${tier.glow_color}` }
      : {};

  const diamondContent = (
    <div
      style={{
        width: 32,
        height: 32,
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        border: `2px solid ${tier.border_color}`,
        overflow: "hidden",
        position: "relative" as const,
        zIndex: 2,
        ...glowStyle,
      }}
    >
      <img
        src={avatarUrl}
        alt={username}
        className="w-full h-full object-cover"
        style={{
          transform: "rotate(45deg) scale(1.42)",
          width: "100%",
          height: "100%",
        }}
        draggable={false}
      />
    </div>
  );

  if (showFrame) {
    return (
      <div className="relative" style={{ width: 32, height: 32 }}>
        <div className="absolute inset-0 scale-[0.67]" style={{ zIndex: 1 }}>
          <ProfileFrame
            level={level}
            avatarUrl={avatarUrl}
            size="sm"
            username={username}
            showLevel={false}
          />
        </div>
        {diamondContent}
      </div>
    );
  }

  return diamondContent;
}

function UserMessage({ msg }: { msg: ChatMessage }) {
  const level = (msg.user as any)?.level ?? 0;
  const avatarUrl = msg.user?.avatar_url || msg.user_profiles?.avatar_url || "";
  const username = msg.user?.username || "User";

  return (
    <div className="flex items-start gap-2 animate-fade-in-up">
      {avatarUrl && (
        <div className="flex-shrink-0 mt-0.5">
          <ChatDiamondAvatar
            avatarUrl={avatarUrl}
            username={username}
            level={level}
          />
        </div>
      )}

      <div className="bg-black/30 backdrop-blur-sm rounded-2xl rounded-tl-sm px-3 py-1.5 max-w-[85%] border border-white/5">
        <span className="text-[11px] font-bold text-pink-400 block mb-0.5">
          {username}
        </span>

        <p className="text-sm text-white leading-snug break-words">
          {msg.content}
        </p>
      </div>
    </div>
  );
}