import React from 'react'

interface ActionGroupProps {
  title: string
  children: React.ReactNode
  icon?: React.ReactNode
}

export function ActionGroup({ title, children, icon }: ActionGroupProps) {
  return (
    <div className="mb-4 p-3 bg-[#0E0A1A] rounded-lg border border-purple-500/30">
      <h3 className="text-xs font-bold text-purple-400 mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

