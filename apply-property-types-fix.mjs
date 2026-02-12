import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Please set these environment variables')
  process.exit(1)
}

console.log('🔗 Connecting to Supabase:', SUPABASE_URL.substring(0, 30) + '...')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

async function applyMigration() {
  try {
    console.log('\n📖 Reading property_types fix migration...')
    const migrationPath = join(__dirname, 'supabase', 'migrations', '20270328000000_fix_property_types_seed.sql')
    const sql = readFileSync(migrationPath, 'utf8')
    
    console.log('✅ Migration file loaded')
    console.log('📄 File size:', sql.length, 'bytes')
    
    // Try to apply via exec_sql RPC if it exists
    console.log('\n🚀 Applying migration...')
    
    const { data, error } = await supabase.rpc('exec_sql', { sql })
    
    if (error) {
      console.error('❌ Migration failed:', error.message)
      console.error('Full error:', error)
      
      // If exec_sql doesn't exist, try direct SQL execution
      console.log('\n⚠️ Trying alternative method...')
      
      // Split into statements and execute one by one
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i] + ';'
        console.log(`\n[${i + 1}/${statements.length}] Executing:`)
        console.log(stmt.substring(0, 80) + '...')
        
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql: stmt })
        
        if (stmtError) {
          console.error('❌ Statement failed:', stmtError.message)
        } else {
          console.log('✅ Success')
        }
      }
    } else {
      console.log('✅ Migration applied successfully!')
      console.log('Response:', data)
    }
    
    // Verify the fix
    console.log('\n🔍 Verifying property_types table...')
    const { data: types, error: selectError } = await supabase
      .from('property_types')
      .select('*')
      .order('purchase_price')
    
    if (selectError) {
      console.error('❌ Could not verify:', selectError.message)
    } else {
      console.log('✅ Property types found:', types?.length || 0)
      if (types && types.length > 0) {
        console.log('\n📋 Property types:')
        types.forEach(t => {
          console.log(`  - ${t.id}: ${t.name} ($${t.purchase_price})`)
        })
      }
    }
    
  } catch (err) {
    console.error('❌ Fatal error:', err.message)
    console.error(err)
    process.exit(1)
  }
}

console.log('\n🔧 Property Types Fix Migration')
console.log('================================\n')

applyMigration()
  .then(() => {
    console.log('\n✅ Migration complete!')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Migration failed:', err)
    process.exit(1)
  })
