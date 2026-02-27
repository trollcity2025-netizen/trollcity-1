import React from 'react'
import { AlertTriangle } from 'lucide-react'

export default function MobileIssues() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">Mobile Issues</h3>
      <p className="text-gray-400 text-sm">
        Mobile error tracking is currently unavailable.
      </p>
    </div>
  )
}
