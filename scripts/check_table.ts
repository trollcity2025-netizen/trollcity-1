import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yjxpwfalenorzrqxwmtr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxMTcsImV4cCI6MjA3OTYwNTExN30.S5Vc1xpZoZ0aemtNFJGcPhL_zvgPA0qgZq8e8KigUx8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: _data, error } = await supabase
    .from('mobile_error_logs')
    .select('count', { count: 'exact', head: true })

  if (error) {
    console.log('Error:', error.message)
  } else {
    console.log('Table exists.')
  }
}

check()
