import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const anon = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } })

// Change this to the test email you want; this matches the e2e script pattern
const testEmail = process.argv[2] || 'e2e-cancel-1764108906988@example.com'
const testPass = 'TestPass123!'

async function run() {
  try {
    const { data, error } = await anon.auth.signInWithPassword({ email: testEmail, password: testPass })
    if (error) throw error
    const token = data?.session?.access_token
    if (!token) throw new Error('Failed to obtain token')
    console.log('TEST_USER_EMAIL=' + testEmail)
    console.log('ACCESS_TOKEN=' + token)
  } catch (e) {
    console.error('Error:', e.message || e)
    process.exit(2)
  }
}

run()
