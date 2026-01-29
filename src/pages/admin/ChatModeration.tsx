import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2, MessageSquare, X } from 'lucide-react'
import { format } from 'date-fns'

interface ChatReport {
  id: string
  stream_id: string
  reason: string
  status: string
  created_at: string
  reported_by_id: string
}

interface ChatMessage {
  id: string
  user_id: string
  content: string
  created_at: string
  user_profiles: {
    username: string
    avatar_url: string | null
  } | null
}

export default function ChatModeration() {
  const [reports, setReports] = useState<ChatReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<ChatReport | null>(null)
  const [chatContext, setChatContext] = useState<ChatMessage[]>([])
  const [loadingContext, setLoadingContext] = useState(false)

  const loadReports = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('stream_reports')
        .select('id, stream_id, reason, status, created_at, reported_by_id')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setReports(data || [])
    } catch (error) {
      console.error('Failed to load chat reports:', error)
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  const loadContext = async (report: ChatReport) => {
    setSelectedReport(report)
    setLoadingContext(true)
    try {
      // Load messages from 5 minutes before to 1 minute after the report
      const reportTime = new Date(report.created_at).getTime()
      const startTime = new Date(reportTime - 5 * 60 * 1000).toISOString()
      const endTime = new Date(reportTime + 1 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          user_profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('stream_id', report.stream_id)
        .gte('created_at', startTime)
        .lte('created_at', endTime)
        .order('created_at', { ascending: true })

      if (error) throw error
      // @ts-ignore
      setChatContext(data || [])
    } catch (error) {
      console.error('Failed to load chat context:', error)
      setChatContext([])
    } finally {
      setLoadingContext(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-gray-400 uppercase tracking-[0.4em]">Chat Moderation</p>
          <h1 className="text-3xl font-bold">Moderate Reported Chat</h1>
          <p className="text-sm text-gray-400">
            Review recent stream chat reports and take action on suspicious activity.
          </p>
        </header>

        <div className="bg-[#141414] border border-[#2C2C2C] rounded-2xl p-6 shadow-lg shadow-black/40">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-300">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading recent chat reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center text-gray-400">No reports have been submitted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-400 text-xs uppercase tracking-[0.3em]">
                  <tr>
                    <th className="py-3 pr-4">Stream</th>
                    <th className="py-3 pr-4">Submitted By</th>
                    <th className="py-3 pr-4">Reason</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Submitted At</th>
                    <th className="py-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C2C]">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-white/5">
                      <td className="py-3 pr-4 text-white font-mono text-xs">{report.stream_id.slice(0, 8)}...</td>
                      <td className="py-3 pr-4 text-gray-200">{report.reported_by_id.slice(0, 8)}...</td>
                      <td className="py-3 pr-4 text-gray-200">{report.reason || 'General concern'}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            report.status === 'resolved'
                              ? 'bg-green-600/20 text-green-300'
                              : 'bg-yellow-600/20 text-yellow-300'
                          }`}
                        >
                          {report.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-400">
                        {report.created_at
                          ? new Date(report.created_at).toLocaleString()
                          : 'Unknown'}
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          onClick={() => loadContext(report)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition-colors"
                        >
                          <MessageSquare className="w-3 h-3" />
                          View Context
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Chat Context Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1A1A1A] border border-[#333] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#333]">
              <div>
                <h3 className="text-lg font-bold text-white">Chat Context</h3>
                <p className="text-xs text-gray-400">
                  Showing messages around report time ({new Date(selectedReport.created_at).toLocaleTimeString()})
                </p>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingContext ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : chatContext.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No messages found in the timeframe surrounding this report.
                </div>
              ) : (
                chatContext.map((msg) => {
                  const isReportedTime = Math.abs(new Date(msg.created_at).getTime() - new Date(selectedReport.created_at).getTime()) < 5000;
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 p-3 rounded-lg ${
                        isReportedTime ? 'bg-red-900/20 border border-red-500/30' : 'bg-black/20'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                        {msg.user_profiles?.avatar_url ? (
                          <img
                            src={msg.user_profiles.avatar_url}
                            alt={msg.user_profiles.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                            {msg.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-sm text-blue-400">
                            {msg.user_profiles?.username || 'Unknown User'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(msg.created_at), 'HH:mm:ss')}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm mt-0.5 break-words">{msg.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-[#333] bg-[#141414] rounded-b-xl flex justify-end gap-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
