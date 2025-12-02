import React, { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react'

export default function PayPalTestPanel() {
  const { user, profile } = useAuthStore()
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<{
    status: 'ok' | 'error' | null
    message?: string
    details?: string
    responseStatus?: number
  } | null>(null)

  const testPayPal = async () => {
    setTesting(true)
    setStatus(null)

    try {
      // Step 1: Check authentication
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      if (!token) {
        setStatus({
          status: 'error',
          message: '❌ Not authenticated',
          details: 'No access token found. Please log in again.'
        })
        toast.error('Not authenticated')
        return
      }

      // Step 2: Check environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        setStatus({
          status: 'error',
          message: '❌ Missing environment variable',
          details: 'VITE_SUPABASE_URL is not set in your .env file'
        })
        toast.error('Missing VITE_SUPABASE_URL')
        return
      }

      const edgeFunctionsUrl = `${supabaseUrl}/functions/v1`
      const testUrl = `${edgeFunctionsUrl}/paypal-test-live`

      // Step 3: Test function connectivity (OPTIONS request - no order creation)
      let response: Response
      let responseText: string

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 seconds timeout

        response = await fetch(testUrl, {
          method: 'OPTIONS',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)
        responseText = await response.text()

        // Check if function is reachable
        if (response.ok || response.status === 200 || response.status === 204) {
          setStatus({
            status: 'ok',
            message: '✅ PayPal function is reachable',
            responseStatus: response.status,
            details: `Function endpoint is accessible.\n` +
                     `URL: ${testUrl}\n` +
                     `HTTP Status: ${response.status}\n\n` +
                     `The paypal-create-order function is deployed and responding.`
          })
          toast.success('PayPal function reachable')
          return
        } else {
          throw new Error(`Function returned status ${response.status}: ${responseText.substring(0, 200)}`)
        }

      } catch (fetchError: any) {
        // Network/CORS errors
        if (fetchError.name === 'AbortError') {
          setStatus({
            status: 'error',
            message: '❌ Request timeout',
            details: `The request took longer than 15 seconds.\n\n` +
                     `URL: ${testUrl}\n\n` +
                     `Possible causes:\n` +
                     `1. Function is not deployed\n` +
                     `2. Network connectivity issue\n` +
                     `3. Supabase URL is incorrect\n\n` +
                     `Fix: Deploy the function:\n` +
                     `npx supabase functions deploy paypal-test-live --no-verify-jwt`
          })
          toast.error('Request timeout')
        } else if (fetchError.message?.includes('Failed to fetch') || fetchError.name === 'TypeError') {
          setStatus({
            status: 'error',
            message: '❌ Network error - Function not reachable',
            details: `URL: ${testUrl}\n\n` +
                     `Error Type: ${fetchError.name || 'NetworkError'}\n` +
                     `Error Message: ${fetchError.message}\n\n` +
                     `Possible causes:\n` +
                     `1. Edge function not deployed\n` +
                     `2. CORS configuration issue\n` +
                     `3. Wrong Supabase URL (current: ${supabaseUrl})\n` +
                     `4. Network connectivity problem\n\n` +
                     `Fix: Deploy the function:\n` +
                     `npx supabase functions deploy paypal-test-live --no-verify-jwt\n\n` +
                     `Or check Supabase Dashboard → Functions → paypal-test-live`
          })
          toast.error('Network error - Check deployment')
        } else {
          setStatus({
            status: 'error',
            message: `❌ ${fetchError.message || 'Unknown error'}`,
            details: `Error Type: ${fetchError.name || 'Unknown'}\n` +
                     `Error Message: ${fetchError.message || 'No message'}\n` +
                     `Stack: ${fetchError.stack || 'No stack trace'}\n\n` +
                     `URL: ${testUrl}`
          })
          toast.error(fetchError.message || 'Unknown error')
        }
      }
    } catch (error: any) {
      setStatus({
        status: 'error',
        message: `❌ ${error.message || 'Test failed'}`,
        details: `Error: ${error.message}\n` +
                 `Type: ${error.name || 'Unknown'}`
      })
      toast.error(error.message || 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        PayPal Function Connectivity Test
      </h2>

      <div className="space-y-4">
        {status && (
          <div className={`p-4 rounded-lg border ${
            status.status === 'ok' 
              ? 'bg-green-900/20 border-green-500/30' 
              : 'bg-red-900/20 border-red-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {status.status === 'ok' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span className={`font-semibold text-lg ${
                status.status === 'ok' ? 'text-green-400' : 'text-red-400'
              }`}>
                {status.message}
              </span>
            </div>
            {status.responseStatus && (
              <p className="text-xs text-gray-400 mt-1">HTTP Status: {status.responseStatus}</p>
            )}
            {status.details && (
              <details className="mt-3">
                <summary className="text-sm text-purple-400 cursor-pointer hover:text-purple-300 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  Show Details
                </summary>
                <pre className="mt-2 p-3 bg-black/50 rounded text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono">
                  {status.details}
                </pre>
              </details>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={testPayPal}
          disabled={testing}
          className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {testing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Test PayPal Function
            </>
          )}
        </button>

        <div className="text-xs text-gray-400 mt-2 space-y-1">
          <p>• Tests if <code className="text-purple-400">paypal-test-live</code> function is deployed and reachable</p>
          <p>• Does NOT create a real PayPal order (connectivity test only)</p>
          <p>• Shows detailed error messages if test fails</p>
        </div>
      </div>
    </div>
  )
}
