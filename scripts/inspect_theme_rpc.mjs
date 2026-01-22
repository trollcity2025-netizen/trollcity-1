import 'dotenv/config'
import { Client } from 'pg'

async function run() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not set in .env')
    process.exit(1)
  }

  const client = new Client({ connectionString: databaseUrl })
  
  try {
    await client.connect()
    console.log('Connected to database.')

    const res = await client.query(`
      SELECT 
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as arguments,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'purchase_broadcast_theme';
    `)
    
    console.log(`Found ${res.rows.length} versions:`)
    res.rows.forEach((r, i) => {
      console.log(`\n=== Version ${i + 1} ===`)
      console.log(`Arguments: ${r.arguments}`)
      console.log('Definition:')
      console.log(r.definition)
    })

    await client.end()
  } catch (e) {
    console.error('Error:', e)
    process.exit(1)
  }
}

run()
