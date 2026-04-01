import React, { useEffect, useState } from 'react';
import { useDeckStore, DeckTheme } from '../../stores/deckStore';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { Palette, Lock, Check, Loader2 } from 'lucide-react';

const BUILTIN_THEMES: DeckTheme[] = [
  { id: 'default', name: 'Default', previewUrl: '', owned: true, active: true },
  { id: 'neon', name: 'Neon Glow', previewUrl: '', owned: false, active: false },
  { id: 'midnight', name: 'Midnight', previewUrl: '', owned: false, active: false },
  { id: 'gold', name: 'Gold Rush', previewUrl: '', owned: false, active: false },
  { id: 'cyber', name: 'Cyber Punk', previewUrl: '', owned: false, active: false },
  { id: 'ocean', name: 'Ocean Blue', previewUrl: '', owned: false, active: false },
  { id: 'fire', name: 'Fire Storm', previewUrl: '', owned: false, active: false },
  { id: 'arctic', name: 'Arctic Frost', previewUrl: '', owned: false, active: false },
];

export default function DeckThemeSelector() {
  const { user } = useAuthStore();
  const { themes, streamConfig, setThemes, activateTheme } = useDeckStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadThemes = async () => {
      if (!user?.id) return;
      setLoading(true);

      try {
        // Fetch user's owned themes from their purchases
        const { data: purchases } = await supabase
          .from('user_purchases')
          .select('item_id, item_type')
          .eq('user_id', user.id)
          .eq('item_type', 'broadcast_theme');

        const ownedThemeIds = new Set(purchases?.map((p) => p.item_id) || []);

        const themeList = BUILTIN_THEMES.map((t) => ({
          ...t,
          owned: t.id === 'default' || ownedThemeIds.has(t.id),
          active: streamConfig.themeId === t.id || (t.id === 'default' && !streamConfig.themeId),
        }));

        setThemes(themeList);
      } catch {
        // Use defaults if DB fails
        setThemes(BUILTIN_THEMES);
      } finally {
        setLoading(false);
      }
    };

    loadThemes();
  }, [user?.id, setThemes, streamConfig.themeId]);

  const handleActivate = (themeId: string) => {
    const theme = themes.find((t) => t.id === themeId);
    if (!theme?.owned) return;
    activateTheme(themeId);
  };

  if (loading) {
    return (
      <div className="deck-card" style={{ textAlign: 'center', padding: 30 }}>
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--deck-text-muted)' }} />
      </div>
    );
  }

  return (
    <div className="deck-card">
      <div className="deck-card-header">
        <span className="deck-card-title">
          <Palette size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Broadcast Theme
        </span>
        <span className="deck-card-subtitle">
          {themes.filter((t) => t.owned).length}/{themes.length} owned
        </span>
      </div>

      <div className="deck-theme-grid">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className={`deck-theme-card ${theme.active ? 'active' : ''} ${!theme.owned ? 'locked' : ''}`}
            onClick={() => handleActivate(theme.id)}
          >
            <div className="deck-theme-preview">
              {theme.id === 'default' ? '🎬' :
               theme.id === 'neon' ? '💜' :
               theme.id === 'midnight' ? '🌙' :
               theme.id === 'gold' ? '👑' :
               theme.id === 'cyber' ? '🤖' :
               theme.id === 'ocean' ? '🌊' :
               theme.id === 'fire' ? '🔥' :
               theme.id === 'arctic' ? '❄️' : '🎨'}
            </div>
            <div className="deck-theme-info">
              <div className="deck-theme-name">{theme.name}</div>
              <div className="deck-theme-status">
                {theme.active ? 'Active' : theme.owned ? 'Owned' : 'Locked - Buy in Coin Store'}
              </div>
            </div>
            {!theme.owned && (
              <div className="deck-theme-lock">
                <Lock size={12} color="var(--deck-text-muted)" />
              </div>
            )}
            {theme.active && (
              <div style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'var(--deck-success)',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Check size={14} color="white" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
