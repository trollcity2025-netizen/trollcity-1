import React, { useState, useRef, useCallback } from 'react';
import { useDeckStore, DeckAddon } from '../../stores/deckStore';
import AddonEditModal from './AddonEditModal';
import {
  Layout, Trash2, GripVertical, Eye, EyeOff, Pencil,
  Type, Image, BarChart2, Clock, Music, MessageCircle
} from 'lucide-react';

const ADDON_TYPES = [
  { type: 'text-overlay', label: 'Text Overlay', icon: Type },
  { type: 'viewer-count', label: 'Viewer Count', icon: BarChart2 },
  { type: 'timer', label: 'Stream Timer', icon: Clock },
  { type: 'alert-box', label: 'Alert Box', icon: MessageCircle },
  { type: 'music-label', label: 'Music Label', icon: Music },
  { type: 'logo', label: 'Logo/Watermark', icon: Image },
];

export default function DeckAddonsEditor() {
  const { streamConfig, addAddon, removeAddon, updateAddon, syncToPhone } = useDeckStore();
  const addons = streamConfig.addons;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingAddon, setEditingAddon] = useState<DeckAddon | null>(null);

  const handleAddAddon = (type: string, label: string) => {
    const defaults: Record<string, Record<string, unknown>> = {
      'text-overlay': { text: 'Hello World', fontSize: 18, color: '#ffffff', fontWeight: 'bold' },
      'viewer-count': { prefix: 'Viewers:', showIcon: true },
      'timer': { format: 'HH:MM:SS', showLabel: true },
      'alert-box': { duration: 5, showGifts: true, showFollows: true },
      'music-label': { songName: '', artistName: '', showNote: true },
      'logo': { url: '', opacity: 0.8, size: 'medium' },
    };
    const newAddon: DeckAddon = {
      id: `addon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      label,
      x: 10 + Math.random() * 60,
      y: 10 + Math.random() * 60,
      width: type === 'logo' ? 12 : 22,
      height: type === 'logo' ? 12 : 8,
      settings: defaults[type] || {},
      visible: true,
      order: addons.length,
    };
    addAddon(newAddon);
    setEditingAddon(newAddon);
  };

  const handleDragStart = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const addon = addons.find((a) => a.id === id);
    if (!addon) return;

    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    setDraggingId(id);
    setDragOffset({ x: mouseX - addon.x, y: mouseY - addon.y });
  }, [addons]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggingId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    const addon = addons.find((a) => a.id === draggingId);
    if (!addon) return;

    const newX = Math.max(0, Math.min(100 - addon.width, mouseX - dragOffset.x));
    const newY = Math.max(0, Math.min(100 - addon.height, mouseY - dragOffset.y));

    updateAddon({ ...addon, x: newX, y: newY });
  }, [draggingId, dragOffset, addons, updateAddon]);

  const handleDragEnd = useCallback(() => {
    if (draggingId) {
      setDraggingId(null);
      syncToPhone();
    }
  }, [draggingId, syncToPhone]);

  const handleToggleVisible = (addon: DeckAddon) => {
    updateAddon({ ...addon, visible: !addon.visible });
    syncToPhone();
  };

  const handleDelete = (id: string) => {
    removeAddon(id);
    syncToPhone();
  };

  const handleEditSave = (updated: DeckAddon) => {
    updateAddon(updated);
    syncToPhone();
    setEditingAddon(null);
  };

  return (
    <div className="deck-panel-body">
      {/* Canvas */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">Layout Preview</span>
          <span className="deck-card-subtitle">Drag to position</span>
        </div>
        <div
          ref={canvasRef}
          className="deck-addons-canvas"
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          {/* Grid overlay */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08 }}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <line
                key={`v${i}`}
                x1={`${((i + 1) * 100) / 10}%`}
                y1="0"
                x2={`${((i + 1) * 100) / 10}%`}
                y2="100%"
                stroke="white"
                strokeWidth="0.5"
              />
            ))}
            {Array.from({ length: 9 }).map((_, i) => (
              <line
                key={`h${i}`}
                x1="0"
                y1={`${((i + 1) * 100) / 10}%`}
                x2="100%"
                y2={`${((i + 1) * 100) / 10}%`}
                stroke="white"
                strokeWidth="0.5"
              />
            ))}
          </svg>

          {/* Addons */}
          {addons.filter((a) => a.visible).map((addon) => (
            <div
              key={addon.id}
              className={`deck-addon-item ${draggingId === addon.id ? 'dragging' : ''}`}
              style={{
                left: `${addon.x}%`,
                top: `${addon.y}%`,
                width: `${addon.width}%`,
                height: `${addon.height}%`,
              }}
              onMouseDown={(e) => handleDragStart(e, addon.id)}
              onDoubleClick={() => setEditingAddon(addon)}
              title="Double-click to edit"
            >
              <GripVertical size={12} style={{ marginRight: 4, opacity: 0.5 }} />
              {addon.label}
            </div>
          ))}

          {addons.length === 0 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--deck-text-muted)',
              fontSize: 13,
            }}>
              <Layout size={20} style={{ marginRight: 8 }} />
              Add overlays to customize your stream
            </div>
          )}
        </div>
      </div>

      {/* Add addon buttons */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">Add Overlay</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {ADDON_TYPES.map((at) => (
            <button
              key={at.type}
              className="deck-btn deck-btn-ghost deck-btn-sm"
              onClick={() => handleAddAddon(at.type, at.label)}
              style={{ flexDirection: 'column', height: 'auto', padding: '10px 6px', gap: 4 }}
            >
              <at.icon size={16} />
              <span style={{ fontSize: 10 }}>{at.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Addon list */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">Active Overlays ({addons.length})</span>
        </div>
        <div className="deck-addons-list">
          {addons.map((addon) => (
            <div key={addon.id} className="deck-addon-list-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GripVertical size={14} color="var(--deck-text-muted)" style={{ cursor: 'grab' }} />
                <span className="deck-addon-name">{addon.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="deck-btn deck-btn-ghost deck-btn-sm"
                  onClick={() => setEditingAddon(addon)}
                  title="Edit settings"
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="deck-btn deck-btn-ghost deck-btn-sm"
                  onClick={() => handleToggleVisible(addon)}
                  title={addon.visible ? 'Hide' : 'Show'}
                >
                  {addon.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button
                  className="deck-btn deck-btn-ghost deck-btn-sm"
                  onClick={() => handleDelete(addon.id)}
                  title="Remove"
                  style={{ color: 'var(--deck-danger)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {addons.length === 0 && (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--deck-text-muted)', fontSize: 12 }}>
              No overlays added yet. Use the buttons above to add overlays.
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editingAddon && (
        <AddonEditModal
          addon={editingAddon}
          onSave={handleEditSave}
          onClose={() => setEditingAddon(null)}
        />
      )}
    </div>
  );
}
