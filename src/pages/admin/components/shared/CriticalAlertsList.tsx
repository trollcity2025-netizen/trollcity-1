import React, { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { CriticalAlert } from '../../../../types/admin'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle, Bell } from 'lucide-react'
import { useAuthStore } from '../../../../lib/store'

interface CriticalAlertsListProps {
  viewMode: 'admin' | 'secretary'
}

export default function CriticalAlertsList({ viewMode: _viewMode }: CriticalAlertsListProps) {
  const { user } = useAuthStore()
  const [alerts, setAlerts] = useState<CriticalAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return; // Stop if not logged in

    fetchAlerts()
    
    // Converted to polling to reduce DB load
    const interval = setInterval(() => {
      fetchAlerts()
    }, 30000)

    return () => clearInterval(interval)
  }, [user])

  const fetchAlerts = async () => {
    if (!user) return;
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('critical_alerts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAlerts(data || [])
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (id: string) => {
    if (!user) return
    try {
      const { error } = await supabase
        .from('critical_alerts')
        .update({ 
          resolved: true,
          resolved_by: user.id,
          resolved_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      toast.success('Alert resolved')
    } catch (error) {
      console.error(error)
      toast.error('Failed to resolve alert')
    }
  }

  const unresolvedCritical = alerts.filter(a => !a.resolved && a.severity === 'critical')
  const otherAlerts = alerts.filter(a => !unresolvedCritical.includes(a))

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-red-400" />
          Critical Alerts
        </h2>
        <div className="text-xs text-slate-400">
          Admin notified automatically via Edge Function
        </div>
      </div>

      {unresolvedCritical.length > 0 && (
        <div className="mb-6 space-y-2">
          {unresolvedCritical.map(alert => (
            <div key={alert.id} className="bg-red-900/20 border border-red-500 p-4 rounded-lg flex justify-between items-center animate-pulse">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <div>
                  <h3 className="font-bold text-red-400 uppercase">Critical Alert</h3>
                  <p className="text-white">{alert.message}</p>
                  <p className="text-xs text-red-300 mt-1">Source: {alert.source}</p>
                </div>
              </div>
              <button 
                onClick={() => handleResolve(alert.id)}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold"
              >
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="text-center text-slate-400">Loading alerts...</div>
        ) : otherAlerts.length === 0 && unresolvedCritical.length === 0 ? (
          <div className="text-center text-slate-400">No alerts</div>
        ) : (
          otherAlerts.map(alert => (
            <div key={alert.id} className={`p-3 rounded border ${
              alert.resolved ? 'bg-slate-900/30 border-slate-800 opacity-50' : 'bg-slate-900/50 border-slate-700'
            } flex justify-between items-center`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    alert.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <span className="text-slate-300 text-sm">{alert.message}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 ml-4">
                  {new Date(alert.created_at).toLocaleString()} • {alert.source}
                  {alert.resolved && ` • Resolved by ${alert.resolved_by?.slice(0, 8)}`}
                </div>
              </div>
              {!alert.resolved && (
                <button 
                  onClick={() => handleResolve(alert.id)}
                  className="p-1 text-slate-400 hover:text-green-400 transition-colors"
                  title="Resolve"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
