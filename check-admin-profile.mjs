import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProfile() {
  try {
    // Check by admin ID
    const adminId = '8dff9f37-21b5-4b8e-adc2-b9286874be1a'
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', adminId)
      .single()

    if (error) {
      console.error('Error:', error)
      return
    }

    console.log('Current admin profile:')
    console.log(JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Failed:', err)
  }
}

checkProfile()
