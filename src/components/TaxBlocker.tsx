import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FileText } from 'lucide-react'

interface TaxBlockerProps {
  taxStatus: string | null | undefined
}

export default function TaxBlocker({ taxStatus }: TaxBlockerProps) {
  const navigate = useNavigate()

  if (taxStatus !== 'required') {
    return null
  }

  return (
    <div className="rounded-lg p-4 bg-red-900/30 border border-red-600 text-red-300 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-red-300 mb-1">
            You've earned over $600 this year! 🎉
          </p>
          <p className="text-sm text-red-200 mb-3">
            To continue cashing out, you must submit a W-9 form for tax compliance.
          </p>
          <button
            onClick={() => navigate('/tax/upload')}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Submit Tax Form
          </button>
        </div>
      </div>
    </div>
  )
}

