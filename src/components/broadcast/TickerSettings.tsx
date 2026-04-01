import React from 'react';
import { cn } from '../../lib/utils';
import { useTickerStore } from '../../stores/tickerStore';
import {
  TickerPosition,
  TickerSpeed,
  TickerTheme,
  TickerMode,
} from '../../types/ticker';

interface TickerSettingsProps {
  onSettingsChange: (settings: Record<string, any>) => void;
}

export default function TickerSettingsPanel({ onSettingsChange }: TickerSettingsProps) {
  const { settings, setSettings } = useTickerStore();

  const updateSetting = (key: string, value: any) => {
    const partial = { [key]: value };
    setSettings(partial);
    onSettingsChange(partial);
  };

  return (
    <div className="space-y-3">
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
        Ticker Settings
      </p>

      {/* Mode Toggle */}
      <SettingRow label="Mode">
        <SegmentedControl
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'auto', label: 'Auto' },
          ]}
          value={settings.mode}
          onChange={(v) => updateSetting('mode', v as TickerMode)}
        />
      </SettingRow>

      {/* Position */}
      <SettingRow label="Position">
        <SegmentedControl
          options={[
            { value: 'top', label: 'Top' },
            { value: 'bottom', label: 'Bottom' },
            { value: 'floating', label: 'Float' },
          ]}
          value={settings.position}
          onChange={(v) => updateSetting('position', v as TickerPosition)}
        />
      </SettingRow>

      {/* Speed */}
      <SettingRow label="Speed">
        <SegmentedControl
          options={[
            { value: 'slow', label: 'Slow' },
            { value: 'medium', label: 'Med' },
            { value: 'fast', label: 'Fast' },
          ]}
          value={settings.speed}
          onChange={(v) => updateSetting('speed', v as TickerSpeed)}
        />
      </SettingRow>

      {/* Theme */}
      <SettingRow label="Theme">
        <SegmentedControl
          options={[
            { value: 'neon', label: 'Neon' },
            { value: 'minimal', label: 'Min' },
            { value: 'luxury', label: 'Lux' },
            { value: 'glitch', label: 'Glitch' },
          ]}
          value={settings.theme}
          onChange={(v) => updateSetting('theme', v as TickerTheme)}
        />
      </SettingRow>

      {/* Opacity */}
      <SettingRow label="Opacity">
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={settings.opacity}
            onChange={(e) => updateSetting('opacity', parseFloat(e.target.value))}
            className="flex-1 h-1 accent-cyan-500 bg-white/10 rounded-full appearance-none cursor-pointer"
          />
          <span className="text-[10px] text-slate-400 font-mono w-8 text-right">
            {Math.round(settings.opacity * 100)}%
          </span>
        </div>
      </SettingRow>

      {/* Enable/Disable */}
      <SettingRow label="Enabled">
        <button
          onClick={() => updateSetting('is_enabled', !settings.is_enabled)}
          className={cn(
            'relative w-10 h-5 rounded-full transition-colors',
            settings.is_enabled ? 'bg-cyan-500/40' : 'bg-white/10'
          )}
        >
          <div
            className={cn(
              'absolute top-0.5 w-4 h-4 rounded-full transition-all',
              settings.is_enabled
                ? 'left-5 bg-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.4)]'
                : 'left-0.5 bg-slate-500'
            )}
          />
        </button>
      </SettingRow>
    </div>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-slate-400 font-medium w-14 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center bg-black/40 rounded-lg border border-white/5 overflow-hidden flex-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all',
            value === opt.value
              ? 'bg-cyan-500/20 text-cyan-300'
              : 'text-slate-500 hover:text-slate-300'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
