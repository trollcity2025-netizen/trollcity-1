import React, { useState, useEffect, useCallback } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import {
  BROADCAST_CATEGORIES,
} from '../../config/broadcastCategories';
import {
  Play, Square, Tag, X, Plus, Smartphone, AlertTriangle, Loader2, QrCode
} from 'lucide-react';
import DeckStreamQuality from './DeckStreamQuality';
import DeckThemeSelector from './DeckThemeSelector';
import DeckPhonePair from './DeckPhonePair';

export default function DeckStreamSetup() {
  const {
    streamConfig,
    phoneLink,
    updateStreamConfig,
    triggerBroadcastStart,
    triggerBroadcastEnd,
  } = useDeckStore();

  const [title, setTitle] = useState(streamConfig.title);
  const [tagInput, setTagInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [startError, setStartError] = useState('');
  const [showPairModal, setShowPairModal] = useState(false);

  // Sync title changes
  useEffect(() => {
    setTitle(streamConfig.title);
  }, [streamConfig.title]);

  const handleTitleChange = useCallback((val: string) => {
    setTitle(val);
    updateStreamConfig({ title: val });
  }, [updateStreamConfig]);

  const handleCategoryChange = useCallback((cat: string) => {
    updateStreamConfig({ category: cat });
  }, [updateStreamConfig]);

  const tags = streamConfig.tags ?? [];

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    if (tags.length >= 5) return;
    if (tags.includes(tag)) return;
    updateStreamConfig({ tags: [...tags, tag] });
    setTagInput('');
  }, [tagInput, tags, updateStreamConfig]);

  const handleRemoveTag = useCallback((tag: string) => {
    updateStreamConfig({ tags: tags.filter((t) => t !== tag) });
  }, [tags, updateStreamConfig]);

  const handleStartBroadcast = async () => {
    setStartError('');
    setStarting(true);
    const result = await triggerBroadcastStart();
    if (!result.success) {
      setStartError(result.error || 'Failed to start broadcast');
    }
    setStarting(false);
  };

  const handleEndBroadcast = async () => {
    setEnding(true);
    await triggerBroadcastEnd();
    setEnding(false);
  };

  return (
    <div className="deck-panel-body">
      {/* Phone connection status */}
      <div className={`deck-phone-status ${phoneLink.status}`}>
        <div className="deck-phone-status-icon">
          {phoneLink.status === 'connected' ? <Smartphone size={20} /> : <AlertTriangle size={20} />}
        </div>
        <div>
          <div className="deck-phone-status-text">
            {phoneLink.status === 'connected'
              ? 'Phone Connected'
              : phoneLink.status === 'connecting'
              ? 'Connecting to Phone...'
              : 'Phone Not Connected'}
          </div>
          <div className="deck-phone-status-sub">
            {phoneLink.status === 'connected'
              ? 'Your phone is ready as the broadcast source device.'
              : 'Scan QR code with your phone to connect.'}
          </div>
        </div>
      </div>

      {/* Stream Title */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">Stream Title</span>
        </div>
        <input
          className="deck-input"
          type="text"
          placeholder="Enter your stream title..."
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          maxLength={100}
        />
        <div style={{ fontSize: 10, color: '#6b6585', marginTop: 4 }}>
          {title.length}/100 characters
        </div>
      </div>

      {/* Category */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">Category</span>
        </div>
        <select
          className="deck-select"
          value={streamConfig.category}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          {Object.entries(BROADCAST_CATEGORIES).map(([id, config]) => (
            <option key={id} value={id}>
              {config.icon} {config.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">Tags</span>
          <span className="deck-card-subtitle">{streamConfig.tags.length}/5</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="deck-input"
            type="text"
            placeholder="Add a tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            maxLength={20}
            style={{ flex: 1 }}
          />
          <button
            className="deck-btn deck-btn-ghost deck-btn-sm"
            onClick={handleAddTag}
            disabled={tags.length >= 5}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="deck-tags">
          {tags.map((tag) => (
            <span key={tag} className="deck-tag">
              <Tag size={10} />
              {tag}
              <button className="deck-tag-remove" onClick={() => handleRemoveTag(tag)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Stream Quality */}
      <DeckStreamQuality />

      {/* Theme */}
      <DeckThemeSelector />

      {/* Connect Phone via QR */}
      <div className="deck-card">
        <button
          className={`deck-btn ${phoneLink.status === 'connected' ? 'deck-btn-success' : 'deck-btn-primary'} deck-btn-block`}
          onClick={() => setShowPairModal(true)}
        >
          <QrCode size={14} />
          {phoneLink.status === 'connected' ? 'Phone Connected - Show QR' : 'Connect Phone via QR Code'}
        </button>
        <div style={{ fontSize: 10, color: 'var(--deck-text-muted)', textAlign: 'center', marginTop: 6 }}>
          QR code is unique to your account and expires after 24 hours
        </div>
      </div>

      {/* Broadcast controls */}
      <div className="deck-card" style={{ textAlign: 'center' }}>
        {startError && (
          <div className="deck-auth-error" style={{ marginBottom: 12 }}>
            {startError}
          </div>
        )}

        {!streamConfig.isLive ? (
          <button
            className="deck-btn deck-btn-success deck-btn-lg deck-btn-block deck-start-btn"
            onClick={handleStartBroadcast}
            disabled={starting || !title.trim() || phoneLink.status !== 'connected'}
          >
            {starting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {starting ? 'Starting Broadcast...' : 'Start Broadcast'}
          </button>
        ) : (
          <button
            className="deck-btn deck-btn-danger deck-btn-lg deck-btn-block deck-start-btn live"
            onClick={handleEndBroadcast}
            disabled={ending}
          >
            {ending ? <Loader2 size={18} className="animate-spin" /> : <Square size={18} />}
            {ending ? 'Ending...' : 'End Broadcast'}
          </button>
        )}

        {phoneLink.status !== 'connected' && !streamConfig.isLive && (
          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 8 }}>
            Connect your phone first to start broadcasting.
          </div>
        )}
      </div>

      {/* QR Pair Modal */}
      {showPairModal && (
        <DeckPhonePair onClose={() => setShowPairModal(false)} />
      )}
    </div>
  );
}
