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

async function executeSQLFile() {
  try {
    console.log('📖 Reading SQL file...')
    const sqlPath = join(__dirname, 'clear_test_streams.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    
    console.log('🚀 Executing SQL against Supabase...')
    
    // Split by semicolons but handle DO blocks properly
    const lines = sql.split('\n')
    const statements = []
    let currentStatement = ''
    let inDOBlock = false
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('DO $$') || trimmed === 'DO $') {
        inDOBlock = true
        currentStatement += line + '\n'
      } else if (inDOBlock && trimmed.startsWith('END $$')) {
        currentStatement += line + '\n'
        inDOBlock = false
        if (currentStatement.trim().length > 0 && !currentStatement.trim().startsWith('--')) {
          statements.push(currentStatement.trim())
        }
        currentStatement = ''
      } else if (!trimmed.startsWith('--') && trimmed.length > 0) {
        currentStatement += line + '\n'
        if (trimmed.endsWith(';') && !inDOBlock) {
          const cleaned = currentStatement.trim()
          if (cleaned.length > 0 && !cleaned.startsWith('--')) {
            statements.push(cleaned)
          }
          currentStatement = ''
        }
      }
    }
    
    console.log(`\n📝 Found ${statements.length} SQL statements\n`)
    
    let _totalDeleted = {
      streams: 0,
      seat_sessions: 0,
      messages: 0,
      bans: 0,
      mutes: 0,
      moderators: 0,
      court_cases: 0
    }
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      // Skip SELECT-only statements (they're for preview)
      const upperStmt = statement.toUpperCase()
      if (upperStmt.startsWith('SELECT') && !upperStmt.includes('DELETE')) {
        console.log(`\n[${i + 1}/${statements.length}] Skipping SELECT (preview): ${statement.substring(0, 80)}...`)
        continue
      }
      
      // Skip UNION ALL statements (they're for summary)
      if (upperStmt.includes('UNION ALL')) {
        console.log(`\n[${i + 1}/${statements.length}] Skipping UNION (summary): ${statement.substring(0, 80)}...`)
        continue
      }
      
      console.log(`\n[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 100)}...`)
      
      try {
        // Try using exec_sql RPC if available
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          console.log(`  ⚠️  exec_sql not available, trying direct query...`)
          
          // Try using pg_query directly
          const result = await supabase.from('_temp_query').select('*').limit(0)
          
          if (result.error && result.error.message.includes('relation')) {
            console.log(`  ℹ️  exec_sql RPC not found. This typically requires enabling the pgRPC extension.`)
            console.log(`  📋 Please run the SQL manually in Supabase Dashboard or via psql.`)
            console.log(`  📄 SQL file: ${sqlPath}`)
          } else {
            console.log(`  ℹ️  Query would require write access to execute DELETE statements`)
          }
        } else {
          console.log(`  ✅ Statement executed successfully`)
        }
      } catch (err) {
        console.error(`  ❌ Error: ${err.message}`)
      }
    }
    
    console.log('\n\n📊 SUMMARY')
    console.log('==========')
    console.log('The SQL file has been prepared but could not be executed automatically.')
    console.log('\nTo execute the cleanup:')
    console.log('1. Go to Supabase Dashboard: https://supabase.com')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the contents of: clear_test_streams.sql')
    console.log('4. Run the SQL to clean up test streams')
    
  } catch (error) {
    console.error('❌ Execution failed:', error.message)
    process.exit(1)
  }
}

executeSQLFile()
