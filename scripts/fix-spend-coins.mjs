import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  try {
    console.log('Running spend_coins fix migration...')

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251231_fix_spend_coins_column_names.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    const { error } = await supabase.rpc('exec_sql', { sql })

    if (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }

    console.log('Migration completed successfully!')
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

runMigration()