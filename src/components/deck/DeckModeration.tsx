import React, { useState } from 'react';
import {
  Shield, VolumeX, Volume2, MessageSquare, MessageSquareOff,
  Lock, Eye, Loader2, Users, Radio
} from 'lucide-react';

export default function DeckModeration() {
  const [micMuted, setMicMuted] = useState(false);
  const [chatDisabled, setChatDisabled] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [slowModeSeconds, setSlowModeSeconds] = useState(5);
  const [followersOnly, setFollowersOnly] = useState(false);
  const [emoteOnly, setEmoteOnly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleToggle = async (action: string) => {
    setLoading(action);
    // Simulate broadcast to phone
    try {
      const bc = new BroadcastChannel('trollcity-deck-sync');
      bc.postMessage({
        type: 'deck-mod-action',
        payload: { action, timestamp: Date.now() },
      });
      bc.close();
    } catch {
      // ignore
    }

    switch (action) {
      case 'mute-mic':
        setMicMuted(!micMuted);
        break;
      case 'disable-chat':
        setChatDisabled(!chatDisabled);
        break;
      case 'slow-mode':
        setSlowMode(!slowMode);
        break;
      case 'followers-only':
        setFollowersOnly(!followersOnly);
        break;
      case 'emote-only':
        setEmoteOnly(!emoteOnly);
        break;
    }

    // Small delay for feedback
    await new Promise((r) => setTimeout(r, 300));
    setLoading(null);
  };

  return (
    <div className="deck-panel-body">
      {/* Quick mod actions */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">
            <Shield size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Stream Controls
          </span>
        </div>
        <div className="deck-mod-actions">
          <button
            className={`deck-mod-btn ${micMuted ? 'active' : ''}`}
            onClick={() => handleToggle('mute-mic')}
            disabled={loading === 'mute-mic'}
          >
            {loading === 'mute-mic' ? <Loader2 size={14} className="animate-spin" /> :
              micMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {micMuted ? 'Mic Muted' : 'Mute Mic'}
          </button>

          <button
            className={`deck-mod-btn ${chatDisabled ? 'active' : ''}`}
            onClick={() => handleToggle('disable-chat')}
            disabled={loading === 'disable-chat'}
          >
            {loading === 'disable-chat' ? <Loader2 size={14} className="animate-spin" /> :
              chatDisabled ? <MessageSquareOff size={14} /> : <MessageSquare size={14} />}
            {chatDisabled ? 'Chat Off' : 'Disable Chat'}
          </button>

          <button
            className={`deck-mod-btn ${slowMode ? 'active' : ''}`}
            onClick={() => handleToggle('slow-mode')}
            disabled={loading === 'slow-mode'}
          >
            {loading === 'slow-mode' ? <Loader2 size={14} className="animate-spin" /> :
              <Lock size={14} />}
            {slowMode ? `Slow (${slowModeSeconds}s)` : 'Slow Mode'}
          </button>

          <button
            className={`deck-mod-btn ${followersOnly ? 'active' : ''}`}
            onClick={() => handleToggle('followers-only')}
            disabled={loading === 'followers-only'}
          >
            {loading === 'followers-only' ? <Loader2 size={14} className="animate-spin" /> :
              <Users size={14} />}
            {followersOnly ? 'Followers Only' : 'Followers Only'}
          </button>

          <button
            className={`deck-mod-btn ${emoteOnly ? 'active' : ''}`}
            onClick={() => handleToggle('emote-only')}
            disabled={loading === 'emote-only'}
          >
            {loading === 'emote-only' ? <Loader2 size={14} className="animate-spin" /> :
              <Eye size={14} />}
            {emoteOnly ? 'Emote Only' : 'Emote Only'}
          </button>

          <button
            className="deck-mod-btn"
            onClick={() => handleToggle('end-stream')}
            disabled={loading === 'end-stream'}
          >
            {loading === 'end-stream' ? <Loader2 size={14} className="animate-spin" /> :
              <Radio size={14} />}
            End Stream
          </button>
        </div>
      </div>

      {/* Slow mode settings */}
      {slowMode && (
        <div className="deck-card">
          <div className="deck-card-header">
            <span className="deck-card-title">Slow Mode Settings</span>
          </div>
          <label className="deck-label">Delay (seconds)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[3, 5, 10, 15, 30].map((s) => (
              <button
                key={s}
                className={`deck-btn ${slowModeSeconds === s ? 'deck-btn-primary' : 'deck-btn-ghost'} deck-btn-sm`}
                onClick={() => setSlowModeSeconds(s)}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mod status */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">Moderation Status</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <StatusRow label="Microphone" active={!micMuted} onLabel="Live" offLabel="Muted" />
          <StatusRow label="Chat" active={!chatDisabled} onLabel="Enabled" offLabel="Disabled" />
          <StatusRow label="Slow Mode" active={slowMode} onLabel={`${slowModeSeconds}s delay`} offLabel="Off" />
          <StatusRow label="Followers Only" active={followersOnly} onLabel="Active" offLabel="Off" />
          <StatusRow label="Emote Only" active={emoteOnly} onLabel="Active" offLabel="Off" />
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, active, onLabel, offLabel }: {
  label: string;
  active: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 12,
    }}>
      <span style={{ color: 'var(--deck-text-secondary)' }}>{label}</span>
      <span style={{
        color: active ? 'var(--deck-success)' : 'var(--deck-text-muted)',
        fontWeight: 500,
      }}>
        {active ? onLabel : offLabel}
      </span>
    </div>
  );
}
