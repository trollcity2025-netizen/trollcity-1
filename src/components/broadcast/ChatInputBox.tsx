import React, { useState, FormEvent } from 'react';
import clsx from 'clsx';

interface ChatInputBoxProps {
  sendMessage: (message: string) => void;
  isSendingMessage: boolean; // To disable input while sending
}

export const ChatInputBox: React.FC<ChatInputBoxProps> = ({ sendMessage, isSendingMessage }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isSendingMessage) {
      sendMessage(message.trim());
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 bg-gray-800 rounded-lg flex items-center gap-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Send a message..."
        className="flex-grow p-2 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isSendingMessage}
      />
      <button
        type="submit"
        className={clsx(
          "px-4 py-2 rounded-md font-semibold",
          isSendingMessage
            ? "bg-blue-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        )}
        disabled={isSendingMessage}
      >
        Send
      </button>
    </form>
  );
};
