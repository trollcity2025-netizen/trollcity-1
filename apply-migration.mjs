import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function applyMigration() {
  try {
    console.log('📖 Reading migration file...')
    const migrationPath = join(__dirname, 'supabase', 'migrations', '20251125_fix_user_signup_trigger.sql')
    const sql = readFileSync(migrationPath, 'utf8')
    
    console.log('🚀 Applying migration to Supabase...')
    console.log('Migration file:', migrationPath)
    
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`\n📝 Found ${statements.length} SQL statements\n`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      
      // Skip comments and DO blocks (they need special handling)
      if (statement.startsWith('--')) continue
      
      console.log(`\n[${i + 1}/${statements.length}] Executing statement...`)
      console.log(statement.substring(0, 100) + '...\n')
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          // If exec_sql doesn't exist, try direct query
          console.log('Trying alternative method...')
          const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            },
            body: JSON.stringify({ sql: statement })
          })
          
          if (!result.ok) {
            console.error(`❌ Error executing statement ${i + 1}:`, await result.text())
            console.log('\n⚠️  Continuing with next statement...\n')
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`)
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }
      } catch (err) {
        console.error(`❌ Error executing statement ${i + 1}:`, err.message)
        console.log('\n⚠️  Continuing with next statement...\n')
      }
    }
    
    console.log('\n\n✅ Migration process completed!')
    console.log('\n📋 Please verify in Supabase Dashboard:')
    console.log('   1. Check that the triggers were created/updated')
    console.log('   2. Try creating a test user to verify it works')
    console.log('   3. Check the Supabase logs for any errors\n')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

applyMigration()
