import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'

// List of migrations to run in order
const migrationsToRun = [
  '../supabase/migrations/20270215000002_fix_payout_requests_permissions.sql',
  '../supabase/migrations/20270215000000_remove_gamerz_add_pods.sql',
  '../supabase/migrations/20270215000001_fix_streams_permissions.sql',
  '../supabase/migrations/20270215010000_create_pod_storage.sql',
  '../supabase/migrations/20270217110000_fix_tournament_participants_status.sql',
  '../supabase/migrations/20270217111000_rename_neon_city.sql',
  '../supabase/migrations/20270217120000_tournament_rpc.sql',
  '../supabase/migrations/20270218000000_secure_notification_rpc.sql',
  '../supabase/migrations/20270218000001_fix_tournament_deletion_rls.sql',
  '../supabase/migrations/20270218100000_president_system.sql',
  '../supabase/migrations/20270306000007_fix_purchase_functions.sql',
  '../supabase/migrations/20270306000008_add_tmv_rpcs.sql'
]

async function run() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Aborting.')
    process.exit(1)
  }

  const client = new Client({ connectionString: databaseUrl })
  
  try {
    await client.connect()
    console.log('Connected to database.')

    for (const relativePath of migrationsToRun) {
      const fullPath = path.resolve(__dirname, relativePath)
      console.log(`Reading migration: ${relativePath}`)
      
      if (!fs.existsSync(fullPath)) {
        console.error(`File not found: ${fullPath}`)
        continue
      }

      const sql = fs.readFileSync(fullPath, 'utf-8')
      console.log(`Applying migration: ${path.basename(fullPath)}`)
      
      await client.query(sql)
      console.log(`✓ Success: ${path.basename(fullPath)}`)
    }

    console.log('All migrations completed successfully.')
  } catch (e) {
    console.error('Migration failed:', e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
