import React from 'react'
import CashoutRequestsList from './components/shared/CashoutRequestsList'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function CashoutManager() {
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Link to="/admin" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Cashout Manager</h1>
            <p className="text-slate-400">Manage payout requests</p>
          </div>
        </div>
        
        <CashoutRequestsList viewMode="admin" />
      </div>
    </div>
  )
}
