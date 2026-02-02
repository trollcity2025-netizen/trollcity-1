import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const sb = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  try {
    console.log('Checking coin_packages table...')
    const { data, error } = await sb.from('coin_packages').select('*')
    
    if (error) {
      console.error('Error querying packages:', error)
      return
    }
    
    console.log(`Found ${data?.length || 0} packages:`)
    data?.forEach(pkg => {
      console.log(`  - ${pkg.name} (ID: ${pkg.id}): ${pkg.coins || pkg.coin_amount} coins for $${pkg.price}`)
    })
    
    if (!data || data.length === 0) {
      console.log('\nNo packages found. Seeding default packages...')
      
      const now = new Date().toISOString()
      const packages = [
        { id: '1', name: 'Baby Troll', coins: 500, price: 6.49, currency: 'USD', description: 'Starter pack', is_active: true, created_at: now },
        { id: '2', name: 'Little Troller', coins: 1440, price: 12.99, currency: 'USD', description: 'Small bundle', is_active: true, created_at: now },
        { id: '3', name: 'Mischief Pack', coins: 3200, price: 24.99, currency: 'USD', description: 'Medium bundle', is_active: true, created_at: now },
        { id: '4', name: 'Troll Family Pack', coins: 7700, price: 49.99, currency: 'USD', description: 'Large bundle', is_active: true, created_at: now },
        { id: '5', name: 'Troll Army Pack', coins: 25400, price: 139.99, currency: 'USD', description: 'Mega bundle', is_active: true, created_at: now },
        { id: '6', name: 'Ultimate Troll Pack', coins: 51800, price: 279.99, currency: 'USD', description: 'Ultra bundle', is_active: true, created_at: now },
      ]
      
      const { data: inserted, error: insertErr } = await sb.from('coin_packages').insert(packages)
      
      if (insertErr) {
        console.error('Error seeding packages:', insertErr)
      } else {
        console.log(`Successfully seeded ${inserted?.length || 6} packages`)
      }
    }
  } catch (err) {
    console.error('Error:', err)
  }
}

main()
