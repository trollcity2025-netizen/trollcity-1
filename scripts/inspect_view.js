
import 'dotenv/config'
import { Client } from 'pg'

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const res = await client.query("SELECT pg_get_viewdef('public.earnings_view', true)")
    console.log('View Definition:')
    console.log(res.rows[0].pg_get_viewdef)
  } catch (e) {
    console.error(e)
  } finally {
    await client.end()
  }
}

run()
