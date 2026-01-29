import React from 'react';

export interface BroadcastTheme {
  id: string;
  name: string;
  image_url: string;
  description: string;
  price_coins?: number;
  slug?: string;
}

export default function BroadcastThemePicker({
  themes,
  selected,
  onSelect,
  ownedThemeIds
}: {
  themes: BroadcastTheme[];
  selected: string | null;
  onSelect: (id: string) => void;
  ownedThemeIds?: Set<string>;
}) {
  return (
    <div className="mb-4">
      <label htmlFor="broadcast-theme-select" className="block text-white font-semibold mb-2">Choose a Theme</label>
      <select
        id="broadcast-theme-select"
        value={selected || ''}
        onChange={e => onSelect(e.target.value)}
        className="w-full p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white"
      >
        <option value="">Default Theme</option>
        {themes.map(theme => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
    </div>
  );
}
