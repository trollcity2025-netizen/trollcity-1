import React, { useState, useCallback } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import {
  Shield, VolumeX, Volume2, VideoOff, Video, MessageSquare, MessageSquareOff,
  Lock, Eye, Loader2, Users, Radio, Unlock
} from 'lucide-react';

export default function DeckModeration() {
  const { streamConfig, sendToDeck } = useDeckStore();
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [chatDisabled, setChatDisabled] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [slowModeSeconds, setSlowModeSeconds] = useState(5);
  const [followersOnly, setFollowersOnly] = useState(false);
  const [emoteOnly, setEmoteOnly] = useState(false);
  const [seatsLocked, setSeatsLocked] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const sendCommand = useCallback(async (command: string, payload?: Record<string, unknown>) => {
    await sendToDeck({
      type: 'deck-command',
      command,
      payload,
    });
  }, [sendToDeck]);

  const handleToggle = async (action: string) => {
    setLoading(action);

    switch (action) {
      case 'mute-mic':
        setMicMuted(!micMuted);
        await sendCommand(micMuted ? 'unmute-mic' : 'mute-mic');
        break;
      case 'mute-camera':
        setCameraOff(!cameraOff);
        await sendCommand(cameraOff ? 'unmute-camera' : 'mute-camera');
        break;
      case 'disable-chat':
        setChatDisabled(!chatDisabled);
        await sendCommand('disable-chat', { disabled: !chatDisabled });
        break;
      case 'slow-mode':
        setSlowMode(!slowMode);
        await sendCommand('slow-mode', { enabled: !slowMode, seconds: slowModeSeconds });
        break;
      case 'followers-only':
        setFollowersOnly(!followersOnly);
        await sendCommand('followers-only', { enabled: !followersOnly });
        break;
      case 'emote-only':
        setEmoteOnly(!emoteOnly);
        await sendCommand('emote-only', { enabled: !emoteOnly });
        break;
      case 'toggle-seats-lock':
        setSeatsLocked(!seatsLocked);
        await sendCommand('toggle-seats-lock');
        break;
      case 'end-stream':
        await sendCommand('end-stream');
        break;
    }

    setLoading(null);
  };

  const isLive = streamConfig.isLive;

  return (
    <div className="deck-panel-body">
      {/* Connection warning */}
      {!isLive && (
        <div className="deck-card" style={{ borderColor: 'var(--deck-warning)', textAlign: 'center' }}>
          <p style={{ color: 'var(--deck-warning)', fontSize: 12, margin: 0 }}>
            Start a broadcast first to use stream controls.
          </p>
        </div>
      )}

      {/* Quick mod actions */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">
            <Shield size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Stream Controls
          </span>
          {isLive && (
            <span style={{ fontSize: 10, color: 'var(--deck-success)' }}>
              Stream ID: {streamConfig.streamId?.slice(0, 8)}...
            </span>
          )}
        </div>
        <div className="deck-mod-actions">
          <button
            className={`deck-mod-btn ${micMuted ? 'active' : ''}`}
            onClick={() => handleToggle('mute-mic')}
            disabled={loading === 'mute-mic' || !isLive}
          >
            {loading === 'mute-mic' ? <Loader2 size={14} className="animate-spin" /> :
              micMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {micMuted ? 'Mic Muted' : 'Mute Mic'}
          </button>

          <button
            className={`deck-mod-btn ${cameraOff ? 'active' : ''}`}
            onClick={() => handleToggle('mute-camera')}
            disabled={loading === 'mute-camera' || !isLive}
          >
            {loading === 'mute-camera' ? <Loader2 size={14} className="animate-spin" /> :
              cameraOff ? <VideoOff size={14} /> : <Video size={14} />}
            {cameraOff ? 'Camera Off' : 'Camera Off'}
          </button>

          <button
            className={`deck-mod-btn ${chatDisabled ? 'active' : ''}`}
            onClick={() => handleToggle('disable-chat')}
            disabled={loading === 'disable-chat' || !isLive}
          >
            {loading === 'disable-chat' ? <Loader2 size={14} className="animate-spin" /> :
              chatDisabled ? <MessageSquareOff size={14} /> : <MessageSquare size={14} />}
            {chatDisabled ? 'Chat Off' : 'Disable Chat'}
          </button>

          <button
            className={`deck-mod-btn ${slowMode ? 'active' : ''}`}
            onClick={() => handleToggle('slow-mode')}
            disabled={loading === 'slow-mode' || !isLive}
          >
            {loading === 'slow-mode' ? <Loader2 size={14} className="animate-spin" /> :
              <Lock size={14} />}
            {slowMode ? `Slow (${slowModeSeconds}s)` : 'Slow Mode'}
          </button>

          <button
            className={`deck-mod-btn ${seatsLocked ? 'active' : ''}`}
            onClick={() => handleToggle('toggle-seats-lock')}
            disabled={loading === 'toggle-seats-lock' || !isLive}
          >
            {loading === 'toggle-seats-lock' ? <Loader2 size={14} className="animate-spin" /> :
              seatsLocked ? <Lock size={14} /> : <Unlock size={14} />}
            {seatsLocked ? 'Seats Locked' : 'Lock Seats'}
          </button>

          <button
            className="deck-mod-btn deck-mod-btn-danger"
            onClick={() => handleToggle('end-stream')}
            disabled={loading === 'end-stream' || !isLive}
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
          <StatusRow label="Camera" active={!cameraOff} onLabel="Live" offLabel="Off" />
          <StatusRow label="Chat" active={!chatDisabled} onLabel="Enabled" offLabel="Disabled" />
          <StatusRow label="Slow Mode" active={slowMode} onLabel={`${slowModeSeconds}s delay`} offLabel="Off" />
          <StatusRow label="Seats Locked" active={seatsLocked} onLabel="Locked" offLabel="Open" />
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
