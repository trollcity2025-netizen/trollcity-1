import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface SidebarGroupProps {
  title: string
  children: React.ReactNode
  defaultExpanded?: boolean
  isCollapsed?: boolean // Sidebar itself is collapsed
  highlight?: boolean
}

export default function SidebarGroup({ 
  title, 
  children, 
  defaultExpanded = false,
  isCollapsed = false,
  highlight = false
}: SidebarGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [hoverExpanded, setHoverExpanded] = useState(false)

  if (isCollapsed) {
    // When sidebar is collapsed, we might want to just show children without the group header,
    // or maybe show a separator. For now, let's just render children directly as icons are self-explanatory
    // or show a small divider.
    return (
      <div className="py-2 border-t border-white/5 first:border-0 flex flex-col items-center gap-2">
        {children}
      </div>
    )
  }

  // Show expanded state if either clicked open OR hovering
  const shouldShow = isExpanded || hoverExpanded

  return (
    <div 
      className="py-2 border-t border-white/5 first:border-0"
      onMouseEnter={() => setHoverExpanded(true)}
      onMouseLeave={() => setHoverExpanded(false)}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 group ${
          highlight 
            ? 'text-white shadow-[0_0_15px_rgba(255,255,255,0.3)] bg-gradient-to-r from-red-500/20 via-green-500/20 to-blue-500/20 border-y border-white/20 animate-pulse' 
            : 'text-gray-400 hover:text-gray-100'
        }`}
      >
        <span className="flex-1 text-left">{title}</span>
        <motion.div
          animate={{ rotate: shouldShow ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3 h-3 group-hover:text-white" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {shouldShow && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1 px-2 pb-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
