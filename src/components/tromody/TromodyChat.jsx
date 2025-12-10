// src/components/tromody/TromodyChat.jsx
import React, { useState } from "react";

export default function TromodyChat() {
  const [messages, setMessages] = useState([
    { user: "Viewer1", text: "Let's go FunnyTrollA! 😂" },
    { user: "Viewer2", text: "Nah JokesterB got this 💀" },
  ]);

  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { user: "You", text: input }]);
    setInput("");
  };

  return (
    <div className="bg-black border border-gray-700 rounded-lg h-64 flex flex-col">
      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-sm">
        {messages.map((msg, i) => (
          <div key={i}>
            <button className="text-purple-300 hover:underline"
              onClick={() => alert(`Open ${msg.user} profile`)}
            >
              {msg.user}
            </button>
            : <span className="text-gray-300">{msg.text}</span>
          </div>
        ))}
      </div>

      <div className="p-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-gray-800 p-2 rounded-md text-white text-sm"
          placeholder="Type your message…"
        />
        <button
          onClick={sendMessage}
          className="bg-purple-600 hover:bg-purple-700 px-3 rounded-md text-sm"
        >
          Send
        </button>
      </div>
    </div>
  );
}