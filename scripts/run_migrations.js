import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MIGRATIONS_DIR = path.resolve(__dirname, '../supabase/migrations')
// Start from this migration timestamp to avoid re-running very old ones
// This matches the start of the previous hardcoded list
const START_MIGRATION = '20200101000000'

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

    // Get all SQL files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .filter(f => {
        // Extract timestamp prefix
        const timestamp = f.split('_')[0]
        return timestamp >= START_MIGRATION
      })
      .sort() // Ensure chronological order

    console.log(`Found ${files.length} migrations to process from ${START_MIGRATION}...`)

    for (const file of files) {
      const fullPath = path.join(MIGRATIONS_DIR, file)
      console.log(`Reading migration: ${file}`)
      
      const sql = fs.readFileSync(fullPath, 'utf-8')
      console.log(`Applying migration: ${file}`)
      
      let attempt = 0
      let maxRetries = 10 // Increased retries
      let success = false

      while (attempt < maxRetries && !success) {
        attempt++
        try {
          await client.query(sql)
          console.log(`✓ Success: ${file}`)
          success = true
        } catch (err) {
          // Deadlock detected (check code OR message content)
          const isDeadlock = err.code === '40P01' || err.message.includes('deadlock detected')
          
          if (isDeadlock) {
            console.warn(`⚠️ Deadlock detected for ${file}. Retrying ${attempt}/${maxRetries} in 5s...`)
            try { await client.query('ROLLBACK') } catch (rbErr) {}
            await new Promise(r => setTimeout(r, 5000))
            continue
          }

          // If error is "already exists" or similar, we might want to warn and continue
          console.error(`❌ Failed: ${file}`)
          console.error(err.message)
          
          if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
              console.log('  -> Rolling back transaction to clear state...')
              try { await client.query('ROLLBACK') } catch (rbErr) { console.warn('Rollback warning:', rbErr.message) }
              
              console.log('  -> Continuing despite error (assuming idempotent/already applied)')
              success = true
           } else {
              throw err
           }
         }
       }
       
       if (!success) {
         throw new Error(`Migration ${file} failed after ${maxRetries} attempts.`)
       }
    }

    console.log('All migrations completed successfully.')
  } catch (e) {
    console.error('Migration failed fatal error:', e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
