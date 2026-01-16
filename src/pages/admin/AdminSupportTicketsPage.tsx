// src/pages/admin/AdminSupportTicketsPage.tsx
import React from 'react'
import AdminSupportTickets from './components/AdminSupportTickets'
import { FileText } from 'lucide-react'

export default function AdminSupportTicketsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Support Tickets</h1>
            <p className="text-gray-400 text-sm">
              Manage user support requests and respond to inquiries
            </p>
          </div>
        </div>

        {/* Support Tickets Component */}
        <AdminSupportTickets />
      </div>
    </div>
  )
}
