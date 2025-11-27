import dotenv from 'dotenv'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_BASE = process.env.API_BASE || 'http://localhost:3001'

if (!SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SERVICE) {
  console.error('Missing SUPABASE env vars. Check .env for VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } })

async function run() {
  try {
    const testEmail = `e2e-cancel-${Date.now()}@example.com`
    const testPass = 'TestPass123!'
    console.log('Creating test user:', testEmail)

    // Create user via admin
    const { data: adminUsers, error: listErr } = await adminClient.auth.admin.listUsers()
    if (listErr) throw listErr

    // Create user
    const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: testPass,
      email_confirm: true
    })
    if (createErr) throw createErr
    const user = createData?.user
    if (!user) throw new Error('Create user returned no user')
    console.log('Created user id:', user.id)

    // Sign in as user to get access token
    console.log('Signing in to get access token')
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({ email: testEmail, password: testPass })
    if (signInErr) throw signInErr
    const token = signInData?.session?.access_token
    if (!token) throw new Error('Failed to get access token from sign-in')
    console.log('Got user token (len):', token.length)

    // Insert cashout request as service (so it bypasses RLS)
    console.log('Inserting pending cashout request via service role')
      // Inspect existing columns for cashout_requests so we can insert with available columns
      const { data: cols } = await adminClient
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'cashout_requests')

      console.log('cashout_requests columns found:', (cols || []).map(c => c.column_name).join(', '))

      const insertPayload = { user_id: user.id, username: user.email?.split('@')[0] || 'e2e', email: user.email, requested_coins: 7000, usd_value: 21, status: 'pending' }
      // Add payout_method/payout_details only if present
      const colNames = (cols || []).map(c => c.column_name)
      if (colNames.includes('payout_method')) insertPayload.payout_method = 'CashApp'
      if (colNames.includes('payout_details')) insertPayload.payout_details = '$E2ETEST'

      const { data: inserted, error: insertErr } = await adminClient
        .from('cashout_requests')
        .insert([insertPayload])
        .select()
    if (insertErr) throw insertErr
    const cashout = inserted?.[0]
    console.log('Inserted cashout id:', cashout.id)

    // Call DELETE endpoint with Authorization Bearer <token>
    console.log('Calling DELETE endpoint to cancel cashout')
    const resp = await fetch(`${API_BASE}/api/payments/cashouts/${cashout.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
    const json = await resp.json().catch(() => ({}))
    console.log('DELETE response status:', resp.status)
    console.log('DELETE response body:', json)

    // Verify via service role that row is removed
    const { data: found } = await adminClient.from('cashout_requests').select('*').eq('id', cashout.id).maybeSingle()
    console.log('Row after delete (should be null):', found)

    if (resp.ok && !found) {
      console.log('E2E CANCEL: SUCCESS')
      process.exit(0)
    } else {
      console.error('E2E CANCEL: FAILED')
      process.exit(2)
    }

  } catch (e) {
    console.error('E2E script error:', e.message || e)
    process.exit(1)
  }
}

run()
