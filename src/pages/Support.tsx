import React, { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { notifyAdmins } from '../lib/notifications'
import { toast } from 'sonner'
import { FileText, Send, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

interface UserTicket {
  id: string
  subject: string
  category: string
  message: string
  status: string
  created_at: string
  admin_response?: string
}

export default function Support() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  // If user is admin, redirect to admin dashboard support tab
  useEffect(() => {
    if (profile?.role === 'admin' || profile?.is_admin) {
      navigate('/admin/support-tickets', { replace: true })
    }
  }, [profile?.role, profile?.is_admin, navigate])
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<'general' | 'appeal'>('general')
  const [message, setMessage] = useState('')
  const [reportId, setReportId] = useState('')
  const [loading, setLoading] = useState(false)
  const [myTickets, setMyTickets] = useState<UserTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  const loadMyTickets = useCallback(async () => {
    if (!user?.id) return
    setLoadingTickets(true)
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, subject, category, message, status, created_at, admin_response')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setMyTickets(data || [])
    } catch (err) {
      console.error('Failed to load tickets:', err)
    } finally {
      setLoadingTickets(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadMyTickets()
  }, [loadMyTickets])

  const deleteMyTicket = async (ticketId: string) => {
    if (!confirm('Delete this ticket permanently?')) return
    
    try {
      // Optimistically remove from UI
      setMyTickets(prev => prev.filter(t => t.id !== ticketId))
      
      const { error } = await supabase
        .from('support_tickets')
        .delete()
        .eq('id', ticketId)
        .eq('user_id', user?.id) // Extra safety check
      
      if (error) {
        toast.error('Failed to delete ticket')
        // Reload on error
        loadMyTickets()
      } else {
        toast.success('Ticket deleted')
      }
    } catch (err) {
      console.error('Delete failed:', err)
      toast.error('Failed to delete ticket')
      loadMyTickets()
    }
  }

  const submit = async () => {
    if (!user || !profile) { toast.error('Sign in required'); return }
    if (!subject.trim() || !message.trim()) { toast.error('Enter subject and message'); return }
    setLoading(true)
    try {
      // If appeal, submit as moderation report
      if (category === 'appeal') {
        const response = await api.post('/moderation', {
          action: 'submit_report',
          reporter_id: profile.id,
          target_user_id: null,
          stream_id: null,
          reason: 'appeal',
          description: `Subject: ${subject}\n\nReport ID: ${reportId || 'N/A'}\n\nMessage: ${message}`
        })

        if (response.success) {
          toast.success('Appeal submitted. Our Troll Officers will review soon.')
          setSubject('')
          setMessage('')
          setReportId('')
          setCategory('general')
        } else {
          toast.error(response.error || 'Failed to submit appeal')
        }
      } else {
        // Regular support ticket
        const payload = {
          user_id: profile.id,
          username: profile.username,
          email: user.email,
          subject: subject.trim(),
          category,
          message: message.trim(),
          status: 'open',
          created_at: new Date().toISOString()
        }
        const { data: ticket, error } = await supabase.from('support_tickets').insert([payload]).select().single()
        if (!error && ticket) {
          // Notify admins
          await notifyAdmins(
            'New Support Ticket',
            `${profile.username}: ${subject}`,
            'support_ticket',
            { ticketId: ticket.id, userId: profile.id, category: payload.category }
          )
        }
        
        if (!error) {
          toast.success('Support ticket submitted')
          setSubject('')
          setMessage('')
          setCategory('general')
        }
      }
    } catch (err: any) {
      console.error('Support submission error:', err)
      toast.error('Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-2 flex items-center gap-2">
          <FileText className="text-troll-gold w-7 h-7" />
          Support Ticket
        </h1>
        <p className="text-sm text-gray-300 mb-4">Having issues with the app or payouts? Send a message to Admin.</p>

        <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6 space-y-4">
          <div>
            <label className="block text-sm mb-1">Subject</label>
            <input value={subject} onChange={e=>setSubject(e.target.value)} className="w-full bg-[#171427] border border-purple-500/40 rounded px-3 py-2 text-sm" placeholder="Issue summary" />
          </div>
          <div>
            <label className="block text-sm mb-1">Category</label>
            <select value={category} onChange={e=>setCategory(e.target.value as 'general' | 'appeal')} className="w-full bg-[#171427] border border-purple-500/40 rounded px-3 py-2 text-sm">
              <option value="general">General Support</option>
              <option value="appeal">Appeal Moderation Action</option>
              <option value="payouts">Payouts</option>
              <option value="payments">Payments</option>
              <option value="streams">Streams</option>
              <option value="account">Account</option>
            </select>
            
            {category === 'appeal' && (
              <div>
                <label className="block text-sm mb-1">Report ID (Optional)</label>
                <input 
                  type="text"
                  value={reportId}
                  onChange={e => setReportId(e.target.value)}
                  placeholder="Enter the report ID if you have it..."
                  className="w-full bg-[#171427] border border-purple-500/40 rounded px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm mb-1">Message</label>
            <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={6} className="w-full bg-[#171427] border border-purple-500/40 rounded px-3 py-2 text-sm" placeholder="Describe the issue, steps to reproduce, screenshots/links (optional)" />
          </div>
          <button onClick={submit} disabled={loading} className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-500 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? 'Submitting…' : (<><Send className="w-4 h-4" /> Submit Ticket</>)}
          </button>
        </div>

        {/* My Tickets Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">My Tickets</h2>
          {loadingTickets ? (
            <p className="text-gray-400 text-center py-8">Loading tickets...</p>
          ) : myTickets.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No tickets submitted yet.</p>
          ) : (
            <div className="space-y-4">
              {myTickets.map(ticket => (
                <div key={ticket.id} className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-white">{ticket.subject}</h3>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-xs px-2 py-1 rounded bg-purple-900/50 text-purple-200">{ticket.category}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          ticket.status === 'resolved' ? 'bg-green-900/50 text-green-200' : 
                          ticket.status === 'closed' ? 'bg-gray-700 text-gray-300' : 
                          'bg-yellow-900/50 text-yellow-200'
                        }`}>{ticket.status}</span>
                        <span className="text-xs text-gray-400">{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMyTicket(ticket.id)}
                      className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400 hover:text-red-300"
                      title="Delete ticket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-300 mt-2">{ticket.message}</p>
                  {ticket.admin_response && (
                    <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
                      <p className="text-xs text-green-400 font-semibold mb-1">Admin Response:</p>
                      <p className="text-sm text-gray-200">{ticket.admin_response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
