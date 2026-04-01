import React, { useState } from 'react';
import { DeckAddon } from '../../stores/deckStore';
import { X, Check } from 'lucide-react';

interface AddonEditModalProps {
  addon: DeckAddon;
  onSave: (addon: DeckAddon) => void;
  onClose: () => void;
}

export default function AddonEditModal({ addon, onSave, onClose }: AddonEditModalProps) {
  const [label, setLabel] = useState(addon.label);
  const [width, setWidth] = useState(addon.width);
  const [height, setHeight] = useState(addon.height);
  const [settings, setSettings] = useState<Record<string, unknown>>({ ...addon.settings });

  const updateSetting = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave({ ...addon, label, width, height, settings });
  };

  const renderTypeSettings = () => {
    switch (addon.type) {
      case 'text-overlay':
        return (
          <>
            <Field label="Text">
              <input
                className="deck-input"
                value={(settings.text as string) || ''}
                onChange={(e) => updateSetting('text', e.target.value)}
                placeholder="Enter overlay text"
              />
            </Field>
            <Field label="Font Size">
              <input
                className="deck-input"
                type="number"
                value={(settings.fontSize as number) || 18}
                onChange={(e) => updateSetting('fontSize', parseInt(e.target.value, 10))}
                min={8}
                max={72}
              />
            </Field>
            <Field label="Color">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={(settings.color as string) || '#ffffff'}
                  onChange={(e) => updateSetting('color', e.target.value)}
                  style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: 12, color: 'var(--deck-text-muted)' }}>
                  {(settings.color as string) || '#ffffff'}
                </span>
              </div>
            </Field>
            <Field label="Font Weight">
              <select
                className="deck-select"
                value={(settings.fontWeight as string) || 'bold'}
                onChange={(e) => updateSetting('fontWeight', e.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="lighter">Light</option>
              </select>
            </Field>
          </>
        );

      case 'viewer-count':
        return (
          <>
            <Field label="Prefix Text">
              <input
                className="deck-input"
                value={(settings.prefix as string) || 'Viewers:'}
                onChange={(e) => updateSetting('prefix', e.target.value)}
                placeholder="Viewers:"
              />
            </Field>
            <Field label="Show Icon">
              <ToggleSwitch
                value={(settings.showIcon as boolean) ?? true}
                onChange={(v) => updateSetting('showIcon', v)}
              />
            </Field>
          </>
        );

      case 'timer':
        return (
          <>
            <Field label="Format">
              <select
                className="deck-select"
                value={(settings.format as string) || 'HH:MM:SS'}
                onChange={(e) => updateSetting('format', e.target.value)}
              >
                <option value="HH:MM:SS">00:00:00 (Hours:Minutes:Seconds)</option>
                <option value="MM:SS">00:00 (Minutes:Seconds)</option>
              </select>
            </Field>
            <Field label="Show Label">
              <ToggleSwitch
                value={(settings.showLabel as boolean) ?? true}
                onChange={(v) => updateSetting('showLabel', v)}
              />
            </Field>
          </>
        );

      case 'alert-box':
        return (
          <>
            <Field label="Display Duration (seconds)">
              <input
                className="deck-input"
                type="number"
                value={(settings.duration as number) || 5}
                onChange={(e) => updateSetting('duration', parseInt(e.target.value, 10))}
                min={1}
                max={30}
              />
            </Field>
            <Field label="Show Gift Alerts">
              <ToggleSwitch
                value={(settings.showGifts as boolean) ?? true}
                onChange={(v) => updateSetting('showGifts', v)}
              />
            </Field>
            <Field label="Show Follow Alerts">
              <ToggleSwitch
                value={(settings.showFollows as boolean) ?? true}
                onChange={(v) => updateSetting('showFollows', v)}
              />
            </Field>
            <Field label="Show Raid Alerts">
              <ToggleSwitch
                value={(settings.showRaids as boolean) ?? true}
                onChange={(v) => updateSetting('showRaids', v)}
              />
            </Field>
          </>
        );

      case 'music-label':
        return (
          <>
            <Field label="Song Name">
              <input
                className="deck-input"
                value={(settings.songName as string) || ''}
                onChange={(e) => updateSetting('songName', e.target.value)}
                placeholder="Song title"
              />
            </Field>
            <Field label="Artist Name">
              <input
                className="deck-input"
                value={(settings.artistName as string) || ''}
                onChange={(e) => updateSetting('artistName', e.target.value)}
                placeholder="Artist name"
              />
            </Field>
            <Field label="Show Music Note Icon">
              <ToggleSwitch
                value={(settings.showNote as boolean) ?? true}
                onChange={(v) => updateSetting('showNote', v)}
              />
            </Field>
          </>
        );

      case 'logo':
        return (
          <>
            <Field label="Image URL">
              <input
                className="deck-input"
                value={(settings.url as string) || ''}
                onChange={(e) => updateSetting('url', e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </Field>
            <Field label="Opacity">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={(settings.opacity as number) || 0.8}
                  onChange={(e) => updateSetting('opacity', parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 12, color: 'var(--deck-text-muted)', minWidth: 30 }}>
                  {Math.round(((settings.opacity as number) || 0.8) * 100)}%
                </span>
              </div>
            </Field>
            <Field label="Size">
              <select
                className="deck-select"
                value={(settings.size as string) || 'medium'}
                onChange={(e) => updateSetting('size', e.target.value)}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </Field>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: 16,
    }}
      onClick={onClose}
    >
      <div
        className="deck-card"
        style={{
          width: '100%',
          maxWidth: 400,
          maxHeight: '80vh',
          overflowY: 'auto',
          margin: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="deck-card-header">
          <span className="deck-card-title">Edit: {addon.label}</span>
          <button
            className="deck-btn deck-btn-ghost deck-btn-sm"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        {/* Common fields */}
        <Field label="Label">
          <input
            className="deck-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Overlay name"
          />
        </Field>

        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="Width (%)">
            <input
              className="deck-input"
              type="number"
              value={width}
              onChange={(e) => setWidth(Math.max(5, Math.min(100, parseInt(e.target.value, 10))))}
              min={5}
              max={100}
            />
          </Field>
          <Field label="Height (%)">
            <input
              className="deck-input"
              type="number"
              value={height}
              onChange={(e) => setHeight(Math.max(3, Math.min(100, parseInt(e.target.value, 10))))}
              min={3}
              max={100}
            />
          </Field>
        </div>

        {/* Type-specific settings */}
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--deck-border)',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--deck-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 10,
          }}>
            Settings
          </div>
          {renderTypeSettings()}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            className="deck-btn deck-btn-primary"
            onClick={handleSave}
            style={{ flex: 1 }}
          >
            <Check size={14} />
            Save Changes
          </button>
          <button
            className="deck-btn deck-btn-ghost"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="deck-label">{label}</label>
      {children}
    </div>
  );
}

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        background: value ? 'var(--deck-accent)' : 'var(--deck-border)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s ease',
      }}
    >
      <div style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: 'white',
        position: 'absolute',
        top: 3,
        left: value ? 23 : 3,
        transition: 'left 0.2s ease',
      }} />
    </button>
  );
}
