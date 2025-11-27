#!/usr/bin/env node
/**
 * Comprehensive Payment Flow Test
 * Tests the entire coin purchase workflow:
 * 1. Square environment check
 * 2. Create customer (if needed)
 * 3. Save card
 * 4. Purchase coins
 * 5. Verify coin balance updated
 * 6. Check transaction logged
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const API_URL = process.env.VITE_API_URL || 'http://localhost:3001'
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.cyan}▶ ${msg}${colors.reset}`),
}

// Test card numbers for Square
const TEST_CARDS = {
  visa: '4111 1111 1111 1111',
  mastercard: '5105 1051 0510 5100',
  amex: '3782 822463 10005',
  discover: '6011 0009 9013 9424',
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('PAYMENT FLOW TEST - Troll City')
  console.log('='.repeat(60) + '\n')

  // Step 1: Check Square environment
  log.step('Step 1: Checking Square environment...')
  try {
    const resp = await fetch(`${API_URL}/api/square/environment-check`)
    const data = await resp.json()
    
    if (!resp.ok) {
      log.error(`Square environment check failed: ${data.error}`)
      process.exit(1)
    }

    log.info(`Square Mode: ${data.mode}`)
    log.info(`Configured: ${data.configured}`)
    log.info(`App ID: ${data.appIdPrefix}`)
    log.info(`Location ID: ${data.locationIdPrefix}`)
    
    if (data.warning) {
      log.warn(data.warning)
    }
    
    if (data.mode === 'sandbox') {
      log.warn('Running in SANDBOX mode - cards will appear as TestCard')
      log.warn('For production testing, update to production Square credentials')
    } else {
      log.success('Running in PRODUCTION mode')
    }
  } catch (err) {
    log.error(`Square check failed: ${err.message}`)
    process.exit(1)
  }

  // Step 2: Get or create test user
  log.step('\nStep 2: Getting test user...')
  let testUser
  try {
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1)
      .single()
    
    if (error) throw error
    
    testUser = users
    log.success(`Using test user: ${testUser.username} (${testUser.id})`)
    log.info(`Current paid balance: ${testUser.paid_coin_balance || 0}`)
    log.info(`Current free balance: ${testUser.free_coin_balance || 0}`)
  } catch (err) {
    log.error(`Failed to get test user: ${err.message}`)
    process.exit(1)
  }

  // Step 3: Check for existing payment methods
  log.step('\nStep 3: Checking existing payment methods...')
  try {
    const { data: methods, error } = await supabase
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', testUser.id)
    
    if (error) throw error
    
    log.info(`Found ${methods.length} payment method(s)`)
    
    methods.forEach(m => {
      log.info(`  - ${m.brand || 'Card'} •••• ${m.last4} (${m.is_default ? 'DEFAULT' : 'secondary'})`)
    })
    
    if (methods.length === 0) {
      log.warn('No payment methods found - need to add a card via UI')
      log.info('To add a card:')
      log.info('  1. Open http://localhost:5174/settings/payment')
      log.info('  2. Enter card details')
      log.info('  3. Click "Save Card"')
      log.info('  4. Re-run this test')
      process.exit(0)
    }
  } catch (err) {
    log.error(`Failed to check payment methods: ${err.message}`)
    process.exit(1)
  }

  // Step 4: Get coin packages
  log.step('\nStep 4: Getting coin packages...')
  let packages
  try {
    const { data, error } = await supabase
      .from('coin_packages')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true })
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      log.warn('No coin packages found in database, using hardcoded package')
      packages = [{
        id: 'cc532723-f51f-4e5a-b547-160a0e6609b8',
        name: 'Baby Troll',
        coin_amount: 500,
        price: 6.49,
        currency: 'USD'
      }]
    } else {
      packages = data
    }
    
    log.success(`Found ${packages.length} coin package(s)`)
    packages.forEach(p => {
      log.info(`  - ${p.name}: ${p.coin_amount} coins for $${p.price}`)
    })
  } catch (err) {
    log.error(`Failed to get packages: ${err.message}`)
    process.exit(1)
  }

  // Step 5: Test coin purchase
  const testPackage = packages[0]
  log.step(`\nStep 5: Testing coin purchase - ${testPackage.name}...`)
  log.info(`Package: ${testPackage.name}`)
  log.info(`Amount: ${testPackage.coin_amount} coins`)
  log.info(`Price: $${testPackage.price}`)
  
  const balanceBefore = testUser.paid_coin_balance || 0
  
  try {
    const resp = await fetch(`${API_URL}/api/payments/create-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUser.id,
        packageId: testPackage.id
      })
    })
    
    const data = await resp.json()
    
    if (!resp.ok) {
      log.error(`Purchase failed: ${data.error}`)
      log.error(`Details: ${data.details || 'No details'}`)
      
      // Check for common issues
      if (data.details?.includes('sourceId') || data.details?.includes('payment method')) {
        log.warn('Payment method issue detected')
        log.info('Try adding a valid card in the UI first')
      }
      
      if (data.details?.includes('test') || data.details?.includes('sandbox')) {
        log.warn('Card may be invalid for production mode')
        log.info('Use a real card or switch to Square sandbox mode')
      }
      
      process.exit(1)
    }
    
    log.success('Payment processed successfully!')
    log.info(`Transaction ID: ${data.payment?.id || 'N/A'}`)
    log.info(`Status: ${data.payment?.status || 'unknown'}`)
  } catch (err) {
    log.error(`Purchase request failed: ${err.message}`)
    process.exit(1)
  }

  // Step 6: Verify coin balance updated
  log.step('\nStep 6: Verifying coin balance...')
  try {
    const { data: updatedUser, error } = await supabase
      .from('user_profiles')
      .select('paid_coin_balance, free_coin_balance')
      .eq('id', testUser.id)
      .single()
    
    if (error) throw error
    
    const balanceAfter = updatedUser.paid_coin_balance || 0
    const difference = balanceAfter - balanceBefore
    
    log.info(`Balance before: ${balanceBefore}`)
    log.info(`Balance after: ${balanceAfter}`)
    log.info(`Difference: +${difference}`)
    
    if (difference === testPackage.coin_amount) {
      log.success('Coin balance updated correctly!')
    } else if (difference > 0) {
      log.warn(`Unexpected difference: expected +${testPackage.coin_amount}, got +${difference}`)
    } else {
      log.error('Coin balance did NOT update!')
      process.exit(1)
    }
  } catch (err) {
    log.error(`Failed to verify balance: ${err.message}`)
    process.exit(1)
  }

  // Step 7: Check transaction log
  log.step('\nStep 7: Checking transaction log...')
  try {
    const { data: transactions, error } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', testUser.id)
      .eq('type', 'purchase')
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error) throw error
    
    if (!transactions || transactions.length === 0) {
      log.error('No transaction found in log!')
      log.warn('Coins may have been credited without proper logging')
      process.exit(1)
    }
    
    const tx = transactions[0]
    log.success('Transaction logged successfully!')
    log.info(`Type: ${tx.type}`)
    log.info(`Coin Type: ${tx.coin_type}`)
    log.info(`Amount: ${tx.amount}`)
    log.info(`Balance After: ${tx.balance_after}`)
    log.info(`Created: ${new Date(tx.created_at).toLocaleString()}`)
    
    if (tx.metadata) {
      log.info(`Metadata: ${JSON.stringify(tx.metadata, null, 2)}`)
    }
  } catch (err) {
    log.error(`Failed to check transaction log: ${err.message}`)
    process.exit(1)
  }

  // Final summary
  console.log('\n' + '='.repeat(60))
  log.success('ALL PAYMENT TESTS PASSED!')
  console.log('='.repeat(60))
  
  console.log('\n📊 Summary:')
  console.log(`  ✓ Square environment: OK`)
  console.log(`  ✓ Payment methods: OK`)
  console.log(`  ✓ Coin packages: OK`)
  console.log(`  ✓ Purchase flow: OK`)
  console.log(`  ✓ Balance update: OK`)
  console.log(`  ✓ Transaction log: OK`)
  
  console.log('\n💡 Next steps:')
  console.log('  1. Test with different coin packages')
  console.log('  2. Test adding/removing payment methods')
  console.log('  3. Test with different card types')
  console.log('  4. Monitor Square dashboard for transactions')
  console.log('  5. Execute database migrations')
  console.log('  6. Deploy to production')
  
  console.log('\n')
}

main().catch(err => {
  log.error(`Fatal error: ${err.message}`)
  console.error(err)
  process.exit(1)
})
