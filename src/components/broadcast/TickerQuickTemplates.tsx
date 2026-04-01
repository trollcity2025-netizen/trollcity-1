import React from 'react';
import { cn } from '../../lib/utils';
import { TICKER_TEMPLATES, TickerTemplate, CATEGORY_COLORS } from '../../types/ticker';

interface TickerQuickTemplatesProps {
  onSelect: (template: TickerTemplate, isPriority?: boolean) => void;
}

export default function TickerQuickTemplates({ onSelect }: TickerQuickTemplatesProps) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
        Quick Templates
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {TICKER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            onContextMenu={(e) => {
              e.preventDefault();
              onSelect(template, true);
            }}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-left transition-all',
              'bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15',
              'active:scale-95 group'
            )}
            title="Click to send | Right-click to pin"
          >
            <span className="text-sm shrink-0">{template.icon}</span>
            <span className="text-[10px] font-bold text-white/70 group-hover:text-white truncate">
              {template.label}
            </span>
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0 ml-auto"
              style={{
                backgroundColor: CATEGORY_COLORS[template.category],
                opacity: 0.6,
              }}
            />
          </button>
        ))}
      </div>
      <p className="text-[8px] text-slate-600 italic">
        Right-click any template to send as pinned priority message
      </p>
    </div>
  );
}
