import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(url, key)

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('platform_fees')
        .select('*')
        .limit(1)
        .maybeSingle()
      return res.status(200).json({ success: !error, data, error: error?.message })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || 'Internal error' })
    }
  }
  if (req.method === 'POST') {
    try {
      const { fee_pct } = req.body || {}
      const { data, error } = await supabase
        .from('platform_fees')
        .upsert({ id: 1, fee_pct })
      return res.status(200).json({ success: !error, data, error: error?.message })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || 'Internal error' })
    }
  }
  return res.status(405).json({ success: false, error: 'Method not allowed' })
}
