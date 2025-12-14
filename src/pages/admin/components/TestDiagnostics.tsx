import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, FileText, Database, Zap, Key } from 'lucide-react'

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'warning' | 'not_tested'
  message: string
  location: string
  details?: string
  error?: any
}

export default function TestDiagnostics() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRun, setLastRun] = useState<Date | null>(null)

  useEffect(() => {
    runAllTests()
  }, [])

  const runAllTests = async () => {
    setLoading(true)
    const testResults: TestResult[] = []

    // Test 1: Supabase Connection
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1)
      
      if (error) throw error
      testResults.push({
        name: 'Supabase Connection',
        status: 'pass',
        message: 'Successfully connected to Supabase',
        location: 'src/pages/admin/AdminDashboard.tsx:testSupabase()',
        details: `Query executed: SELECT id FROM user_profiles LIMIT 1`
      })
    } catch (error: any) {
      testResults.push({
        name: 'Supabase Connection',
        status: 'fail',
        message: error?.message || 'Failed to connect',
        location: 'src/pages/admin/AdminDashboard.tsx:testSupabase()',
        error: error,
        details: `Error Code: ${error?.code || 'UNKNOWN'} | Error Message: ${error?.message || 'No message'}`
      })
    }

    // Test 2: Required RPC Functions
    const requiredRPCs = [
      'approve_application',
      'deny_application',
      'approve_officer_application',
      'approve_empire_partner',
      'reject_empire_partner',
      'approve_payout',
      'reset_app_for_launch',
      'submit_weekly_report',
      'ban_officer',
      'unban_officer',
      'hire_officer',
      'fire_officer'
    ]

    for (const rpcName of requiredRPCs) {
      try {
        // Try to call the RPC with minimal params to see if it exists
        const { error } = await supabase.rpc(rpcName as any, {})
        
        if (error) {
          // Check if it's a parameter error (function exists) vs function doesn't exist
          if (error.code === '42883' || error.message?.includes('does not exist')) {
            testResults.push({
              name: `RPC: ${rpcName}`,
              status: 'fail',
              message: 'Function does not exist',
              location: `supabase/migrations/*.sql`,
              error: error,
              details: `Missing RPC function. Create migration: CREATE OR REPLACE FUNCTION ${rpcName}(...)`
            })
          } else {
            // Function exists but wrong parameters - that's okay for this test
            testResults.push({
              name: `RPC: ${rpcName}`,
              status: 'pass',
              message: 'Function exists (parameter validation works)',
              location: `Database RPC Functions`,
              details: `Function exists. Parameter error expected: ${error.message}`
            })
          }
        } else {
          testResults.push({
            name: `RPC: ${rpcName}`,
            status: 'pass',
            message: 'Function exists and callable',
            location: `Database RPC Functions`,
            details: 'RPC function is available'
          })
        }
      } catch (error: any) {
        testResults.push({
          name: `RPC: ${rpcName}`,
          status: 'fail',
          message: error?.message || 'Unknown error',
          location: `Database RPC Functions`,
          error: error,
          details: `Failed to test RPC: ${error?.code || 'UNKNOWN'}`
        })
      }
    }

    // Test 3: Required Database Tables
    const requiredTables = [
      'user_profiles',
      'applications',
      'empire_applications',
      'broadcaster_applications',
      'payout_requests',
      'coin_transactions',
      'officer_shift_logs',
      'officer_shift_slots',
      'officer_orientation_results',
      'weekly_officer_reports',
      'messages',
      'notifications',
      'gifts',
      'battles',
      'battle_history'
    ]

    for (const tableName of requiredTables) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('*')
          .limit(0)
        
        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            testResults.push({
              name: `Table: ${tableName}`,
              status: 'fail',
              message: 'Table does not exist',
              location: `Database Schema`,
              error: error,
              details: `Missing table. Create migration: CREATE TABLE ${tableName}(...)`
            })
          } else {
            testResults.push({
              name: `Table: ${tableName}`,
              status: 'warning',
              message: `Access issue: ${error.message}`,
              location: `Database Schema`,
              error: error,
              details: `Table exists but may have RLS issues. Error: ${error.code}`
            })
          }
        } else {
          testResults.push({
            name: `Table: ${tableName}`,
            status: 'pass',
            message: 'Table exists and accessible',
            location: `Database Schema`,
            details: 'Table is available'
          })
        }
      } catch (error: any) {
        testResults.push({
          name: `Table: ${tableName}`,
          status: 'fail',
          message: error?.message || 'Unknown error',
          location: `Database Schema`,
          error: error,
          details: `Failed to test table: ${error?.code || 'UNKNOWN'}`
        })
      }
    }

    // Test 4: Required Columns in user_profiles
    const requiredColumns = [
      'id',
      'username',
      'role',
      'empire_role',
      'paid_coin_balance',
      'free_coin_balance',
      'is_troll_officer',
      'is_lead_officer',
      'is_officer_active',
      'is_admin'
    ]

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(requiredColumns.join(','))
        .limit(1)
      
      if (error) {
        // Parse which columns are missing
        const missingColumns: string[] = []
        requiredColumns.forEach(col => {
          if (error.message?.includes(col) || error.message?.includes(`column "${col}"`)) {
            missingColumns.push(col)
          }
        })

        if (missingColumns.length > 0) {
          testResults.push({
            name: 'user_profiles Columns',
            status: 'fail',
            message: `Missing columns: ${missingColumns.join(', ')}`,
            location: `Database Schema: user_profiles table`,
            error: error,
            details: `Add columns: ALTER TABLE user_profiles ADD COLUMN ${missingColumns.map(c => `${c} TYPE`).join(', ')}`
          })
        } else {
          testResults.push({
            name: 'user_profiles Columns',
            status: 'warning',
            message: `Query error: ${error.message}`,
            location: `Database Schema: user_profiles table`,
            error: error,
            details: `Error: ${error.code} - ${error.message}`
          })
        }
      } else {
        testResults.push({
          name: 'user_profiles Columns',
          status: 'pass',
          message: 'All required columns exist',
          location: `Database Schema: user_profiles table`,
          details: `Columns checked: ${requiredColumns.join(', ')}`
        })
      }
    } catch (error: any) {
      testResults.push({
        name: 'user_profiles Columns',
        status: 'fail',
        message: error?.message || 'Unknown error',
        location: `Database Schema: user_profiles table`,
        error: error
      })
    }

    // Test 5: Environment Variables
    const requiredEnvVars = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_PAYPAL_CLIENT_ID',
      'VITE_ADMIN_EMAIL'
    ]

    requiredEnvVars.forEach(envVar => {
      const value = import.meta.env[envVar]
      if (!value) {
        testResults.push({
          name: `Env: ${envVar}`,
          status: 'fail',
          message: 'Environment variable not set',
          location: `.env or .env.local file`,
          details: `Add to .env: ${envVar}=your_value_here`
        })
      } else {
        testResults.push({
          name: `Env: ${envVar}`,
          status: 'pass',
          message: 'Environment variable set',
          location: `.env or .env.local file`,
          details: `Value: ${envVar.substring(0, 20)}...`
        })
      }
    })

    // Test 6: Edge Functions (check if endpoints are accessible)
    const edgeFunctions = [
      { name: 'paypal-create-order', path: '/functions/v1/paypal-create-order' },
      { name: 'paypal-complete-order', path: '/functions/v1/paypal-complete-order' }
    ]

    for (const func of edgeFunctions) {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        if (!supabaseUrl) {
          testResults.push({
            name: `Edge Function: ${func.name}`,
            status: 'warning',
            message: 'Cannot test - VITE_SUPABASE_URL not set',
            location: `Supabase Edge Functions`,
            details: 'Set VITE_SUPABASE_URL to test edge functions'
          })
          continue
        }

        // Just check if the endpoint exists (will fail auth but that's okay)
        const response = await fetch(`${supabaseUrl}${func.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })

        if (response.status === 401 || response.status === 400) {
          // Function exists but needs auth/params - that's fine
          testResults.push({
            name: `Edge Function: ${func.name}`,
            status: 'pass',
            message: 'Function endpoint exists',
            location: `supabase/functions/${func.name}/index.ts`,
            details: `Endpoint accessible (auth required as expected)`
          })
        } else if (response.status === 404) {
          testResults.push({
            name: `Edge Function: ${func.name}`,
            status: 'fail',
            message: 'Function endpoint not found',
            location: `supabase/functions/${func.name}/index.ts`,
            details: `Deploy function: npx supabase functions deploy ${func.name}`
          })
        } else {
          testResults.push({
            name: `Edge Function: ${func.name}`,
            status: 'warning',
            message: `Unexpected status: ${response.status}`,
            location: `supabase/functions/${func.name}/index.ts`,
            details: `Response: ${response.status} ${response.statusText}`
          })
        }
      } catch (error: any) {
        testResults.push({
          name: `Edge Function: ${func.name}`,
          status: 'fail',
          message: error?.message || 'Network error',
          location: `supabase/functions/${func.name}/index.ts`,
          error: error,
          details: `Failed to reach endpoint: ${error.message}`
        })
      }
    }

    setResults(testResults)
    setLastRun(new Date())
    setLoading(false)
  }

  const passCount = results.filter(r => r.status === 'pass').length
  const failCount = results.filter(r => r.status === 'fail').length
  const warningCount = results.filter(r => r.status === 'warning').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Test Diagnostics</h2>
          <p className="text-gray-400 text-sm">
            Comprehensive system health check and missing component detection
          </p>
        </div>
        <button
          type="button"
          onClick={runAllTests}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Running Tests...' : 'Run All Tests'}
        </button>
      </div>

      {lastRun && (
        <div className="text-xs text-gray-400">
          Last run: {lastRun.toLocaleString()}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="font-semibold text-green-400">Passing</span>
          </div>
          <div className="text-2xl font-bold text-white">{passCount}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="font-semibold text-red-400">Failing</span>
          </div>
          <div className="text-2xl font-bold text-white">{failCount}</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <span className="font-semibold text-yellow-400">Warnings</span>
          </div>
          <div className="text-2xl font-bold text-white">{warningCount}</div>
        </div>
      </div>

      {/* Test Results */}
      <div className="space-y-3">
        {loading && results.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Running diagnostics...</p>
          </div>
        ) : (
          results.map((result, idx) => (
            <div
              key={idx}
              className={`rounded-xl border p-4 ${
                result.status === 'pass'
                  ? 'bg-green-500/10 border-green-500/30'
                  : result.status === 'fail'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {result.status === 'pass' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  ) : result.status === 'fail' ? (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  )}
                  <h3 className="font-semibold text-white">{result.name}</h3>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    result.status === 'pass'
                      ? 'bg-green-500/20 text-green-300'
                      : result.status === 'fail'
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-yellow-500/20 text-yellow-300'
                  }`}
                >
                  {result.status.toUpperCase()}
                </span>
              </div>
              
              <p className="text-sm text-gray-300 mb-2">{result.message}</p>
              
              <div className="flex items-start gap-2 text-xs text-gray-400 mb-1">
                <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span><strong>Location:</strong> {result.location}</span>
              </div>
              
              {result.details && (
                <div className="mt-2 p-2 bg-black/30 rounded text-xs text-gray-300 font-mono">
                  {result.details}
                </div>
              )}
              
              {result.error && (
                <details className="mt-2">
                  <summary className="text-xs text-red-400 cursor-pointer hover:text-red-300">
                    Show Error Details
                  </summary>
                  <pre className="mt-2 p-2 bg-black/50 rounded text-xs text-red-300 overflow-x-auto">
                    {JSON.stringify(result.error, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

