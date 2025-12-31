import { useState, useEffect, useRef } from "react";
import { Send, Coins } from "lucide-react";

interface ChatBoxProps {
  onProfileClick?: (profile: { name: string }) => void;
  onCoinSend?: (user: string, amount: number) => void;
}

export default function ChatBox({ onProfileClick, onCoinSend }: ChatBoxProps) {
  const [messages, setMessages] = useState<Array<{
    id: number;
    user: string;
    message: string;
    timestamp: number;
  }>>([]);
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageTimersRef = useRef<Record<number, NodeJS.Timeout>>({});
  const [showCoinInput, setShowCoinInput] = useState<number | null>(null);
  const [coinAmount, setCoinAmount] = useState(10);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    messages.forEach((msg) => {
      if (!messageTimersRef.current[msg.id]) {
        messageTimersRef.current[msg.id] = setTimeout(() => {
          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          delete messageTimersRef.current[msg.id];
        }, 30000);
      }
    });

    return () => {
      Object.values(messageTimersRef.current).forEach(clearTimeout);
    };
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim() === "") return;

    const newMessage = {
      id: Date.now(),
      user: "You",
      message: inputValue,
      timestamp: Date.now(),
    };

    setMessages([...messages, newMessage]);
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 bg-gradient-to-b from-gray-900 to-black rounded-lg p-4 flex flex-col purple-neon min-h-0">
      <h3 className="text-sm font-bold mb-3">LIVE CHAT</h3>

      <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-0 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="text-xs animate-fadeIn rgb-neon rounded p-2 bg-gray-800/50 group hover:bg-gray-800/70 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={() => onProfileClick?.({ name: msg.user })}
                className="font-bold text-purple-300 hover:text-purple-200 transition-colors"
              >
                {msg.user}
              </button>
              <button
                onClick={() =>
                  setShowCoinInput(showCoinInput === msg.id ? null : msg.id)
                }
                className="text-yellow-400 hover:text-yellow-300 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Coins size={14} />
              </button>
            </div>
            <span className="text-gray-300">{msg.message}</span>

            {showCoinInput === msg.id && (
              <div className="mt-2 flex gap-2 items-center">
                <input
                  type="number"
                  value={coinAmount}
                  onChange={(e) =>
                    setCoinAmount(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-xs"
                  placeholder="Amount"
                />
                <button
                  onClick={() => {
                    onCoinSend?.(msg.user, coinAmount);
                    setShowCoinInput(null);
                    setCoinAmount(10);
                  }}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-1 rounded text-xs font-bold"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded px-3 py-2 text-sm focus:outline-none purple-neon transition-all"
        />
        <button
          onClick={handleSendMessage}
          className="bg-purple-600 hover:bg-purple-700 p-2 rounded purple-neon transition-colors"
        >
          <Send size={16} />
        </button>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
