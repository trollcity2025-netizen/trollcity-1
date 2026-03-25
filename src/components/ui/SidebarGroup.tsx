import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface SidebarGroupProps {
  title: string
  children: React.ReactNode
  isExpanded?: boolean
  onToggle?: () => void
  isCollapsed?: boolean
  highlight?: boolean
}

export default function SidebarGroup({
  title,
  children,
  isExpanded = false,
  onToggle,
  isCollapsed = false,
  highlight = false
}: SidebarGroupProps) {
  if (isCollapsed) {
    return (
      <div className="py-1.5 border-t border-white/[0.04] first:border-0 flex flex-col items-center gap-1.5">
        {children}
      </div>
    )
  }

  return (
    <div className="py-1.5 border-t border-white/[0.04] first:border-0">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition-all duration-200 rounded-lg mx-1 ${
          highlight
            ? 'text-white bg-gradient-to-r from-purple-500/[0.08] to-cyan-500/[0.08] border border-purple-500/[0.15]'
            : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
        }`}
      >
        <span className="flex-1 text-left">{title}</span>
        {highlight && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.4)] mr-2" />
        )}
        <motion.div
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 px-2 pt-1 pb-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
