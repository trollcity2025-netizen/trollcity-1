import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useTickerStore } from '../../stores/tickerStore';
import { TickerCategory, TickerTemplate, CATEGORY_COLORS } from '../../types/ticker';
import TickerQuickTemplates from './TickerQuickTemplates';
import TickerSettingsPanel from './TickerSettings';
import {
  Send,
  Pin,
  Settings,
  X,
  Zap,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TickerControlPanelProps {
  onSendMessage: (
    content: string,
    category: TickerCategory,
    isPriority: boolean,
    tags: string[]
  ) => void;
  onBroadcastSettings: (settings: Record<string, any>) => void;
  onDeleteMessage: (id: string) => void;
  onClose?: () => void;
}

export default function TickerControlPanel({
  onSendMessage,
  onBroadcastSettings,
  onDeleteMessage,
  onClose,
}: TickerControlPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TickerCategory>('hype');
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showMessages, setShowMessages] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, settings, clearMessages } = useTickerStore();

  const handleSend = (isPriority = false) => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim(), selectedCategory, isPriority, []);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleTemplateSelect = (template: TickerTemplate, isPriority = false) => {
    onSendMessage(template.content, template.category, isPriority, [template.icon]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(false);
    }
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleSend(true);
    }
  };

  const categories: { value: TickerCategory; label: string; icon: string }[] = [
    { value: 'hype', label: 'Hype', icon: '🔥' },
    { value: 'recognition', label: 'Shout', icon: '👑' },
    { value: 'mission', label: 'Mission', icon: '🎯' },
    { value: 'announcement', label: 'News', icon: '🚨' },
    { value: 'monetization', label: 'Money', icon: '💎' },
  ];

  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-80 max-h-[70vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-cyan-400" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
            Ticker Control
          </span>
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              settings.is_enabled ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            )}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'w-7 h-7 rounded flex items-center justify-center transition-colors',
              showSettings ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-white'
            )}
            title="Settings"
          >
            <Settings size={12} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <TickerSettingsPanel onSettingsChange={onBroadcastSettings} />
              <div className="border-t border-white/5 mt-3 pt-3" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="space-y-2">
          {/* Category Selector */}
          <div className="flex items-center gap-1">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all',
                  selectedCategory === cat.value
                    ? 'text-white border'
                    : 'text-slate-500 hover:text-slate-300 bg-white/5'
                )}
                style={
                  selectedCategory === cat.value
                    ? {
                        backgroundColor: `${CATEGORY_COLORS[cat.value]}15`,
                        borderColor: `${CATEGORY_COLORS[cat.value]}33`,
                        color: CATEGORY_COLORS[cat.value],
                      }
                    : undefined
                }
              >
                <span className="text-xs">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Text Input */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type ticker message..."
              maxLength={200}
              className={cn(
                'w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 pr-20',
                'text-sm text-white placeholder:text-zinc-600',
                'focus:outline-none focus:border-cyan-500/30 transition-all'
              )}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                onClick={() => handleSend(true)}
                disabled={!inputValue.trim()}
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                  inputValue.trim()
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                    : 'text-zinc-700 cursor-not-allowed'
                )}
                title="Send as priority (pin)"
              >
                <Pin size={12} />
              </button>
              <button
                onClick={() => handleSend(false)}
                disabled={!inputValue.trim()}
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                  inputValue.trim()
                    ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                    : 'text-zinc-700 cursor-not-allowed'
                )}
                title="Send (Enter)"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
          <p className="text-[8px] text-slate-600">
            Enter to send | Shift+Enter for priority pin
          </p>
        </div>

        {/* Quick Templates */}
        <div>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
          >
            {showTemplates ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            Quick Templates
          </button>
          <AnimatePresence>
            {showTemplates && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-2"
              >
                <TickerQuickTemplates onSelect={handleTemplateSelect} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent Messages */}
        <div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowMessages(!showMessages)}
              className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
            >
              {showMessages ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              Recent ({messages.length})
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="flex items-center gap-1 text-[8px] text-red-400/60 hover:text-red-400 transition-colors"
              >
                <Trash2 size={9} />
                Clear All
              </button>
            )}
          </div>
          <AnimatePresence>
            {showMessages && messages.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-2 space-y-1 max-h-32 overflow-y-auto"
              >
                {messages.slice(0, 10).map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg group"
                  >
                    <div
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[msg.category] }}
                    />
                    <span className="text-[9px] text-white/60 truncate flex-1">
                      {msg.tags.join(' ')} {msg.content}
                    </span>
                    <button
                      onClick={() => onDeleteMessage(msg.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
