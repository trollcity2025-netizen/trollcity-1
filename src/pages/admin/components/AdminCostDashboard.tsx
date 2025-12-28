const costInsights = [
  { label: 'Infrastructure Spend', value: '$12,400', change: '+3.2% vs last week' },
  { label: 'Live Support Labor', value: '$8,720', change: '-1.4% vs last week' },
  { label: 'Advertising', value: '$5,960', change: '+0.4% vs last week' },
  { label: 'Cost per Stream', value: '$38.12', change: '-2.1% vs last week' },
]

const costBreakdown = [
  { title: 'Live Streaming', detail: 'Servers, encoding & distribution' },
  { title: 'Support Operations', detail: 'Moderation, incident response, payroll' },
  { title: 'Payment Processing', detail: 'PayPal + ACH + chargebacks' },
  { title: 'Infrastructure & Tools', detail: 'Databases, monitoring, tooling' },
]

const actionItems = [
  'Stress-test the live stream fleet during low-traffic hours to validate autoscaling levers.',
  'Review support headcount vs. ticket volume to ensure labor costs remain in line with SLA targets.',
  'Validate payment processing pipeline to reduce redundant fee tiers.',
]

export default function AdminCostDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Cost Dashboard</h2>
          <p className="text-sm text-gray-400">
            Track infrastructure, labor, and partner spend to ensure Troll City stays lean.
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-1.5 text-sm font-medium text-blue-100 border border-blue-500 rounded-lg hover:bg-blue-500/10 transition"
        >
          Refresh metrics
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {costInsights.map((insight) => (
          <div
            key={insight.label}
            className="bg-[#0B0B13] border border-[#23232D] rounded-2xl p-5 space-y-2 shadow-[0_0_15px_rgba(0,0,0,0.35)]"
          >
            <p className="text-xs uppercase tracking-widest text-gray-400">{insight.label}</p>
            <p className="text-2xl font-semibold text-white">{insight.value}</p>
            <p className="text-xs text-green-400">{insight.change}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="bg-[#0B0B13] border border-[#23232D] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Cost Breakdown</h3>
            <span className="text-xs text-gray-400">Updated just now</span>
          </div>
          <ul className="space-y-3 text-sm">
            {costBreakdown.map((item) => (
              <li key={item.title} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{item.title}</p>
                  <p className="text-gray-400 text-xs">{item.detail}</p>
                </div>
                <span className="text-xs text-blue-300">View</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#0B0B13] border border-[#23232D] rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Action Plan</h3>
          <p className="text-sm text-gray-400">
            Focus on the highest leverage items before the next operational review.
          </p>
          <ul className="space-y-2 text-sm">
            {actionItems.map((item) => (
              <li key={item} className="flex gap-2 text-gray-300">
                <span className="text-green-400">&#8226;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-[#0B0B13] border border-[#23232D] rounded-2xl p-6 text-sm text-gray-400">
        <p>
          Connect this view to KPI feeds (billing, payroll, infrastructure usage) once every metric is
          available from the new analytics pipeline.
        </p>
      </div>
    </div>
  )
}
