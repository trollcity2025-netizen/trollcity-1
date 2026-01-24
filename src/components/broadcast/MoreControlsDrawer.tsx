import React from 'react';
import { X, MessageSquare, Swords, Users, Settings } from 'lucide-react';

export interface MoreControlsConfig {
  showFlyingChats: boolean;
  enableBattles: boolean;
  theme: 'purple' | 'rgb';
}

interface MoreControlsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: MoreControlsConfig;
  onFlyingChatsToggle: (enabled: boolean) => void;
  onBattlesToggle: (enabled: boolean) => void;
  onAddGuest: () => void;
  onSettings: () => void;
  onThemeChange: (theme: 'purple' | 'rgb') => void;
  className?: string;
}

export default function MoreControlsDrawer({
  isOpen,
  onClose,
  config,
  onFlyingChatsToggle,
  onBattlesToggle,
  onAddGuest,
  onSettings,
  onThemeChange,
  className = ''
}: MoreControlsDrawerProps) {
  if (!isOpen) {
    return null;
  }

  const themeOptions = [
    { id: 'purple', label: 'Off', icon: '⚫' },
    { id: 'rgb', label: 'RGB', icon: '🌈' }
  ] as const;

  return (
    <>
      {/* Overlay */}
      <div className="broadcast-drawer-overlay" onClick={onClose} />

      {/* Drawer */}
      <div className={`broadcast-drawer ${className}`}>
        {/* Header */}
        <div className="broadcast-drawer-header">
          <h2 className="broadcast-drawer-title">Controls</h2>
          <button
            className="broadcast-drawer-close"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="broadcast-drawer-content">
          {/* Flying Chats Toggle */}
          <button
            className={`broadcast-drawer-item ${
              config.showFlyingChats ? 'active' : ''
            }`}
            onClick={() => onFlyingChatsToggle(!config.showFlyingChats)}
          >
            <MessageSquare className="broadcast-drawer-item-icon" />
            <span className="broadcast-drawer-item-label">Flying Chats</span>
            <div className="broadcast-drawer-item-toggle" />
          </button>

          {/* Battles Toggle */}
          <button
            className={`broadcast-drawer-item ${
              config.enableBattles ? 'active' : ''
            }`}
            onClick={() => onBattlesToggle(!config.enableBattles)}
          >
            <Swords className="broadcast-drawer-item-icon" />
            <span className="broadcast-drawer-item-label">Battles</span>
            <div className="broadcast-drawer-item-toggle" />
          </button>

          {/* Add Guest */}
          <button className="broadcast-drawer-item" onClick={onAddGuest}>
            <Users className="broadcast-drawer-item-icon" />
            <span className="broadcast-drawer-item-label">Add Guest</span>
          </button>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-purple-500/0 via-purple-500/20 to-purple-500/0 my-2" />

          {/* Theme Selection */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold text-gray-400 px-2">THEME</div>
            <div className="flex gap-2 px-2">
              {themeOptions.map((theme) => (
                <button
                  key={theme.id}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-6 border transition-all ${
                    config.theme === theme.id
                      ? 'bg-purple-500/30 border-purple-400/60 text-purple-200'
                      : 'bg-purple-500/10 border-purple-400/20 text-purple-300/70 hover:border-purple-400/40'
                  }`}
                  onClick={() =>
                    onThemeChange(theme.id as 'purple' | 'neon' | 'rgb')
                  }
                >
                  <span>{theme.icon}</span>
                  <span className="hidden sm:inline text-xs">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-purple-500/0 via-purple-500/20 to-purple-500/0 my-2" />

          {/* Settings */}
          <button className="broadcast-drawer-item" onClick={onSettings}>
            <Settings className="broadcast-drawer-item-icon" />
            <span className="broadcast-drawer-item-label">Broadcast Settings</span>
          </button>

          {/* Info Section */}
          <div className="mt-4 p-3 bg-purple-500/5 border border-purple-500/10 rounded-8 text-xs text-gray-400">
            <p className="font-semibold text-purple-300 mb-1">💡 Tips</p>
            <ul className="space-y-1 text-gray-400">
              <li>• Use Flying Chats for visual flair</li>
              <li>• Enable Battles for audience engagement</li>
              <li>• Change themes to match your vibe</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
