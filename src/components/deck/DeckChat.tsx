import React, { useRef, useEffect, useState } from 'react';
import { useDeckStore, DeckChatMessage } from '../../stores/deckStore';
import { useAuthStore } from '../../lib/store';
import {
  MessageSquare, Send, Trash2, Loader2
} from 'lucide-react';

export default function DeckChat() {
  const { user } = useAuthStore();
  const {
    chatMessages,
    chatInput,
    streamConfig,
    addChatMessage,
    clearChat,
    setChatInput,
    sendToDeck,
  } = useDeckStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || !user) return;

    setSending(true);
    setChatInput('');

    const chatMsg: DeckChatMessage = {
      id: `deck-msg-${Date.now()}`,
      userId: user.id,
      username: useAuthStore.getState().profile?.username || 'Host',
      message: msg,
      timestamp: Date.now(),
      isModerator: true,
      isSystem: false,
    };

    addChatMessage(chatMsg);

    // Send message to phone to forward to broadcast chat
    await sendToDeck({
      type: 'deck-command',
      command: 'send-chat',
      payload: { message: msg, username: chatMsg.username },
    });

    setSending(false);
  };

  const isLive = streamConfig.isLive;

  return (
    <div className="deck-panel-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="deck-card" style={{ marginBottom: 8, flexShrink: 0 }}>
        <div className="deck-card-header">
          <span className="deck-card-title">
            <MessageSquare size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Stream Chat
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="deck-btn deck-btn-ghost deck-btn-sm"
              onClick={clearChat}
              title="Clear chat"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        {!isLive && (
          <div style={{ fontSize: 11, color: 'var(--deck-text-muted)', textAlign: 'center', padding: '8px 0' }}>
            Chat will show messages when you go live.
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 4px',
        minHeight: 0,
      }}>
        {chatMessages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 24,
            color: 'var(--deck-text-muted)',
            fontSize: 12,
          }}>
            {isLive ? 'Waiting for messages...' : 'No messages yet.'}
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              style={{
                padding: '6px 8px',
                marginBottom: 2,
                borderRadius: 6,
                background: msg.isSystem ? 'rgba(106, 0, 255, 0.08)' : 'transparent',
              }}
            >
              <span style={{
                color: msg.isSystem ? '#a855f7' : msg.isModerator ? '#22c55e' : 'var(--deck-accent)',
                fontWeight: 600,
                fontSize: 11,
                marginRight: 6,
              }}>
                {msg.isSystem ? 'SYS' : msg.isModerator ? 'MOD' : msg.username}
              </span>
              <span style={{ fontSize: 12, color: 'var(--deck-text)' }}>
                {msg.message}
              </span>
              <span style={{ fontSize: 9, color: 'var(--deck-text-muted)', marginLeft: 6 }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '8px 0 0',
        flexShrink: 0,
      }}>
        <input
          className="deck-input"
          type="text"
          placeholder={isLive ? 'Type a message...' : 'Go live to chat'}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !sending && handleSendMessage()}
          disabled={!isLive}
          style={{ flex: 1 }}
        />
        <button
          className="deck-btn deck-btn-primary deck-btn-sm"
          onClick={handleSendMessage}
          disabled={!chatInput.trim() || sending || !isLive}
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}
