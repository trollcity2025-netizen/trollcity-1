interface MAIAuthorityPanelProps {
  mode: 'admin' | 'court'
  location: string
  recordId?: string
}

const modeDescriptions: Record<MAIAuthorityPanelProps['mode'], string> = {
  admin: 'Admin-level oversight and economy adjustments.',
  court: 'Courtroom AI watchtower for fairness & reporting.',
}

export default function MAIAuthorityPanel({ mode, location, recordId }: MAIAuthorityPanelProps) {
  return (
    <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4 mb-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">MAI Authority</p>
          <h3 className="text-lg font-semibold text-white capitalize">{mode} console</h3>
        </div>
        <span className="text-xs text-gray-400">{location.replace('_', ' ')}</span>
      </div>
      <div className="text-sm text-gray-300 space-y-1">
        <p>{modeDescriptions[mode]}</p>
        {recordId && (
          <p>
            <span className="text-gray-400">Active record:</span> <span className="text-white">{recordId}</span>
          </p>
        )}
        <p className="text-xs text-gray-500">
          MAI stands ready to surface anomalies; connect to the decision log to capture intervention telemetry.
        </p>
      </div>
    </div>
  )
}
