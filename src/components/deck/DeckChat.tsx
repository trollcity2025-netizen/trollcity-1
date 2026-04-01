import React, { useRef, useEffect, useState } from 'react';
import { useDeckStore, DeckChatMessage } from '../../stores/deckStore';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
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
  } = useDeckStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Subscribe to real-time chat when live
  useEffect(() => {
    if (!streamConfig.streamId || !streamConfig.isLive) return;

    const channel = supabase
      .channel(`deck-chat-${streamConfig.streamId}`)
      .on('broadcast', { event: 'chat-message' }, (payload) => {
        const msg = payload.payload as DeckChatMessage;
        addChatMessage(msg);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamConfig.streamId, streamConfig.isLive, addChatMessage]);

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

    // Broadcast to phone and viewers
    if (streamConfig.streamId) {
      const channel = supabase.channel(`deck-chat-${streamConfig.streamId}`);
      await channel.send({
        type: 'broadcast',
        event: 'chat-message',
        payload: chatMsg,
      });
    }

    // Also send via BroadcastChannel to phone
    try {
      const bc = new BroadcastChannel('trollcity-deck-sync');
      bc.postMessage({ type: 'deck-chat-send', payload: chatMsg });
      bc.close();
    } catch {
      // ignore
    }

    setSending(false);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="deck-chat">
      {/* Chat status bar */}
      <div style={{
        padding: '8px 14px',
        background: 'var(--deck-bg-secondary)',
        borderBottom: '1px solid var(--deck-border)',
        fontSize: 11,
        color: 'var(--deck-text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>
          <MessageSquare size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {chatMessages.length} messages
        </span>
        {streamConfig.isLive && (
          <span style={{ color: 'var(--deck-success)' }}>Live Chat Active</span>
        )}
        {!streamConfig.isLive && (
          <span>Chat will activate when you go live</span>
        )}
      </div>

      {/* Messages */}
      <div className="deck-chat-messages">
        {chatMessages.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 40,
            color: 'var(--deck-text-muted)',
            fontSize: 12,
          }}>
            <MessageSquare size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div>No messages yet.</div>
            {streamConfig.isLive
              ? 'Chat messages from your viewers will appear here.'
              : 'Go live to start receiving chat messages.'}
          </div>
        )}
        {chatMessages.map((msg) => (
          <div key={msg.id} className="deck-chat-message">
            {msg.isSystem ? (
              <div className="deck-chat-system">{msg.message}</div>
            ) : (
              <>
                <span className={`deck-chat-username ${msg.isModerator ? 'mod' : ''}`}>
                  {msg.username}
                  {msg.isModerator && ' '}
                </span>
                <span className="deck-chat-message-text">{msg.message}</span>
                <span style={{ fontSize: 9, color: 'var(--deck-text-muted)', marginLeft: 6 }}>
                  {formatTime(msg.timestamp)}
                </span>
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="deck-chat-input-area">
        <input
          className="deck-input"
          type="text"
          placeholder={streamConfig.isLive ? 'Send a message as host...' : 'Go live to chat'}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          disabled={!streamConfig.isLive}
          maxLength={500}
        />
        <button
          className="deck-btn deck-btn-primary deck-btn-sm"
          onClick={handleSendMessage}
          disabled={!streamConfig.isLive || !chatInput.trim() || sending}
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
        <button
          className="deck-btn deck-btn-ghost deck-btn-sm"
          onClick={clearChat}
          title="Clear chat"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
