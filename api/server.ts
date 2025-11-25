/**
 * local server entry file, for local development
 */
import app from './app.js';
import { createClient } from '@supabase/supabase-js'

async function seedCoinPackagesIfEmpty() {
  try {
    const url = process.env.SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!url || !key) return
    const supabase = createClient(url, key)
    const { data, error } = await supabase.from('coin_packages').select('id').limit(1)
    if (error) return
    if (!data || data.length === 0) {
      const now = new Date().toISOString()
      const rows = [
        { id: '1', name: 'Baby Troll', coin_amount: 500, price: 6.49, currency: 'USD', description: 'Starter pack', is_active: true, created_at: now },
        { id: '2', name: 'Little Troller', coin_amount: 1440, price: 12.99, currency: 'USD', description: 'Small bundle', is_active: true, created_at: now },
        { id: '3', name: 'Mischief Pack', coin_amount: 3200, price: 24.99, currency: 'USD', description: 'Medium bundle', is_active: true, created_at: now },
        { id: '4', name: 'Troll Family Pack', coin_amount: 7700, price: 49.99, currency: 'USD', description: 'Large bundle', is_active: true, created_at: now },
        { id: '5', name: 'Troll Army Pack', coin_amount: 25400, price: 139.99, currency: 'USD', description: 'Mega bundle', is_active: true, created_at: now },
        { id: '6', name: 'Ultimate Troll Pack', coin_amount: 51800, price: 279.99, currency: 'USD', description: 'Ultra bundle', is_active: true, created_at: now },
      ]
      await supabase.from('coin_packages').insert(rows)
      console.log('Seeded coin_packages default entries')
    }
  } catch {}
}

async function seedAdminUserIfConfigured() {
  try {
    const url = process.env.SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const email = process.env.SEED_ADMIN_EMAIL || ''
    const password = process.env.SEED_ADMIN_PASSWORD || ''
    if (!url || !key || !email || !password) return
    const sb: any = createClient(url, key)
    try {
      const { data: existing } = await sb.auth.admin.listUsers({
        page: 1,
        perPage: 1,
        email
      } as any)
      const found = Array.isArray(existing?.users) && existing.users.find((u: any) => u.email === email)
      if (found) return
    } catch {}
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    } as any)
    if (!error && data?.user?.id) {
      try {
        await sb.from('user_profiles').insert({
          id: data.user.id,
          username: String(email).split('@')[0],
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      } catch {}
      console.log(`Seeded admin user: ${email}`)
    }
  } catch {}
}

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`Server ready on port ${PORT}`);
  await seedCoinPackagesIfEmpty()
  await seedAdminUserIfConfigured()
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
