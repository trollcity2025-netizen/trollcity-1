import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(url, key)

export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    try {
      const { user_id, amount } = req.body || {}
      const { data, error } = await supabase
        .from('payouts')
        .insert({ user_id, amount })
      return res.status(200).json({ success: !error, data, error: error?.message })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || 'Internal error' })
    }
  }
  return res.status(405).json({ success: false, error: 'Method not allowed' })
}
